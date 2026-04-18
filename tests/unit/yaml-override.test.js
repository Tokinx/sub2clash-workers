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
});
