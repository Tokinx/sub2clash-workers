import YAML from "yaml";

import { getLink } from "../data/link-repository.js";
import { getCachedLinkOutput } from "../data/link-output-cache.js";
import { fetchSubscription, getCachedSubscription, putCachedSubscription } from "../data/subscription-cache.js";
import { findCustomTemplate } from "../data/settings-repository.js";
import { decodeBase64UrlText } from "../utils/base64url.js";
import { sha256Hex } from "../utils/crypto.js";
import { badRequest, notFound, unprocessable } from "../utils/errors.js";
import { deepClean, stableStringify } from "../utils/object.js";
import { loadBuiltinTemplate } from "./builtin-templates.js";
import { validateAndNormalizeConfig } from "./config.js";
import { addCountryFlagToName, detectCountryName, resolveCountryByCode } from "./country.js";
import { filterSupportedProxies, parseProxyLink, parseSubscriptionBody } from "./parsers/index.js";
import { applyParsedOverride, applyYamlOverride } from "./yaml-override.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const DEFAULT_MAX_PROXY_COUNT = 100;
const DEFAULT_MAX_SUBSCRIPTION_COUNT = 10;
// 订阅源并发抓取上限：并发降低首字节延迟，同时避免同时打满上游
const SUBSCRIPTION_FETCH_CONCURRENCY = 4;

function getPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getWorkloadLimits(env) {
  return {
    maxProxyCount: getPositiveInteger(env.MAX_PROXY_COUNT, DEFAULT_MAX_PROXY_COUNT),
    maxSubscriptionCount: getPositiveInteger(env.MAX_SUBSCRIPTION_COUNT, DEFAULT_MAX_SUBSCRIPTION_COUNT)
  };
}

function assertProxyCount(count, limit) {
  if (count > limit) {
    throw badRequest(`节点数量不能超过 ${limit}`);
  }
}

function assertWorkloadConfig(config, limits) {
  const enabledSubscriptionCount = config.sources.subscriptions.filter((item) => item.enabled).length;
  if (enabledSubscriptionCount > limits.maxSubscriptionCount) {
    throw badRequest(`订阅源数量不能超过 ${limits.maxSubscriptionCount}`);
  }
  assertProxyCount(config.sources.nodes.length, limits.maxProxyCount);
}

function createRenderContext(context) {
  if (context?.activeLocalSubscriptionUrls instanceof Set) {
    return context;
  }

  return {
    activeLocalSubscriptionUrls: new Set(),
    externalSourceHashes: new Set(),
    childLinkIds: new Set(),
    customTemplateIds: new Set()
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
  if (localTarget.type === "short") {
    context.childLinkIds.add(localTarget.id);
  }

  let result;
  if (localTarget.type === "short") {
    result = await renderLinkData(env, localRequest, localTarget.id, context);
  } else {
    let localConfig;
    try {
      localConfig = JSON.parse(decodeBase64UrlText(localTarget.payload));
    } catch {
      throw badRequest("订阅参数无效");
    }
    result = await renderConfigData(env, localRequest, localConfig, context);
  }

  return {
    proxies: Array.isArray(result.output.proxies) ? result.output.proxies : [],
    subscriptionUserinfo: result.subscriptionUserinfo || ""
  };
}

async function loadTemplate(env, request, config, context) {
  if (config.template.mode === "builtin") {
    return loadBuiltinTemplate(env, request, config.template.value);
  }

  const template = await findCustomTemplate(env, config.template.value);
  if (!template) {
    throw notFound("自建模板不存在");
  }
  context.customTemplateIds.add(config.template.value);
  return template;
}

function ensureTemplateShape(templateObject) {
  if (!templateObject || typeof templateObject !== "object" || Array.isArray(templateObject)) {
    throw unprocessable("模板 YAML 顶层必须是对象");
  }

  return {
    ...templateObject,
    proxies: Array.isArray(templateObject.proxies) ? templateObject.proxies : [],
    "proxy-groups": Array.isArray(templateObject["proxy-groups"]) ? templateObject["proxy-groups"] : [],
    rules: Array.isArray(templateObject.rules) ? templateObject.rules : [],
    "rule-providers":
      templateObject["rule-providers"] && typeof templateObject["rule-providers"] === "object"
        ? templateObject["rule-providers"]
        : {}
  };
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
    // 重置 lastIndex：用户 pattern 带 g 标志时 test() 依赖 lastIndex 状态，
    // 不重置会隔一个跳一个地误过滤节点
    next = next.filter((proxy) => {
      regex.lastIndex = 0;
      return !regex.test(proxy.name);
    });
  }

  for (const replacement of config.transforms.replacements.filter((item) => item.enabled)) {
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

  return uniquifyProxyNames(next);
}

function uniquifyProxyNames(proxies) {
  const counts = new Map();
  return proxies.map((proxy) => {
    const key = proxy.name.trim();
    const count = counts.get(key) || 0;
    counts.set(key, count + 1);
    return {
      ...proxy,
      name: count === 0 ? key : `${key} ${count}`
    };
  });
}

function applyCountryFlags(proxies, options) {
  if (!options.autoFlag) {
    return proxies;
  }

  return uniquifyProxyNames(
    proxies.map((proxy) => ({
      ...proxy,
      name: addCountryFlagToName(proxy.name)
    }))
  );
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

function createRuleProviderConfig(provider) {
  return {
    type: "http",
    behavior: provider.behavior,
    url: provider.url,
    path: `./providers/${provider.name}.yaml`,
    interval: 3600
  };
}

function hasRoutingEnhancements(routing) {
  return routing.ruleProviders.some((item) => item.enabled) || routing.rules.some((item) => item.enabled);
}

function escapeOverrideKey(key) {
  const value = String(key);
  if (value.startsWith("+") || (value.startsWith("<") && value.endsWith(">"))) {
    return `<${value}>`;
  }
  return value;
}

function replaceOverrideKey(key) {
  return `${escapeOverrideKey(key)}!`;
}

function buildRoutingOverride(baseConfig, routing) {
  if (!hasRoutingEnhancements(routing)) {
    return {};
  }

  const override = {};
  const enabledRules = routing.rules.filter((item) => item.enabled);
  const enabledProviders = routing.ruleProviders.filter((item) => item.enabled);
  const prependRules = enabledRules.filter((rule) => rule.prepend).map((rule) => rule.value);
  const appendRules = enabledRules.filter((rule) => !rule.prepend).map((rule) => rule.value);
  const prependProviders = enabledProviders.filter((item) => item.prepend);
  const appendProviders = enabledProviders.filter((item) => !item.prepend);

  let rules = appendRulesKeepingMatchLast(
    [...prependRules, ...(Array.isArray(baseConfig.rules) ? baseConfig.rules : [])],
    appendRules
  );

  if (prependProviders.length > 0) {
    rules = [...prependProviders.map((provider) => `RULE-SET,${provider.name},${provider.group}`), ...rules];
  }
  if (appendProviders.length > 0) {
    rules = appendRulesKeepingMatchLast(
      rules,
      appendProviders.map((provider) => `RULE-SET,${provider.name},${provider.group}`)
    );
  }

  override["rules!"] = rules;

  if (enabledProviders.length > 0) {
    override["rule-providers"] = Object.fromEntries(
      [...prependProviders, ...appendProviders].map((provider) => [
        replaceOverrideKey(provider.name),
        createRuleProviderConfig(provider)
      ])
    );
  }

  return override;
}

function buildNodeListWarnings(config) {
  const warnings = [];
  const hasRouting = hasRoutingEnhancements(config.routing);
  const hasOverride = config.override.content.trim().length > 0;

  if (hasRouting && hasOverride) {
    warnings.push("仅输出节点列表时已忽略规则增强与配置覆写");
  } else if (hasRouting) {
    warnings.push("仅输出节点列表时已忽略规则增强");
  } else if (hasOverride) {
    warnings.push("仅输出节点列表时已忽略覆写");
  }

  return warnings;
}

function mergeTemplate(templateContent, proxies, countryGroups, config) {
  let templateObject;
  try {
    templateObject = ensureTemplateShape(YAML.parse(templateContent));
  } catch (error) {
    throw unprocessable("模板 YAML 解析失败", error instanceof Error ? error.message : String(error));
  }

  const next = templateObject;
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

  return next;
}

async function collectRemoteProxies(env, request, config, context, limits) {
  const subscriptions = config.sources.subscriptions.filter((item) => item.enabled);

  async function collectOne(subscription) {
    const hash = await sha256Hex(subscription.url);
    const localTarget = resolveLocalSubscriptionTarget(request, subscription.url);

    let payload;
    if (localTarget) {
      payload = await resolveLocalSubscription(env, request, subscription.url, context);
    } else if (!config.options.refresh) {
      context.externalSourceHashes.add(hash);
      payload = await getCachedSubscription(env, hash);
    }

    if (!payload) {
      context.externalSourceHashes.add(hash);
      payload = await fetchSubscription(env, subscription.url, {
        userAgent: config.options.userAgent,
        retries: 2,
        noStore: config.options.refresh
      });
      if (!config.options.refresh) {
        await putCachedSubscription(env, hash, payload);
      }
    }

    const proxies = Array.isArray(payload.proxies)
      ? payload.proxies
      : parseSubscriptionBody(payload.body, config.options, {});
    return {
      proxies,
      subscriptionUserinfo: payload.subscriptionUserinfo || ""
    };
  }

  // 限并发分批收集订阅，避免大量订阅源串行等待网络 RTT；
  // 各源解析不再按剩余额度分别限制，统一在收集完成后校验总上限
  const collected = [];
  for (let start = 0; start < subscriptions.length; start += SUBSCRIPTION_FETCH_CONCURRENCY) {
    const batch = subscriptions.slice(start, start + SUBSCRIPTION_FETCH_CONCURRENCY);
    collected.push(...(await Promise.all(batch.map((subscription) => collectOne(subscription)))));
  }

  const proxies = collected.flatMap((item) => item.proxies);
  assertProxyCount(proxies.length, limits.maxProxyCount - config.sources.nodes.length);

  return {
    proxies,
    subscriptionUserinfo: subscriptions.length === 1 ? collected[0]?.subscriptionUserinfo || "" : ""
  };
}

function collectInlineProxies(config) {
  return config.sources.nodes.map((node) => parseProxyLink(node, config.options));
}

async function renderConfigData(env, request, inputConfig, context) {
  const renderContext = createRenderContext(context);

  return withActiveLocalSubscription(renderContext, request, async () => {
    const config = validateAndNormalizeConfig(inputConfig);
    const limits = getWorkloadLimits(env);
    assertWorkloadConfig(config, limits);
    const template = await loadTemplate(env, request, config, renderContext);
    const remote = await collectRemoteProxies(env, request, config, renderContext, limits);
    const inline = collectInlineProxies(config);

    let proxies = [...remote.proxies, ...inline];
    assertProxyCount(proxies.length, limits.maxProxyCount);
    proxies = filterSupportedProxies(proxies, config.target);
    proxies = dedupeProxies(proxies);
    proxies = applyFilterAndReplace(proxies, config);
    proxies = applyCountryFlags(proxies, config.options);

    const countryGroups = buildCountryGroups(proxies, config.options);
    if (config.options.nodeList) {
      const warnings = buildNodeListWarnings(config);

      return {
        output: deepClean({ proxies }),
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
    if (hasRoutingEnhancements(config.routing)) {
      merged = applyParsedOverride(merged, buildRoutingOverride(merged, config.routing));
    }
    merged = applyYamlOverride(merged, config.override.content);
    if (Array.isArray(merged["proxy-groups"])) {
      const proxyNames = proxies.map((proxy) => proxy.name);
      merged["proxy-groups"] = merged["proxy-groups"].map((group) =>
        expandGroupPlaceholders(group, proxyNames, countryGroups, config.options.ignoreCountryGroup)
      );
    }
    assertProxyCount(Array.isArray(merged.proxies) ? merged.proxies.length : 0, limits.maxProxyCount);
    const warnings = [];

    return {
      output: deepClean(merged),
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

export async function renderConfig(env, request, inputConfig, context) {
  const result = await renderConfigData(env, request, inputConfig, context);
  const { output, ...metadata } = result;
  return {
    // lineWidth: 0 禁止 YAML 折行，长节点名/URL 保持单行，输出更紧凑
    yaml: YAML.stringify(output, { lineWidth: 0 }),
    ...metadata
  };
}

async function renderLinkData(env, request, id, context) {
  const record = await getLink(env, id);
  return renderConfigData(env, request, record.config, context);
}

export async function renderLink(env, request, id, context) {
  // 顶层入口：先查输出缓存，命中直接返回（仅 1 次 KV 读）。
  // 缓存中存在的条目必然来自可缓存链接（refresh: true 从不写缓存，
  // 链接配置变更时 invalidateLinkCaches 已删除对应缓存），命中即安全。
  if (!context) {
    const cached = await getCachedLinkOutput(env, id);
    if (cached) {
      return cached;
    }
  }

  const record = await getLink(env, id);
  const cacheable = record.config?.options?.refresh !== true;

  const renderContext = createRenderContext(context);
  const result = await renderConfigData(env, request, record.config, renderContext);
  const { output, ...metadata } = result;
  const rendered = {
    yaml: YAML.stringify(output, { lineWidth: 0 }),
    ...metadata
  };

  // 返回依赖信息与可缓存标志，由路由层决定是否回写缓存
  // （写入移至 waitUntil，不在请求热路径内阻塞）。
  return {
    ...rendered,
    cacheable,
    dependencies: {
      sources: [...renderContext.externalSourceHashes],
      templates: [...renderContext.customTemplateIds],
      children: [...renderContext.childLinkIds]
    }
  };
}
