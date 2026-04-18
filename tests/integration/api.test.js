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
          createdAt: link.createdAt,
          updatedAt: link.updatedAt
        })
      ])
    );
    expect(linksData.links[0]).not.toHaveProperty("config");

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
});
