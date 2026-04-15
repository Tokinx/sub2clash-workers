import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderConfig } from "../../src/domain/render.js";
import * as subscriptionCache from "../../src/data/subscription-cache.js";
import { encodeBase64UrlText } from "../../src/utils/base64url.js";
import { createEnv } from "../helpers/env.js";

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
});
