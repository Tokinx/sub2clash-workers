import { badRequest } from "../utils/errors.js";

const DEFAULT_OPTIONS = {
  refresh: false,
  autoTest: false,
  lazy: false,
  sort: "nameasc",
  nodeList: false,
  ignoreCountryGroup: false,
  autoFlag: false,
  userAgent: "",
  useUDP: false
};

const VALID_SORTS = new Set(["nameasc", "namedesc", "sizeasc", "sizedesc"]);

// 配置负载护栏：/sub/:payload 未认证可访问，限制数量与大小防 CPU DoS
const MAX_RULE_COUNT = 50;
const MAX_RULE_PROVIDER_COUNT = 20;
const MAX_REPLACEMENT_COUNT = 50;
const MAX_OVERRIDE_BYTES = 64 * 1024;
const MAX_FILTER_REGEX_BYTES = 1024;

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function isRowEnabled(item) {
  return item?.enabled !== false;
}

function assertMaxCount(items, limit, label) {
  if (items.length > limit) {
    throw badRequest(`${label}数量不能超过 ${limit}`);
  }
}

export function validateAndNormalizeConfig(input) {
  if (!input || typeof input !== "object") {
    throw badRequest("配置格式错误");
  }

  const target = input.target === "clash" ? "clash" : input.target === "meta" ? "meta" : null;
  if (!target) {
    throw badRequest("target 仅支持 clash 或 meta");
  }

  const subscriptions = ensureArray(input.sources?.subscriptions).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw badRequest("订阅地址格式错误");
    }

    const enabled = isRowEnabled(item);
    const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
    let normalizedUrl = rawUrl;

    if (enabled) {
      if (!rawUrl) {
        throw badRequest("订阅地址格式错误");
      }

      let url;
      try {
        url = new URL(rawUrl);
      } catch {
        throw badRequest("订阅地址格式错误");
      }
      if (!["http:", "https:"].includes(url.protocol)) {
        throw badRequest("订阅地址仅支持 http/https");
      }
      normalizedUrl = url.toString();
    }

    return {
      enabled,
      url: normalizedUrl,
      remark:
        typeof item.remark === "string"
          ? item.remark.trim()
          : typeof item.prefix === "string"
            ? item.prefix.trim()
            : ""
    };
  });

  const nodes = ensureArray(input.sources?.nodes)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (subscriptions.every((item) => !item.enabled) && nodes.length === 0) {
    throw badRequest("subscriptions 和 nodes 不能同时为空");
  }

  const template = input.template || {};
  if (!["builtin", "custom"].includes(template.mode) || !template.value) {
    throw badRequest("template 配置无效");
  }

  const ruleProviders = ensureArray(input.routing?.ruleProviders);
  assertMaxCount(ruleProviders, MAX_RULE_PROVIDER_COUNT, "rule provider");
  const ruleProviderList = ruleProviders.map((provider) => {
    if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
      throw badRequest("rule provider 配置不完整");
    }

    const normalized = {
      enabled: isRowEnabled(provider),
      name: String(provider.name ?? "").trim(),
      behavior: String(provider.behavior || "domain").trim(),
      url: String(provider.url ?? "").trim(),
      group: String(provider.group ?? "").trim(),
      prepend: Boolean(provider.prepend)
    };

    if (normalized.enabled && (!normalized.name || !normalized.url || !normalized.group)) {
      throw badRequest("rule provider 配置不完整");
    }

    return normalized;
  });

  const names = new Set();
  for (const provider of ruleProviderList.filter((item) => item.enabled)) {
    if (names.has(provider.name)) {
      throw badRequest("rule provider 名称不能重复");
    }
    names.add(provider.name);
  }

  const rules = ensureArray(input.routing?.rules);
  assertMaxCount(rules, MAX_RULE_COUNT, "规则");
  const ruleList = rules.map((rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw badRequest("规则内容不能为空");
    }

    const normalized = {
      enabled: isRowEnabled(rule),
      value: String(rule.value ?? "").trim(),
      prepend: Boolean(rule.prepend)
    };

    if (normalized.enabled && !normalized.value) {
      throw badRequest("规则内容不能为空");
    }

    return normalized;
  });

  const replacements = ensureArray(input.transforms?.replacements);
  assertMaxCount(replacements, MAX_REPLACEMENT_COUNT, "替换规则");
  const replacementList = replacements.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw badRequest("替换规则 pattern 不能为空");
    }

    const normalized = {
      enabled: isRowEnabled(item),
      pattern: String(item.pattern ?? ""),
      replacement: String(item.replacement || "")
    };

    if (normalized.enabled && !normalized.pattern) {
      throw badRequest("替换规则 pattern 不能为空");
    }

    return normalized;
  });

  const options = {
    ...DEFAULT_OPTIONS,
    ...(input.options || {})
  };

  let override = {
    type: "yaml",
    content: ""
  };

  if (input.override !== undefined) {
    if (!input.override || typeof input.override !== "object" || Array.isArray(input.override)) {
      throw badRequest("override 配置无效");
    }

    if (input.override.type !== "yaml") {
      throw badRequest("override.type 仅支持 yaml");
    }

    if (
      input.override.content !== undefined &&
      typeof input.override.content !== "string"
    ) {
      throw badRequest("override.content 必须是字符串");
    }

    const overrideContent = String(input.override.content || "");
    if (new TextEncoder().encode(overrideContent).byteLength > MAX_OVERRIDE_BYTES) {
      throw badRequest(`override.content 超过大小限制`);
    }

    override = {
      type: "yaml",
      content: overrideContent
    };
  }

  if (!VALID_SORTS.has(options.sort)) {
    options.sort = DEFAULT_OPTIONS.sort;
  }
  options.autoFlag = options.autoFlag === true;

  const filterRegex = String(input.transforms?.filterRegex || "");
  if (new TextEncoder().encode(filterRegex).byteLength > MAX_FILTER_REGEX_BYTES) {
    throw badRequest("filterRegex 超过大小限制");
  }

  return {
    target,
    sources: {
      subscriptions,
      nodes
    },
    template: {
      mode: template.mode,
      value: String(template.value)
    },
    routing: {
      ruleProviders: ruleProviderList,
      rules: ruleList
    },
    transforms: {
      filterRegex,
      replacements: replacementList
    },
    override,
    options
  };
}
