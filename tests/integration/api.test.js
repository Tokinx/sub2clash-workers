import { describe, expect, it, vi } from "vitest";

import app from "../../src/index.js";
import { encodeBase64UrlText } from "../../src/utils/base64url.js";
import { createEnv } from "../helpers/env.js";

async function login(env) {
  const response = await app.request(
    "https://app.example.com/api/auth/login",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ password: "test-password" })
    },
    env
  );
  return response.headers.get("set-cookie");
}

describe("worker api", () => {
  it("未登录访问受保护接口返回 401", async () => {
    const env = createEnv();
    const response = await app.request("https://app.example.com/api/templates", {}, env);
    expect(response.status).toBe(401);

    const refreshResponse = await app.request(
      "https://app.example.com/api/subscriptions/refresh",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://sub.example.com/config" })
      },
      env
    );
    expect(refreshResponse.status).toBe(401);
  });

  it("拒绝通过手动刷新接口处理同域订阅", async () => {
    const env = createEnv();
    const cookie = await login(env);
    const response = await app.request(
      "https://app.example.com/api/subscriptions/refresh",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://app.example.com/s/local-link" })
      },
      env
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("同域订阅");
  });

  it("可以登录、管理模板、生成短链并输出订阅", async () => {
    const env = createEnv();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));

    const cookie = await login(env);

    const templateResponse = await app.request(
      "https://app.example.com/api/templates",
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: "自建模板",
          target: "meta",
          content:
            "mixed-port: 7890\nallow-lan: true\nmode: Rule\nproxies: []\nproxy-groups:\n  - name: 节点选择\n    type: select\n    proxies:\n      - <all>\nrules:\n  - MATCH,节点选择\n"
        })
      },
      env
    );
    expect(templateResponse.status).toBe(201);
    const createdTemplate = await templateResponse.json();

    const linkResponse = await app.request(
      "https://app.example.com/api/links",
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          customId: "manual-id",
          remark: "  家庭设备主订阅  ",
          config: {
            target: "meta",
            sources: {
              subscriptions: [],
              nodes: [
                "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#SS-Node"
              ]
            },
            template: {
              mode: "custom",
              value: createdTemplate.id
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
              content: "rules+:\n  - DOMAIN-SUFFIX,example.com,DIRECT\n"
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
          }
        })
      },
      env
    );

    expect(linkResponse.status).toBe(201);
    const link = await linkResponse.json();
    expect(link.id).not.toBe("manual-id");
    expect(link.id).toHaveLength(20);
    expect(link.remark).toBe("家庭设备主订阅");

    const linksResponse = await app.request(
      "https://app.example.com/api/links",
      {
        headers: { cookie }
      },
      env
    );
    expect(linksResponse.status).toBe(200);
    const linksData = await linksResponse.json();
    expect(linksData.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: link.id,
          remark: "家庭设备主订阅",
          createdAt: link.createdAt,
          updatedAt: link.updatedAt
        })
      ])
    );
    expect(linksData.links[0]).not.toHaveProperty("config");

    const updateLinkResponse = await app.request(
      `https://app.example.com/api/links/${link.id}`,
      {
        method: "PUT",
        headers: {
          cookie,
          "content-type": "application/json"
        },
        body: JSON.stringify({ config: link.config, remark: "平板备用订阅" })
      },
      env
    );
    expect(updateLinkResponse.status).toBe(200);
    expect((await updateLinkResponse.json()).remark).toBe("平板备用订阅");

    const invalidRemarkResponse = await app.request(
      "https://app.example.com/api/links",
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json"
        },
        body: JSON.stringify({ config: link.config, remark: "备".repeat(101) })
      },
      env
    );
    expect(invalidRemarkResponse.status).toBe(400);

    const renderApiResponse = await app.request(
      "https://app.example.com/api/render",
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          target: "meta",
          sources: {
            subscriptions: [],
            nodes: [
              "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#RenderNode"
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
            content: "mixed-port!: 9091\n"
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
        })
      },
      env
    );
    expect(renderApiResponse.status).toBe(200);
    const renderData = await renderApiResponse.json();
    expect(renderData.yaml).toContain("mixed-port: 9091");

    const renderResponse = await app.request(
      "https://app.example.com/s/" + link.id,
      {},
      env
    );
    expect(renderResponse.status).toBe(200);
    const yaml = await renderResponse.text();
    expect(yaml).toContain("SS-Node");
    expect(yaml).toContain("节点选择");
    expect(yaml).toContain("DOMAIN-SUFFIX,example.com,DIRECT");

    vi.unstubAllGlobals();
  });

  it("可以手动刷新单个外部订阅并立即失效短链 YAML 缓存", async () => {
    const env = createEnv();
    const cookie = await login(env);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#OldNode", {
          headers: { "subscription-userinfo": "upload=1; total=10" }
        })
      )
      .mockResolvedValueOnce(
        new Response("ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#NewNode", {
          headers: { "subscription-userinfo": "upload=2; total=10" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const linkResponse = await app.request(
      "https://app.example.com/api/links",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          remark: "缓存测试",
          config: {
            target: "meta",
            sources: {
              subscriptions: [{ enabled: true, url: "https://sub.example.com/config", remark: "测试源" }],
              nodes: []
            },
            template: { mode: "builtin", value: "meta-default" },
            routing: { ruleProviders: [], rules: [] },
            transforms: { filterRegex: "", replacements: [] },
            override: { type: "yaml", content: "" },
            options: {
              sort: "nameasc",
              autoTest: false,
              lazy: false,
              refresh: false,
              nodeList: false,
              ignoreCountryGroup: false,
              userAgent: "cache-tester",
              useUDP: false
            }
          }
        })
      },
      env
    );
    const link = await linkResponse.json();

    const first = await app.request(`https://app.example.com/s/${link.id}`, {}, env);
    expect(await first.text()).toContain("OldNode");
    expect(first.headers.get("subscription-userinfo")).toContain("upload=1");

    const second = await app.request(`https://app.example.com/s/${link.id}`, {}, env);
    expect(await second.text()).toContain("OldNode");
    expect(second.headers.get("subscription-userinfo")).toContain("upload=1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const refreshResponse = await app.request(
      "https://app.example.com/api/subscriptions/refresh",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://sub.example.com/config", userAgent: "cache-tester" })
      },
      env
    );
    expect(refreshResponse.status).toBe(200);
    expect(await refreshResponse.json()).toMatchObject({ ok: true, invalidatedLinkCount: 1 });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache: "no-store" });

    const third = await app.request(`https://app.example.com/s/${link.id}`, {}, env);
    expect(await third.text()).toContain("NewNode");
    expect(third.headers.get("subscription-userinfo")).toContain("upload=2");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it("短链开启强制刷新后不会读取或写入最终 YAML 缓存", async () => {
    const env = createEnv();
    const cookie = await login(env);
    const fetchMock = vi.fn(async () =>
      new Response("ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#FreshNode")
    );
    vi.stubGlobal("fetch", fetchMock);

    const linkResponse = await app.request(
      "https://app.example.com/api/links",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          config: {
            target: "meta",
            sources: {
              subscriptions: [{ url: "https://fresh.example.com/config", remark: "" }],
              nodes: []
            },
            template: { mode: "builtin", value: "meta-default" },
            routing: { ruleProviders: [], rules: [] },
            transforms: { filterRegex: "", replacements: [] },
            options: {
              sort: "nameasc",
              refresh: true,
              nodeList: false,
              userAgent: "",
              useUDP: false
            }
          }
        })
      },
      env
    );
    const link = await linkResponse.json();

    const first = await app.request(`https://app.example.com/s/${link.id}`, {}, env);
    expect(first.headers.get("cache-control")).toBe("no-store");
    await app.request(`https://app.example.com/s/${link.id}`, {}, env);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await env.CACHE.get(`cache:link-yaml:${link.id}`)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("订阅输出设置边缘缓存头，refresh 请求不缓存", async () => {
    const env = createEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#CachedNode"))
    );

    const buildConfig = (refresh) => ({
      target: "meta",
      sources: {
        subscriptions: [{ enabled: true, url: "https://sub.example.com/config", remark: "" }],
        nodes: []
      },
      template: { mode: "builtin", value: "meta-default" },
      routing: { ruleProviders: [], rules: [] },
      transforms: { filterRegex: "", replacements: [] },
      override: { type: "yaml", content: "" },
      options: {
        sort: "nameasc",
        refresh,
        nodeList: false,
        userAgent: "",
        useUDP: false
      }
    });

    const normalPayload = encodeBase64UrlText(JSON.stringify(buildConfig(false)));
    const normal = await app.request(`https://app.example.com/sub/${normalPayload}`, {}, env);
    expect(normal.status).toBe(200);
    expect(normal.headers.get("cache-control")).toBe("public, s-maxage=21600");

    const refreshPayload = encodeBase64UrlText(JSON.stringify(buildConfig(true)));
    const refresh = await app.request(`https://app.example.com/sub/${refreshPayload}`, {}, env);
    expect(refresh.status).toBe(200);
    expect(refresh.headers.get("cache-control")).toBe("no-store");

    vi.unstubAllGlobals();
  });

  it("短链输出设置边缘缓存头，缓存命中响应同样携带", async () => {
    const env = createEnv();
    const cookie = await login(env);
    const fetchMock = vi.fn(async () =>
      new Response("ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#EdgeNode")
    );
    vi.stubGlobal("fetch", fetchMock);

    const linkResponse = await app.request(
      "https://app.example.com/api/links",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          remark: "边缘缓存测试",
          config: {
            target: "meta",
            sources: {
              subscriptions: [{ enabled: true, url: "https://edge.example.com/config", remark: "" }],
              nodes: []
            },
            template: { mode: "builtin", value: "meta-default" },
            routing: { ruleProviders: [], rules: [] },
            transforms: { filterRegex: "", replacements: [] },
            options: {
              sort: "nameasc",
              refresh: false,
              nodeList: false,
              userAgent: "",
              useUDP: false
            }
          }
        })
      },
      env
    );
    const link = await linkResponse.json();

    const first = await app.request(`https://app.example.com/s/${link.id}`, {}, env);
    expect(first.headers.get("cache-control")).toBe("public, s-maxage=300");

    const second = await app.request(`https://app.example.com/s/${link.id}`, {}, env);
    expect(second.status).toBe(200);
    expect(second.headers.get("cache-control")).toBe("public, s-maxage=300");
    expect(await second.text()).toContain("EdgeNode");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("登录连续失败触发限速，成功登录清除计数", async () => {
    const env = createEnv();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await app.request(
        "https://app.example.com/api/auth/login",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: "wrong-password" })
        },
        env
      );
      expect(response.status).toBe(401);
    }

    const blocked = await app.request(
      "https://app.example.com/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-password" })
      },
      env
    );
    expect(blocked.status).toBe(429);

    // 更换来源 IP 后计数独立，可正常登录
    const otherIp = await app.request(
      "https://app.example.com/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" },
        body: JSON.stringify({ password: "test-password" })
      },
      env
    );
    expect(otherIp.status).toBe(200);
  }, 20000);

  it("超长订阅 payload 与超量规则被拒绝", async () => {
    const env = createEnv();

    const oversized = await app.request(
      `https://app.example.com/sub/${"A".repeat(33 * 1024)}`,
      {},
      env
    );
    expect(oversized.status).toBe(400);
    expect((await oversized.json()).error).toContain("过长");

    const invalid = await app.request("https://app.example.com/sub/!!!not-base64!!!", {}, env);
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toContain("无效");

    const config = {
      target: "meta",
      sources: { subscriptions: [], nodes: ["ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#N"] },
      template: { mode: "builtin", value: "meta-default" },
      routing: {
        ruleProviders: [],
        rules: Array.from({ length: 51 }, (_, index) => ({
          value: `DOMAIN-SUFFIX,site${index}.example,DIRECT`
        }))
      },
      transforms: { filterRegex: "", replacements: [] },
      options: { sort: "nameasc" }
    };
    const tooManyRules = await app.request(
      `https://app.example.com/sub/${encodeBase64UrlText(JSON.stringify(config))}`,
      {},
      env
    );
    expect(tooManyRules.status).toBe(400);
    expect((await tooManyRules.json()).error).toContain("规则数量");
  });

  it("未知 API 路径返回 404 JSON，API 响应不缓存", async () => {
    const env = createEnv();
    const cookie = await login(env);
    const response = await app.request(
      "https://app.example.com/api/not-exist",
      { headers: { cookie } },
      env
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).error).toBe("接口不存在");
  });
});
