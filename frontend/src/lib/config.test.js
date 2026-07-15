import { describe, expect, it } from "vitest";

import { createEmptyConfig, normalizeConfig } from "@/lib/config.js";

describe("config helpers", () => {
  it("默认订阅项使用 remark 字段", () => {
    expect(createEmptyConfig().sources.subscriptions).toEqual([{ enabled: true, url: "", remark: "" }]);
    expect(createEmptyConfig().options.autoFlag).toBe(false);
  });

  it("导入旧配置时会把 prefix 归一化为 remark", () => {
    const config = normalizeConfig({
      sources: {
        subscriptions: [{ url: "https://example.com/sub", prefix: "历史前缀" }],
        nodes: []
      }
    });

    expect(config.sources.subscriptions).toEqual([
      { enabled: true, url: "https://example.com/sub", remark: "历史前缀" }
    ]);
  });

  it("导入配置时会归一化所有表格的行级开关", () => {
    const config = normalizeConfig({
      sources: {
        subscriptions: [{ url: "https://example.com/sub", enabled: false }],
        nodes: []
      },
      routing: {
        ruleProviders: [
          { name: "provider", group: "节点选择", behavior: "domain", url: "https://example.com/rules.yaml" }
        ],
        rules: [{ value: "MATCH,DIRECT", enabled: false }]
      },
      transforms: {
        replacements: [{ pattern: "旧名称", replacement: "新名称" }]
      }
    });

    expect(config.sources.subscriptions[0].enabled).toBe(false);
    expect(config.routing.ruleProviders[0].enabled).toBe(true);
    expect(config.routing.rules[0].enabled).toBe(false);
    expect(config.transforms.replacements[0].enabled).toBe(true);
  });

  it("导入配置时仅布尔 true 会开启自动添加旗帜", () => {
    expect(normalizeConfig({ options: { autoFlag: true } }).options.autoFlag).toBe(true);
    expect(normalizeConfig({ options: { autoFlag: "false" } }).options.autoFlag).toBe(false);
  });
});
