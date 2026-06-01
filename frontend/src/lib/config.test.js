import { describe, expect, it } from "vitest";

import { createEmptyConfig, normalizeConfig } from "@/lib/config.js";

describe("config helpers", () => {
  it("默认订阅项使用 remark 字段", () => {
    expect(createEmptyConfig().sources.subscriptions).toEqual([{ url: "", remark: "" }]);
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
      { url: "https://example.com/sub", remark: "历史前缀" }
    ]);
  });

  it("导入配置时仅布尔 true 会开启自动添加旗帜", () => {
    expect(normalizeConfig({ options: { autoFlag: true } }).options.autoFlag).toBe(true);
    expect(normalizeConfig({ options: { autoFlag: "false" } }).options.autoFlag).toBe(false);
  });
});
