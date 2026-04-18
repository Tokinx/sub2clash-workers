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
      subscriptions: [{ url: "", prefix: "" }],
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
      userAgent: "",
      useUDP: false
    }
  };
}

export function normalizeConfig(config = {}) {
  const fallback = createEmptyConfig();

  return {
    ...fallback,
    ...config,
    sources: {
      ...fallback.sources,
      ...(config.sources || {}),
      subscriptions: Array.isArray(config.sources?.subscriptions)
        ? config.sources.subscriptions
        : fallback.sources.subscriptions,
      nodes: Array.isArray(config.sources?.nodes) ? config.sources.nodes : fallback.sources.nodes
    },
    template: {
      ...fallback.template,
      ...(config.template || {})
    },
    routing: {
      ...fallback.routing,
      ...(config.routing || {}),
      ruleProviders: Array.isArray(config.routing?.ruleProviders)
        ? config.routing.ruleProviders
        : fallback.routing.ruleProviders,
      rules: Array.isArray(config.routing?.rules) ? config.routing.rules : fallback.routing.rules
    },
    transforms: {
      ...fallback.transforms,
      ...(config.transforms || {}),
      replacements: Array.isArray(config.transforms?.replacements)
        ? config.transforms.replacements
        : fallback.transforms.replacements
    },
    override: {
      ...fallback.override,
      ...(config.override || {})
    },
    options: {
      ...fallback.options,
      ...(config.options || {})
    }
  };
}
