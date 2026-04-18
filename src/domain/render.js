import YAML from "yaml";

import { getLink } from "../data/link-repository.js";
import { fetchSubscription, getCachedSubscription, putCachedSubscription } from "../data/subscription-cache.js";
import { findCustomTemplate } from "../data/settings-repository.js";
import { decodeBase64UrlText } from "../utils/base64url.js";
import { sha256Hex } from "../utils/crypto.js";
import { badRequest, notFound, unprocessable } from "../utils/errors.js";
import { deepClean, stableStringify } from "../utils/object.js";
import { loadBuiltinTemplate } from "./builtin-templates.js";
import { validateAndNormalizeConfig } from "./config.js";
import { detectCountryName, resolveCountryByCode } from "./country.js";
import { filterSupportedProxies, parseProxyLink, parseSubscriptionBody } from "./parsers/index.js";
import { applyYamlOverride } from "./yaml-override.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRenderContext(context) {
  if (context?.activeLocalSubscriptionUrls instanceof Set) {
    return context;
  }

  return {
    activeLocalSubscriptionUrls: new Set()
  };
}

function getTrackedLocalSubscriptionUrl(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/s/") && !url.pathname.startsWith("/sub/")) {
    return null;
  }
  return url.toString();
}

async function withActiveLocalSubscription(context, request, callback) {
  const currentUrl = getTrackedLocalSubscriptionUrl(request);
  if (!currentUrl) {
    return callback();
  }

  if (context.activeLocalSubscriptionUrls.has(currentUrl)) {
    throw unprocessable("检测到订阅链接循环引用", currentUrl);
  }

  context.activeLocalSubscriptionUrls.add(currentUrl);
  try {
    return await callback();
  } finally {
    context.activeLocalSubscriptionUrls.delete(currentUrl);
  }
}

function getPathToken(pathname, prefix) {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const tail = pathname.slice(prefix.length);
  if (!tail || tail.includes("/")) {
    return null;
  }

  return tail;
}

function resolveLocalSubscriptionTarget(request, subscriptionUrl) {
  const currentUrl = new URL(request.url);
  const targetUrl = new URL(subscriptionUrl, currentUrl);
  if (targetUrl.origin !== currentUrl.origin) {
    return null;
  }

  const shortId = getPathToken(targetUrl.pathname, "/s/");
  if (shortId) {
    return {
      type: "short",
      targetUrl,
      id: shortId
    };
  }

  const payload = getPathToken(targetUrl.pathname, "/sub/");
  if (payload) {
    return {
      type: "long",
      targetUrl,
      payload
    };
  }

  return null;
}

function createInternalRequest(request, targetUrl) {
  return new Request(targetUrl.toString(), {
    method: "GET",
    headers: request.headers
  });
}

async function resolveLocalSubscription(env, request, subscriptionUrl, context) {
  const localTarget = resolveLocalSubscriptionTarget(request, subscriptionUrl);
  if (!localTarget) {
    return null;
  }

  const targetUrl = localTarget.targetUrl.toString();
  if (context.activeLocalSubscriptionUrls.has(targetUrl)) {
    throw unprocessable("检测到订阅链接循环引用", targetUrl);
  }

  const localRequest = createInternalRequest(request, localTarget.targetUrl);
  const result =
    localTarget.type === "short"
      ? await renderLink(env, localRequest, localTarget.id, context)
      : await renderConfig(
          env,
          localRequest,
          JSON.parse(decodeBase64UrlText(localTarget.payload)),
          context
        );

  return {
    body: result.yaml,
    subscriptionUserinfo: result.subscriptionUserinfo || ""
  };
}

async function loadTemplate(env, request, config) {
  if (config.template.mode === "builtin") {
    return loadBuiltinTemplate(env, request, config.template.value);
  }

  const template = await findCustomTemplate(env, config.template.value);
  if (!template) {
    throw notFound("自建模板不存在");
  }
  return template;
}

function ensureTemplateShape(templateObject) {
  if (!templateObject || typeof templateObject !== "object" || Array.isArray(templateObject)) {
    throw unprocessable("模板 YAML 顶层必须是对象");
  }

  return {
    ...templateObject,
    proxies: Array.isArray(templateObject.proxies) ? templateObject.proxies : [],
    "proxy-groups": Array.isArray(templateObject["proxy-groups"])
      ? templateObject["proxy-groups"]
      : [],
    rules: Array.isArray(templateObject.rules) ? templateObject.rules : [],
    "rule-providers":
      templateObject["rule-providers"] && typeof templateObject["rule-providers"] === "object"
        ? templateObject["rule-providers"]
        : {}
  };
}

function applyPrefix(proxies, prefix) {
  if (!prefix) {
    return proxies;
  }
  return proxies.map((proxy) => ({
    ...proxy,
    name: `${prefix} ${proxy.name}`.trim()
  }));
}

function dedupeProxies(proxies) {
  const seen = new Set();
  const result = [];
  for (const proxy of proxies) {
    const key = stableStringify(proxy);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(proxy);
    }
  }
  return result;
}

function applyFilterAndReplace(proxies, config) {
  let next = [...proxies];
  if (config.transforms.filterRegex) {
    let regex;
    try {
      regex = new RegExp(config.transforms.filterRegex);
    } catch (error) {
      throw badRequest("filterRegex 非法", error instanceof Error ? error.message : String(error));
    }
    next = next.filter((proxy) => !regex.test(proxy.name));
  }

  for (const replacement of config.transforms.replacements) {
    let regex;
    try {
      regex = new RegExp(replacement.pattern, "g");
    } catch (error) {
      throw badRequest("replacement pattern 非法", error instanceof Error ? error.message : String(error));
    }
    next = next.map((proxy) => ({
      ...proxy,
      name: proxy.name.replace(regex, replacement.replacement)
    }));
  }

  const counts = new Map();
  return next.map((proxy) => {
    const key = proxy.name.trim();
    const count = counts.get(key) || 0;
    counts.set(key, count + 1);
    return {
      ...proxy,
      name: count === 0 ? key : `${key} ${count}`
    };
  });
}

function buildCountryGroups(proxies, options) {
  const groups = new Map();

  for (const proxy of proxies) {
    const countryName = detectCountryName(proxy.name);
    if (!groups.has(countryName)) {
      groups.set(countryName, {
        name: countryName,
        type: options.autoTest ? "url-test" : "select",
        proxies: [],
        url: options.autoTest ? "http://www.gstatic.com/generate_204" : undefined,
        interval: options.autoTest ? 300 : undefined,
        tolerance: options.autoTest ? 50 : undefined,
        lazy: options.autoTest ? Boolean(options.lazy) : undefined,
        __countryGroup: true,
        __size: 0
      });
    }
    const group = groups.get(countryName);
    group.proxies.push(proxy.name);
    group.__size += 1;
  }

  const list = Array.from(groups.values());
  list.sort((left, right) => {
    switch (options.sort) {
      case "namedesc":
        return right.name.localeCompare(left.name, "zh-Hans-CN");
      case "sizeasc":
        return left.__size - right.__size || left.name.localeCompare(right.name, "zh-Hans-CN");
      case "sizedesc":
        return right.__size - left.__size || left.name.localeCompare(right.name, "zh-Hans-CN");
      case "nameasc":
      default:
        return left.name.localeCompare(right.name, "zh-Hans-CN");
    }
  });

  return list;
}

function expandGroupPlaceholders(group, proxyNames, countryGroups, ignoreCountryGroup) {
  const groupMap = new Map(countryGroups.map((item) => [item.name, item]));
  const countryNames = countryGroups.map((item) => item.name);

  return {
    ...group,
    proxies: (group.proxies || []).flatMap((entry) => {
      const match = typeof entry === "string" ? entry.match(/^<(.*?)>$/) : null;
      if (!match) {
        return [entry];
      }

      const key = match[1].toLowerCase();
      if (key === "all") {
        return proxyNames;
      }
      if (key === "countries") {
        return ignoreCountryGroup ? [] : countryNames;
      }
      if (key.length === 2) {
        const name = resolveCountryByCode(key);
        if (!name || ignoreCountryGroup) {
          return [];
        }
        return groupMap.get(name)?.proxies || [];
      }
      return [];
    })
  };
}

function appendRulesKeepingMatchLast(existingRules, rulesToAppend) {
  const rules = [...existingRules];
  const lastRule = rules[rules.length - 1];
  if (lastRule && String(lastRule).startsWith("MATCH")) {
    return [...rules.slice(0, -1), ...rulesToAppend, lastRule];
  }
  return [...rules, ...rulesToAppend];
}

function mergeTemplate(templateContent, proxies, countryGroups, config) {
  let templateObject;
  try {
    templateObject = ensureTemplateShape(YAML.parse(templateContent));
  } catch (error) {
    throw unprocessable("模板 YAML 解析失败", error instanceof Error ? error.message : String(error));
  }

  const next = clone(templateObject);
  const proxyNames = proxies.map((proxy) => proxy.name);
  next.proxies = [...next.proxies, ...proxies];
  next["proxy-groups"] = next["proxy-groups"].map((group) =>
    expandGroupPlaceholders(group, proxyNames, countryGroups, config.options.ignoreCountryGroup)
  );
  if (!config.options.ignoreCountryGroup) {
    next["proxy-groups"] = [
      ...next["proxy-groups"],
      ...countryGroups.map(({ __countryGroup, __size, ...group }) => group)
    ];
  }

  const prependRules = config.routing.rules.filter((rule) => rule.prepend).map((rule) => rule.value);
  const appendRules = config.routing.rules.filter((rule) => !rule.prepend).map((rule) => rule.value);
  next.rules = appendRulesKeepingMatchLast([...prependRules, ...next.rules], appendRules);

  const prependProviders = config.routing.ruleProviders.filter((item) => item.prepend);
  const appendProviders = config.routing.ruleProviders.filter((item) => !item.prepend);

  for (const provider of [...prependProviders, ...appendProviders]) {
    next["rule-providers"][provider.name] = {
      type: "http",
      behavior: provider.behavior,
      url: provider.url,
      path: `./providers/${provider.name}.yaml`,
      interval: 3600
    };
  }

  if (prependProviders.length > 0) {
    next.rules = [
      ...prependProviders.map((provider) => `RULE-SET,${provider.name},${provider.group}`),
      ...next.rules
    ];
  }
  if (appendProviders.length > 0) {
    next.rules = appendRulesKeepingMatchLast(
      next.rules,
      appendProviders.map((provider) => `RULE-SET,${provider.name},${provider.group}`)
    );
  }

  return next;
}

async function collectRemoteProxies(env, request, config, context) {
  const result = [];
  let subscriptionUserinfo = "";

  for (let index = 0; index < config.sources.subscriptions.length; index += 1) {
    const subscription = config.sources.subscriptions[index];
    const hash = await sha256Hex(subscription.url);

    let payload;
    if (!config.options.refresh) {
      payload = await getCachedSubscription(env, hash);
    }

    if (!payload) {
      payload =
        (await resolveLocalSubscription(env, request, subscription.url, context)) ||
        (await fetchSubscription(env, subscription.url, {
          userAgent: config.options.userAgent,
          retries: 2,
          noStore: config.options.refresh
        }));
      if (!config.options.refresh) {
        await putCachedSubscription(env, hash, payload);
      }
    }

    const proxies = applyPrefix(parseSubscriptionBody(payload.body, config.options), subscription.prefix);
    result.push(...proxies);

    if (index === 0 && config.sources.subscriptions.length === 1) {
      subscriptionUserinfo = payload.subscriptionUserinfo || "";
    }
  }

  return {
    proxies: result,
    subscriptionUserinfo
  };
}

function collectInlineProxies(config) {
  return config.sources.nodes.map((node) => parseProxyLink(node, config.options));
}

export async function renderConfig(env, request, inputConfig, context) {
  const renderContext = createRenderContext(context);

  return withActiveLocalSubscription(renderContext, request, async () => {
    const config = validateAndNormalizeConfig(inputConfig);
    const template = await loadTemplate(env, request, config);
    const remote = await collectRemoteProxies(env, request, config, renderContext);
    const inline = collectInlineProxies(config);

    let proxies = [...remote.proxies, ...inline];
    proxies = filterSupportedProxies(proxies, config.target);
    proxies = dedupeProxies(proxies);
    proxies = applyFilterAndReplace(proxies, config);

    const countryGroups = buildCountryGroups(proxies, config.options);
    const warnings = [];

    if (config.options.nodeList) {
      if (config.override.content.trim()) {
        warnings.push("仅输出节点列表时已忽略覆写");
      }

      const yaml = YAML.stringify(
        deepClean({
          proxies
        })
      );
      return {
        yaml,
        stats: {
          proxyCount: proxies.length,
          countryGroupCount: countryGroups.length,
          templateId: template.id
        },
        warnings,
        subscriptionUserinfo: remote.subscriptionUserinfo
      };
    }

    let merged = mergeTemplate(template.content, proxies, countryGroups, config);
    merged = applyYamlOverride(merged, config.override.content);
    if (Array.isArray(merged["proxy-groups"])) {
      const proxyNames = proxies.map((proxy) => proxy.name);
      merged["proxy-groups"] = merged["proxy-groups"].map((group) =>
        expandGroupPlaceholders(group, proxyNames, countryGroups, config.options.ignoreCountryGroup)
      );
    }
    const yaml = YAML.stringify(deepClean(merged));

    return {
      yaml,
      stats: {
        proxyCount: proxies.length,
        countryGroupCount: countryGroups.length,
        templateId: template.id
      },
      warnings,
      subscriptionUserinfo: remote.subscriptionUserinfo
    };
  });
}

export async function renderLink(env, request, id, context) {
  const record = await getLink(env, id);
  return renderConfig(env, request, record.config, context);
}
