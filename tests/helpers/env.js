export const CLASH_TEMPLATE = `mixed-port: 7890
allow-lan: true
mode: Rule
proxies: []
proxy-groups:
  - name: 节点选择
    type: select
    proxies:
      - <countries>
      - 手动切换
      - DIRECT
  - name: 手动切换
    type: select
    proxies:
      - <all>
rules:
  - MATCH,节点选择
`;

export const META_TEMPLATE = `mixed-port: 7890
allow-lan: true
mode: Rule
proxies: []
proxy-groups:
  - name: 节点选择
    type: select
    proxies:
      - <countries>
      - 手动切换
      - DIRECT
  - name: 手动切换
    type: select
    proxies:
      - <all>
rules:
  - MATCH,节点选择
`;

class MemoryKV {
  constructor() {
    this.map = new Map();
  }

  async get(key, type) {
    const entry = this.map.get(key);
    if (entry === undefined) {
      return null;
    }
    const value = entry.value;
    if (type === "json") {
      return JSON.parse(value);
    }
    return value;
  }

  async put(key, value, options = {}) {
    this.map.set(key, {
      value: String(value),
      metadata: options.metadata ?? null,
      expirationTtl: options.expirationTtl ?? null
    });
  }

  async delete(key) {
    this.map.delete(key);
  }

  async list(options = {}) {
    const prefix = options.prefix || "";
    const keys = [...this.map.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, entry]) => ({
        name,
        metadata: entry.metadata ?? null
      }));

    return {
      keys,
      list_complete: true,
      cursor: ""
    };
  }
}

export function createAssetsFetcher() {
  return {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/templates/clash-default.yaml") {
        return new Response(CLASH_TEMPLATE);
      }
      if (url.pathname === "/templates/meta-default.yaml") {
        return new Response(META_TEMPLATE);
      }
      return new Response("Not Found", { status: 404 });
    }
  };
}

export function createEnv(overrides = {}) {
  return {
    CACHE: new MemoryKV(),
    ASSETS: createAssetsFetcher(),
    APP_PASSWORD: "test-password",
    SESSION_SECRET: "test-session-secret",
    SESSION_TTL_SECONDS: "2592000",
    SUB_CACHE_TTL_SECONDS: "21600",
    MAX_REMOTE_FILE_SIZE: "1048576",
    ...overrides
  };
}
