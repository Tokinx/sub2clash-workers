import { describe, expect, it } from "vitest";

import { applyYamlOverride } from "../../src/domain/yaml-override.js";

describe("applyYamlOverride", () => {
  it("支持深度合并", () => {
    const result = applyYamlOverride(
      {
        "mixed-port": 7890,
        dns: {
          enable: false,
          nameserver: ["1.1.1.1"]
        }
      },
      "dns:\n  enable: true\n  enhanced-mode: fake-ip\n"
    );

    expect(result).toEqual({
      "mixed-port": 7890,
      dns: {
        enable: true,
        nameserver: ["1.1.1.1"],
        "enhanced-mode": "fake-ip"
      }
    });
  });

  it("支持 ! 覆盖整个字段", () => {
    const result = applyYamlOverride(
      {
        dns: {
          enable: false,
          nameserver: ["1.1.1.1"]
        }
      },
      "dns!:\n  enable: true\n"
    );

    expect(result).toEqual({
      dns: {
        enable: true
      }
    });
  });

  it("支持数组前插和后追加", () => {
    const result = applyYamlOverride(
      {
        rules: ["MATCH,节点选择"]
      },
      "+rules:\n  - DOMAIN-SUFFIX,example.com,DIRECT\nrules+:\n  - GEOIP,private,DIRECT\n"
    );

    expect(result.rules).toEqual([
      "DOMAIN-SUFFIX,example.com,DIRECT",
      "MATCH,节点选择",
      "GEOIP,private,DIRECT"
    ]);
  });

  it("支持转义真实键名", () => {
    const result = applyYamlOverride(
      {
        "proxy-groups+": "raw-key"
      },
      "<proxy-groups+>: replaced\n"
    );

    expect(result).toEqual({
      "proxy-groups+": "replaced"
    });
  });

  it("支持用 $patches 合并命中的数组对象", () => {
    const result = applyYamlOverride(
      {
        proxies: [
          { name: "A | 落地", type: "ss" },
          { name: "B", type: "ss" }
        ]
      },
      `$patches:
  - target: proxies
    op: merge
    match:
      name:
        includes: "| 落地"
    value:
      dialer-proxy: 前置节点
`
    );

    expect(result.proxies).toEqual([
      { name: "A | 落地", type: "ss", "dialer-proxy": "前置节点" },
      { name: "B", type: "ss" }
    ]);
  });

  it("支持 upsert 和 $select", () => {
    const result = applyYamlOverride(
      {
        proxies: [
          { name: "A | 落地", type: "ss" },
          { name: "B", type: "ss" },
          { name: "DIRECT", type: "direct" }
        ],
        "proxy-groups": []
      },
      `$patches:
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
`
    );

    expect(result["proxy-groups"]).toEqual([
      {
        name: "前置节点",
        type: "select",
        proxies: ["B"]
      }
    ]);
  });

  it("支持 remove 删除命中的数组项", () => {
    const result = applyYamlOverride(
      {
        "proxy-groups": [
          { name: "保留" },
          { name: "删除我" }
        ]
      },
      `$patches:
  - target: proxy-groups
    op: remove
    match:
      name: 删除我
`
    );

    expect(result["proxy-groups"]).toEqual([{ name: "保留" }]);
  });

  it("数组操作命中非数组字段时返回 422", () => {
    expect(() =>
      applyYamlOverride(
        {
          mode: "Rule"
        },
        "+mode:\n  - Direct\n"
      )
    ).toThrowError("覆写数组操作仅支持数组字段");
  });

  it("非法 patch target 会返回 422", () => {
    expect(() =>
      applyYamlOverride(
        {
          proxies: []
        },
        `$patches:
  - target: mode
    op: merge
    match:
      name: demo
    value:
      server: example.com
`
      )
    ).toThrowError("patch.target 必须指向数组字段");
  });
});
