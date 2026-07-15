const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeConfigPayload(config) {
  return bytesToBase64(encoder.encode(JSON.stringify(config)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeConfigPayload(payload) {
  return normalizeConfig(JSON.parse(decoder.decode(base64ToBytes(payload))));
}

export function createEmptyConfig() {
  return {
    target: "meta",
    sources: {
      subscriptions: [{ enabled: true, url: "", remark: "" }],
      nodes: []
    },
    template: {
      mode: "builtin",
      value: "meta-default"
    },
    routing: {
      ruleProviders: [],
      rules: []
    },
    transforms: {
      filterRegex: "",
      replacements: []
    },
    override: {
      type: "yaml",
      content: ""
    },
    options: {
      refresh: false,
      autoTest: false,
      lazy: false,
      sort: "nameasc",
      nodeList: false,
      ignoreCountryGroup: false,
      autoFlag: false,
      userAgent: "",
      useUDP: false
    }
  };
}

export function normalizeConfig(config = {}) {
  const fallback = createEmptyConfig();
  const normalizedOptions = {
    ...fallback.options,
    ...(config.options || {})
  };
  normalizedOptions.autoFlag = normalizedOptions.autoFlag === true;

  const normalizedSubscriptions = Array.isArray(config.sources?.subscriptions)
    ? config.sources.subscriptions.map((item) => ({
        enabled: item?.enabled !== false,
        url: typeof item?.url === "string" ? item.url : "",
        remark:
          typeof item?.remark === "string"
            ? item.remark
            : typeof item?.prefix === "string"
              ? item.prefix
              : ""
      }))
    : fallback.sources.subscriptions;

  const normalizedRuleProviders = Array.isArray(config.routing?.ruleProviders)
    ? config.routing.ruleProviders.map((item) => ({
        enabled: item?.enabled !== false,
        name: typeof item?.name === "string" ? item.name : "",
        group: typeof item?.group === "string" ? item.group : "",
        behavior: typeof item?.behavior === "string" ? item.behavior : "",
        url: typeof item?.url === "string" ? item.url : "",
        prepend: item?.prepend === true
      }))
    : fallback.routing.ruleProviders;

  const normalizedRules = Array.isArray(config.routing?.rules)
    ? config.routing.rules.map((item) => ({
        enabled: item?.enabled !== false,
        value: typeof item?.value === "string" ? item.value : "",
        prepend: item?.prepend === true
      }))
    : fallback.routing.rules;

  const normalizedReplacements = Array.isArray(config.transforms?.replacements)
    ? config.transforms.replacements.map((item) => ({
        enabled: item?.enabled !== false,
        pattern: typeof item?.pattern === "string" ? item.pattern : "",
        replacement: typeof item?.replacement === "string" ? item.replacement : ""
      }))
    : fallback.transforms.replacements;

  return {
    ...fallback,
    ...config,
    sources: {
      ...fallback.sources,
      ...(config.sources || {}),
      subscriptions: normalizedSubscriptions,
      nodes: Array.isArray(config.sources?.nodes) ? config.sources.nodes : fallback.sources.nodes
    },
    template: {
      ...fallback.template,
      ...(config.template || {})
    },
    routing: {
      ...fallback.routing,
      ...(config.routing || {}),
      ruleProviders: normalizedRuleProviders,
      rules: normalizedRules
    },
    transforms: {
      ...fallback.transforms,
      ...(config.transforms || {}),
      replacements: normalizedReplacements
    },
    override: {
      ...fallback.override,
      ...(config.override || {})
    },
    options: {
      ...normalizedOptions
    }
  };
}
