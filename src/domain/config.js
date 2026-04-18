import { badRequest } from "../utils/errors.js";

const DEFAULT_OPTIONS = {
  refresh: false,
  autoTest: false,
  lazy: false,
  sort: "nameasc",
  nodeList: false,
  ignoreCountryGroup: false,
  userAgent: "",
  useUDP: false
};

const VALID_SORTS = new Set(["nameasc", "namedesc", "sizeasc", "sizedesc"]);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
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
    if (!item || typeof item !== "object" || !item.url) {
      throw badRequest("订阅地址格式错误");
    }
    let url;
    try {
      url = new URL(item.url);
    } catch {
      throw badRequest("订阅地址格式错误");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw badRequest("订阅地址仅支持 http/https");
    }
    return {
      url: url.toString(),
      prefix: typeof item.prefix === "string" ? item.prefix.trim() : ""
    };
  });

  const nodes = ensureArray(input.sources?.nodes)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (subscriptions.length === 0 && nodes.length === 0) {
    throw badRequest("subscriptions 和 nodes 不能同时为空");
  }

  const template = input.template || {};
  if (!["builtin", "custom"].includes(template.mode) || !template.value) {
    throw badRequest("template 配置无效");
  }

  const ruleProviders = ensureArray(input.routing?.ruleProviders).map((provider) => {
    if (!provider?.name || !provider?.url || !provider?.group) {
      throw badRequest("rule provider 配置不完整");
    }
    return {
      name: String(provider.name).trim(),
      behavior: String(provider.behavior || "domain").trim(),
      url: String(provider.url).trim(),
      group: String(provider.group).trim(),
      prepend: Boolean(provider.prepend)
    };
  });

  const names = new Set();
  for (const provider of ruleProviders) {
    if (names.has(provider.name)) {
      throw badRequest("rule provider 名称不能重复");
    }
    names.add(provider.name);
  }

  const rules = ensureArray(input.routing?.rules).map((rule) => {
    if (!rule?.value) {
      throw badRequest("规则内容不能为空");
    }
    return {
      value: String(rule.value).trim(),
      prepend: Boolean(rule.prepend)
    };
  });

  const replacements = ensureArray(input.transforms?.replacements).map((item) => {
    if (!item?.pattern) {
      throw badRequest("替换规则 pattern 不能为空");
    }
    return {
      pattern: String(item.pattern),
      replacement: String(item.replacement || "")
    };
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

    override = {
      type: "yaml",
      content: String(input.override.content || "")
    };
  }

  if (!VALID_SORTS.has(options.sort)) {
    options.sort = DEFAULT_OPTIONS.sort;
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
      ruleProviders,
      rules
    },
    transforms: {
      filterRegex: String(input.transforms?.filterRegex || ""),
      replacements
    },
    override,
    options
  };
}
