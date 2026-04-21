import { describe, expect, it } from "vitest";

import { createEmptyConfig, normalizeConfig } from "@/lib/config.js";

describe("config helpers", () => {
  it("默认订阅项使用 remark 字段", () => {
    expect(createEmptyConfig().sources.subscriptions).toEqual([{ url: "", remark: "" }]);
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
});
