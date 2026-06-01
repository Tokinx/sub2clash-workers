import { describe, expect, it } from "vitest";

import { validateAndNormalizeConfig } from "../../src/domain/config.js";

function createValidPayload(options = {}) {
  return {
    target: "meta",
    sources: {
      subscriptions: [{ url: "https://example.com/sub" }],
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
    options
  };
}

describe("validateAndNormalizeConfig", () => {
  it("默认不注入 User-Agent", () => {
    const config = validateAndNormalizeConfig({
      target: "meta",
      sources: {
        subscriptions: [{ url: "https://example.com/sub" }],
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
      options: {}
    });

    expect(config.options.userAgent).toBe("");
    expect(config.options.autoFlag).toBe(false);
    expect(config.sources.subscriptions).toEqual([
      { url: "https://example.com/sub", remark: "" }
    ]);
    expect(config.override).toEqual({
      type: "yaml",
      content: ""
    });
  });

  it("兼容历史 prefix 字段并归一化为 remark", () => {
    const config = validateAndNormalizeConfig({
      target: "meta",
      sources: {
        subscriptions: [{ url: "https://example.com/sub", prefix: "旧前缀" }],
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
      options: {}
    });

    expect(config.sources.subscriptions).toEqual([
      { url: "https://example.com/sub", remark: "旧前缀" }
    ]);
  });

  it("仅布尔 true 会开启自动添加旗帜", () => {
    expect(validateAndNormalizeConfig(createValidPayload({ autoFlag: true })).options.autoFlag).toBe(true);
    expect(validateAndNormalizeConfig(createValidPayload({ autoFlag: "false" })).options.autoFlag).toBe(false);
  });

  it("仅接受 yaml 类型的 override", () => {
    expect(() =>
      validateAndNormalizeConfig({
        target: "meta",
        sources: {
          subscriptions: [{ url: "https://example.com/sub" }],
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
          type: "javascript",
          content: "main = () => ({})"
        },
        options: {}
      })
    ).toThrowError("override.type 仅支持 yaml");
  });
});
