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
      { enabled: true, url: "https://example.com/sub", remark: "" }
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
      { enabled: true, url: "https://example.com/sub", remark: "旧前缀" }
    ]);
  });

  it("历史表格行缺少 enabled 时默认开启", () => {
    const payload = createValidPayload();
    payload.routing.ruleProviders = [
      {
        name: "历史 Provider",
        behavior: "domain",
        url: "https://rules.example.com/legacy.yaml",
        group: "节点选择",
        prepend: false
      }
    ];
    payload.routing.rules = [{ value: "DOMAIN-SUFFIX,legacy.example,DIRECT", prepend: false }];
    payload.transforms.replacements = [{ pattern: "旧", replacement: "新" }];

    const config = validateAndNormalizeConfig(payload);

    expect(config.sources.subscriptions[0].enabled).toBe(true);
    expect(config.routing.ruleProviders[0].enabled).toBe(true);
    expect(config.routing.rules[0].enabled).toBe(true);
    expect(config.transforms.replacements[0].enabled).toBe(true);
  });

  it("关闭行可保留不完整内容且不会参与有效来源判断", () => {
    const payload = createValidPayload();
    payload.sources = {
      subscriptions: [{ enabled: false, url: "", remark: "暂时停用" }],
      nodes: ["ss://placeholder"]
    };
    payload.routing = {
      ruleProviders: [{ enabled: false, name: "", behavior: "", url: "", group: "" }],
      rules: [{ enabled: false, value: "" }]
    };
    payload.transforms = {
      filterRegex: "",
      replacements: [{ enabled: false, pattern: "", replacement: "" }]
    };

    const config = validateAndNormalizeConfig(payload);

    expect(config.sources.subscriptions).toEqual([
      { enabled: false, url: "", remark: "暂时停用" }
    ]);
    expect(config.routing.ruleProviders[0]).toEqual({
      enabled: false,
      name: "",
      behavior: "domain",
      url: "",
      group: "",
      prepend: false
    });
    expect(config.routing.rules[0]).toEqual({ enabled: false, value: "", prepend: false });
    expect(config.transforms.replacements[0]).toEqual({
      enabled: false,
      pattern: "",
      replacement: ""
    });
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
