import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YAML from "yaml";

import { createLink, updateLink } from "../../src/data/link-repository.js";
import { renderConfig, renderLink } from "../../src/domain/render.js";
import * as subscriptionCache from "../../src/data/subscription-cache.js";
import { encodeBase64UrlText } from "../../src/utils/base64url.js";
import { createEnv } from "../helpers/env.js";

function createConfig(overrides = {}) {
  return {
    target: "meta",
    sources: {
      subscriptions: [],
      nodes: [],
      ...(overrides.sources || {})
    },
    template: {
      mode: "builtin",
      value: "meta-default",
      ...(overrides.template || {})
    },
    routing: {
      ruleProviders: [],
      rules: [],
      ...(overrides.routing || {})
    },
    transforms: {
      filterRegex: "",
      replacements: [],
      ...(overrides.transforms || {})
    },
    override: {
      type: "yaml",
      content: "",
      ...(overrides.override || {})
    },
    options: {
      sort: "nameasc",
      autoTest: false,
      lazy: false,
      refresh: false,
      nodeList: false,
      ignoreCountryGroup: false,
      userAgent: "tester",
      useUDP: false,
      ...(overrides.options || {})
    }
  };
}

describe("renderConfig", () => {
  beforeEach(() => {
    vi.spyOn(subscriptionCache, "getCachedSubscription").mockResolvedValue(null);
    vi.spyOn(subscriptionCache, "putCachedSubscription").mockResolvedValue(undefined);
    vi.spyOn(subscriptionCache, "fetchSubscription").mockResolvedValue({
      body: encodeBase64UrlText(
        [
          "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#香港入口",
          "trojan://secret@example.com:443#美国入口"
        ].join("\n")
      ),
      subscriptionUserinfo: "upload=1; download=2; total=3; expire=4"
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("可以合并订阅、规则和国家分组", async () => {
    const env = createEnv();
    const result = await renderConfig(env, new Request("https://app.example.com/"), {
      target: "meta",
      sources: {
        subscriptions: [{ url: "https://sub.example.com/alpha", prefix: "机场A" }],
        nodes: []
      },
      template: {
        mode: "builtin",
        value: "meta-default"
      },
      routing: {
        ruleProviders: [],
        rules: [{ value: "DOMAIN-SUFFIX,claude.ai,节点选择", prepend: true }]
      },
      transforms: {
        filterRegex: "",
        replacements: [{ pattern: "入口", replacement: "专线" }]
      },
      options: {
        sort: "nameasc",
        autoTest: false,
        lazy: false,
        refresh: false,
        nodeList: false,
        ignoreCountryGroup: false,
        userAgent: "tester",
        useUDP: false
      }
    });

    expect(result.subscriptionUserinfo).toContain("upload=");
    expect(result.yaml).toContain("机场A 香港专线");
    expect(result.yaml).toContain("机场A 美国专线");
    expect(result.yaml).toContain("DOMAIN-SUFFIX,claude.ai,节点选择");
    expect(result.stats.proxyCount).toBe(2);
  });

  it("在 clash 目标下会剔除 meta only 协议", async () => {
    const env = createEnv();
    const result = await renderConfig(env, new Request("https://app.example.com/"), {
      target: "clash",
      sources: {
        subscriptions: [],
        nodes: [
          "vless://12345678-1234-1234-1234-1234567890ab@example.com:443?type=ws&security=tls&host=example.com&path=%2Fws#MetaOnly",
          "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#ClashOK"
        ]
      },
      template: {
        mode: "builtin",
        value: "clash-default"
      },
      routing: {
        ruleProviders: [],
        rules: []
      },
      transforms: {
        filterRegex: "",
        replacements: []
      },
      options: {
        sort: "nameasc",
        autoTest: false,
        lazy: false,
        refresh: false,
        nodeList: true,
        ignoreCountryGroup: false,
        userAgent: "tester",
        useUDP: false
      }
    });

    expect(result.yaml).toContain("ClashOK");
    expect(result.yaml).not.toContain("MetaOnly");
    expect(result.stats.proxyCount).toBe(1);
  });

  it("内置模板不应被 ASSETS 的 SPA fallback 污染", async () => {
    const env = createEnv({
      ASSETS: {
        async fetch() {
          return new Response("<!doctype html><html><body>index</body></html>", {
            headers: {
              "content-type": "text/html; charset=utf-8"
            }
          });
        }
      }
    });

    const result = await renderConfig(env, new Request("https://app.example.com/sub/demo"), {
      target: "meta",
      sources: {
        subscriptions: [],
        nodes: [
          "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#BuiltinSafe"
        ]
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
      options: {
        sort: "nameasc",
        autoTest: false,
        lazy: false,
        refresh: false,
        nodeList: false,
        ignoreCountryGroup: false,
        userAgent: "tester",
        useUDP: false
      }
    });

    expect(result.yaml).toContain("BuiltinSafe");
    expect(result.yaml).toContain("proxy-groups:");
    expect(result.yaml).not.toContain("<!doctype html>");
  });

  it("覆写会在模板合并之后最终生效", async () => {
    const env = createEnv();

    const result = await renderConfig(env, new Request("https://app.example.com/sub/demo"), {
      target: "meta",
      sources: {
        subscriptions: [],
        nodes: ["ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#OverrideNode"]
      },
      template: {
        mode: "builtin",
        value: "meta-default"
      },
      routing: {
        ruleProviders: [],
        rules: [{ value: "DOMAIN-SUFFIX,claude.ai,节点选择", prepend: true }]
      },
      transforms: {
        filterRegex: "",
        replacements: []
      },
      override: {
        type: "yaml",
        content: "rules!:\n  - MATCH,DIRECT\n"
      },
      options: {
        sort: "nameasc",
        autoTest: false,
        lazy: false,
        refresh: false,
        nodeList: false,
        ignoreCountryGroup: false,
        userAgent: "tester",
        useUDP: false
      }
    });

    expect(result.yaml).toContain("MATCH,DIRECT");
    expect(result.yaml).not.toContain("DOMAIN-SUFFIX,claude.ai,节点选择");
    expect(result.yaml).not.toContain("GEOSITE,openai,OpenAI");
  });

  it("扩展覆写语法可以表达前置节点和 dialer-proxy 场景", async () => {
    const env = createEnv();

    const result = await renderConfig(env, new Request("https://app.example.com/sub/demo"), {
      target: "meta",
      sources: {
        subscriptions: [],
        nodes: [
          "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#香港A | 落地",
          "trojan://secret@example.com:443#美国B"
        ]
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
        content: `$patches:
  - target: proxy-groups
    op: upsert
    position: start
    match:
      name: 前置节点
    value:
      name: 前置节点
      type: select
      proxies:
        $select:
          from: proxies
          field: name
          where:
            name:
              notIn:
                - DIRECT
                - REJECT
              notIncludes: "| 落地"
  - target: proxies
    op: merge
    match:
      name:
        includes: "| 落地"
    value:
      dialer-proxy: 前置节点
+rules:
  - DOMAIN-SUFFIX,30420400.xyz,DIRECT
`
      },
      options: {
        sort: "nameasc",
        autoTest: false,
        lazy: false,
        refresh: false,
        nodeList: false,
        ignoreCountryGroup: false,
        userAgent: "tester",
        useUDP: false
      }
    });

    const parsed = YAML.parse(result.yaml);
    const preGroup = parsed["proxy-groups"].find((group) => group.name === "前置节点");

    expect(preGroup).toEqual({
      name: "前置节点",
      type: "select",
      proxies: ["美国B"]
    });
    expect(result.yaml).toContain("dialer-proxy: 前置节点");
    expect(result.yaml).toContain("DOMAIN-SUFFIX,30420400.xyz,DIRECT");
  });

  it("覆写新增的 proxy-group 也会展开 <all> 占位符", async () => {
    const env = createEnv();

    const result = await renderConfig(env, new Request("https://app.example.com/sub/demo"), {
      target: "meta",
      sources: {
        subscriptions: [],
        nodes: [
          "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#节点甲",
          "trojan://secret@example.com:443#节点乙"
        ]
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
        content: `$patches:
  - target: proxy-groups
    op: upsert
    position: end
    match:
      name: 全部节点
    value:
      name: 全部节点
      type: select
      proxies:
        - <all>
`
      },
      options: {
        sort: "nameasc",
        autoTest: false,
        lazy: false,
        refresh: false,
        nodeList: false,
        ignoreCountryGroup: false,
        userAgent: "tester",
        useUDP: false
      }
    });

    const parsed = YAML.parse(result.yaml);
    const allGroup = parsed["proxy-groups"].find((group) => group.name === "全部节点");

    expect(allGroup).toEqual({
      name: "全部节点",
      type: "select",
      proxies: ["节点甲", "节点乙"]
    });
    expect(result.yaml).not.toContain("- <all>");
  });

  it("nodeList 模式会忽略覆写并返回 warning", async () => {
    const env = createEnv();

    const result = await renderConfig(env, new Request("https://app.example.com/sub/demo"), {
      target: "meta",
      sources: {
        subscriptions: [],
        nodes: ["ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#NodeOnly"]
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
        content: "proxies!:\n  - name: 覆写节点\n"
      },
      options: {
        sort: "nameasc",
        autoTest: false,
        lazy: false,
        refresh: false,
        nodeList: true,
        ignoreCountryGroup: false,
        userAgent: "tester",
        useUDP: false
      }
    });

    expect(result.warnings).toEqual(["仅输出节点列表时已忽略覆写"]);
    expect(result.yaml).toContain("NodeOnly");
    expect(result.yaml).not.toContain("覆写节点");
  });

  it("同域短链订阅会在 Worker 内部解析而不是再次远程抓取", async () => {
    const env = createEnv();
    const first = await createLink(
      env,
      createConfig({
        sources: {
          subscriptions: [],
          nodes: ["ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#Alpha"]
        }
      })
    );
    const second = await createLink(
      env,
      createConfig({
        sources: {
          subscriptions: [],
          nodes: ["trojan://secret@example.com:443#Beta"]
        }
      })
    );

    const result = await renderConfig(
      env,
      new Request("https://app.example.com/sub/demo"),
      createConfig({
        sources: {
          subscriptions: [
            { url: `https://app.example.com/s/${first.id}`, prefix: "节点A" },
            { url: `https://app.example.com/s/${second.id}`, prefix: "节点B" }
          ],
          nodes: []
        }
      })
    );

    expect(result.yaml).toContain("节点A Alpha");
    expect(result.yaml).toContain("节点B Beta");
    expect(subscriptionCache.fetchSubscription).not.toHaveBeenCalled();
  });

  it("同域短链循环引用会直接返回 422", async () => {
    const env = createEnv();
    const linkA = await createLink(
      env,
      createConfig({
        sources: {
          subscriptions: [],
          nodes: ["ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#SeedA"]
        }
      })
    );
    const linkB = await createLink(
      env,
      createConfig({
        sources: {
          subscriptions: [{ url: `https://app.example.com/s/${linkA.id}`, prefix: "B" }],
          nodes: []
        }
      })
    );

    await updateLink(
      env,
      linkA.id,
      createConfig({
        sources: {
          subscriptions: [{ url: `https://app.example.com/s/${linkB.id}`, prefix: "A" }],
          nodes: []
        }
      })
    );

    await expect(
      renderLink(env, new Request(`https://app.example.com/s/${linkA.id}`), linkA.id)
    ).rejects.toMatchObject({
      status: 422,
      message: "检测到订阅链接循环引用",
      details: `https://app.example.com/s/${linkA.id}`
    });
    expect(subscriptionCache.fetchSubscription).not.toHaveBeenCalled();
  });
});
