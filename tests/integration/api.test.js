import { describe, expect, it, vi } from "vitest";

import app from "../../src/index.js";
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

    await app.request(`https://app.example.com/s/${link.id}`, {}, env);
    await app.request(`https://app.example.com/s/${link.id}`, {}, env);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await env.CACHE.get(`cache:link-yaml:${link.id}`)).toBeNull();
    vi.unstubAllGlobals();
  });
});
