import { describe, expect, it } from "vitest";

import { parseProxyLink, parseSubscriptionBody } from "../../src/domain/parsers/index.js";

const PLACEHOLDER_SS2022_PSK = "cGxhY2Vob2xkZXItc2luZ2xlLWtleQ==";
const PLACEHOLDER_SS2022_UPSK = "cGxhY2Vob2xkZXItdXBzaw==";
const PLACEHOLDER_SS2022_IPSK = "cGxhY2Vob2xkZXItaXBzaw==";
const PLACEHOLDER_HY2_PASSWORD = "cGxhY2Vob2xkZXItaHkyLXBhc3M=";
const PLACEHOLDER_HY2_OBFS_PASSWORD = "cGxhY2Vob2xkZXItaHkyLW9iZnM=";
const PLACEHOLDER_WG_PRIVATE_KEY = "cHJpdmF0ZS1rZXktcGxhY2Vob2xkZXI=";
const PLACEHOLDER_WG_PUBLIC_KEY = "cHVibGljLWtleS1wbGFjZWhvbGRlcg==";
const PLACEHOLDER_WG_PRESHARED_KEY = "cHJlc2hhcmVkLWtleS1wbGFjZWhvbGRlcg==";

function encodeBase64(text) {
  return Buffer.from(text).toString("base64");
}

describe("协议解析器", () => {
  const cases = [
    ["ss", "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#SS", "ss"],
    ["ssr", "ssr://ZXhhbXBsZS5jb206ODM4ODphdXRoX2FlczEyOF9tZDU6YWVzLTI1Ni1nY206cGxhaW46Y0dGemN3Lz9yZW1hcmtzPVUxTlM", "ssr"],
    [
      "vmess",
      "vmess://eyJ2IjoiMiIsInBzIjoiVk1lc3MiLCJhZGQiOiJleGFtcGxlLmNvbSIsInBvcnQiOiI0NDMiLCJpZCI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTEyMzQ1Njc4OTBhYiIsImFpZCI6IjAiLCJzY3kiOiJhdXRvIiwibmV0Ijoid3MiLCJ0eXBlIjoiIiwiaG9zdCI6ImV4YW1wbGUuY29tIiwicGF0aCI6Ii93cyIsInRscyI6InRscyJ9",
      "vmess"
    ],
    ["vless", "vless://12345678-1234-1234-1234-1234567890ab@example.com:443?type=ws&security=tls&host=example.com&path=%2Fws#VLESS", "vless"],
    ["trojan", "trojan://secret@example.com:443?type=ws&host=example.com&path=%2Ftrojan#Trojan", "trojan"],
    ["hysteria", "hysteria://example.com:443?upmbps=20&downmbps=100&obfs=salamander#Hysteria", "hysteria"],
    ["hysteria2", "hysteria2://password@example.com:443?sni=example.com#Hysteria2", "hysteria2"],
    ["socks5", "socks5://user:pass@example.com:1080#Socks", "socks5"],
    ["anytls", "anytls://password@example.com:443?sni=example.com#AnyTLS", "anytls"],
    ["ssh", "ssh://demo-user:demo-pass@example.com:22#SSH", "ssh"],
    ["snell", "snell://placeholder-psk@example.com:44046?version=3#Snell", "snell"],
    ["wireguard", `wireguard://${PLACEHOLDER_WG_PRIVATE_KEY}@example.com:51820?public-key=${encodeURIComponent(PLACEHOLDER_WG_PUBLIC_KEY)}&ip=172.16.0.2%2F32#WireGuard`, "wireguard"]
  ];

  it.each(cases)("可以解析 %s 分享链接", (_, source, expectedType) => {
    const proxy = parseProxyLink(source, { useUDP: true });
    expect(proxy.type).toBe(expectedType);
    expect(proxy.name).not.toBe("");
  });

  it("页面未开启 UDP 时，不主动写入 udp: false", () => {
    const proxy = parseProxyLink("ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#SS", { useUDP: false });

    expect(proxy).not.toHaveProperty("udp");
  });

  it("页面开启 UDP 时，会显式写入 udp: true", () => {
    const proxy = parseProxyLink("ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#SS", { useUDP: true });

    expect(proxy.udp).toBe(true);
  });

  it("链接里显式携带 udp 参数时，保留其布尔值", () => {
    const enabled = parseProxyLink("vless://12345678-1234-1234-1234-1234567890ab@example.com:443?type=ws&security=tls&host=example.com&path=%2Fws&udp=1#VLESS", { useUDP: false });
    const disabled = parseProxyLink("vless://12345678-1234-1234-1234-1234567890ab@example.com:443?type=ws&security=tls&host=example.com&path=%2Fws&udp=false#VLESS", { useUDP: false });

    expect(enabled.udp).toBe(true);
    expect(disabled.udp).toBe(false);
  });

  it("ss-2022 密码保持 base64 原样，不做二次解码", () => {
    const proxy = parseProxyLink(`ss://2022-blake3-aes-256-gcm:${encodeURIComponent(PLACEHOLDER_SS2022_PSK)}@example.com:20507#SS2022`, { useUDP: false });

    expect(proxy.cipher).toBe("2022-blake3-aes-256-gcm");
    expect(proxy.password).toBe(PLACEHOLDER_SS2022_PSK);
  });

  it("ss-2022 使用 base64(method:password) 形式时保留双段 key", () => {
    const encodedUserInfo = encodeBase64(`2022-blake3-aes-256-gcm:${PLACEHOLDER_SS2022_UPSK}:${PLACEHOLDER_SS2022_IPSK}`);
    const proxy = parseProxyLink(`ss://${encodedUserInfo}@example.com:1043#SS2022-Double`, { useUDP: false });

    expect(proxy.cipher).toBe("2022-blake3-aes-256-gcm");
    expect(proxy.password).toBe(`${PLACEHOLDER_SS2022_UPSK}:${PLACEHOLDER_SS2022_IPSK}`);
  });

  it("hysteria2 的 password 和 obfs-password 会做 URL decode", () => {
    const proxy = parseProxyLink(
      `hysteria2://${encodeURIComponent(PLACEHOLDER_HY2_PASSWORD)}@example.com:443?obfs=salamander&obfs-password=${encodeURIComponent(PLACEHOLDER_HY2_OBFS_PASSWORD)}&sni=example.com#Hysteria2-Encoded`,
      { useUDP: false }
    );

    expect(proxy.password).toBe(PLACEHOLDER_HY2_PASSWORD);
    expect(proxy["obfs-password"]).toBe(PLACEHOLDER_HY2_OBFS_PASSWORD);
  });

  it("ssh 会解析密码模式所需字段并做 URL decode", () => {
    const proxy = parseProxyLink("ssh://demo%2Buser:p%40ss%3Aword@example.com:22#SSH-Encoded", { useUDP: false });

    expect(proxy).toEqual({
      type: "ssh",
      name: "SSH-Encoded",
      server: "example.com",
      port: 22,
      username: "demo+user",
      password: "p@ss:word"
    });
  });

  it("ssh 暂不支持无密码模式", () => {
    expect(() =>
      parseProxyLink("ssh://demo-user@example.com:22#SSH-KeyOnly", {
        useUDP: false
      })
    ).toThrowError("SSH 节点暂只支持密码认证");
  });

  it("snell 会解析 URL 编码 PSK、版本与混淆字段", () => {
    const proxy = parseProxyLink(
      "snell://placeholder%2Bpsk%2Fvalue@example.com:44046?version=5&obfs=shadow-tls&obfs-host=cdn.example.com#Snell-Encoded"
    );

    expect(proxy).toEqual({
      type: "snell",
      name: "Snell-Encoded",
      server: "example.com",
      port: 44046,
      psk: "placeholder+psk/value",
      version: 5,
      "obfs-opts": {
        mode: "shadow-tls",
        host: "cdn.example.com"
      }
    });
  });

  it("snell 缺省 version 时输出 1，接受全部受支持的版本", () => {
    const defaultVersion = parseProxyLink("snell://placeholder-psk@example.com:44046#Snell-Default");

    expect(defaultVersion.version).toBe(1);
    for (const version of [1, 2, 3, 4, 5]) {
      expect(parseProxyLink(`snell://placeholder-psk@example.com:44046?version=${version}#Snell-${version}`).version).toBe(version);
    }
  });

  it("snell 会拒绝缺失 PSK、非法版本和没有模式的 obfs-host", () => {
    expect(() => parseProxyLink("snell://@example.com:44046#Snell-NoPsk")).toThrowError("Snell psk 缺失");
    expect(() => parseProxyLink("snell://placeholder-psk@example.com:44046?version=6#Snell-InvalidVersion")).toThrowError("Snell version 无效");
    expect(() => parseProxyLink("snell://placeholder-psk@example.com:44046?obfs-host=cdn.example.com#Snell-InvalidObfs")).toThrowError("Snell obfs-host 需要 obfs");
  });

  it("wireguard 会解析 Mihomo 所需字段并兼容 wg:// 前缀", () => {
    const proxy = parseProxyLink(
      `wg://${PLACEHOLDER_WG_PRIVATE_KEY}@example.com:51820?public-key=${encodeURIComponent(PLACEHOLDER_WG_PUBLIC_KEY)}&pre-shared-key=${encodeURIComponent(PLACEHOLDER_WG_PRESHARED_KEY)}&address=172.16.0.2%2F32,2606%3A4700%3A110%3A8765%3Aabcd%3Aef01%3A2345%3A6789%2F128&dns=1.1.1.1,8.8.8.8&mtu=1280&reserved=1,2,3&dialer-proxy=%E5%89%8D%E7%BD%AE%E8%8A%82%E7%82%B9&udp=false#WG-Alias`,
      { useUDP: true }
    );

    expect(proxy).toEqual({
      type: "wireguard",
      name: "WG-Alias",
      server: "example.com",
      port: 51820,
      ip: "172.16.0.2/32",
      ipv6: "2606:4700:110:8765:abcd:ef01:2345:6789/128",
      "private-key": PLACEHOLDER_WG_PRIVATE_KEY,
      "public-key": PLACEHOLDER_WG_PUBLIC_KEY,
      "allowed-ips": ["0.0.0.0/0"],
      "pre-shared-key": PLACEHOLDER_WG_PRESHARED_KEY,
      reserved: [1, 2, 3],
      "persistent-keepalive": undefined,
      mtu: 1280,
      "dialer-proxy": "前置节点",
      "remote-dns-resolve": undefined,
      dns: ["1.1.1.1", "8.8.8.8"],
      udp: false
    });
  });
});

describe("订阅正文解析", () => {
  const node = "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#Node";

  it("解析节点文本", () => {
    const proxies = parseSubscriptionBody(`${node}A\n${node}B`);

    expect(proxies).toHaveLength(2);
  });

  it("超过节点上限时拒绝节点文本和 Clash YAML", () => {
    const nodes = Array.from({ length: 3 }, (_, index) => `${node}${index}`);

    expect(() => parseSubscriptionBody(nodes.join("\n"), {}, { maxProxies: 2 })).toThrowError("节点数量不能超过 2");
    expect(() => parseSubscriptionBody(`proxies:\n${nodes.map((name) => `  - name: ${name}`).join("\n")}`, {}, { maxProxies: 2 })).toThrowError("节点数量不能超过 2");
  });
});

describe("订阅正文解析容错", () => {
  const node = "ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#Node";

  it("混入格式错误的节点行时跳过坏行，其余节点正常解析", () => {
    const proxies = parseSubscriptionBody([
      `${node}A`,
      "vmess://bm90LWEtdmFsaWQtanNvbg==",
      "ss://%E6%90%9E%E5%9D%8F%E7%9A%84%E5%8A%A0%E5%AF%86%40:443",
      `${node}B`
    ].join("\n"));

    expect(proxies).toHaveLength(2);
    expect(proxies.map((proxy) => proxy.name)).toEqual(["NodeA", "NodeB"]);
  });

  it("全部行都损坏时返回空数组而不是抛错", () => {
    const proxies = parseSubscriptionBody("vmess://bm90LWEtdmFsaWQtanNvbg==\nss://bad%40:22");

    expect(proxies).toEqual([]);
  });

  it("超过节点上限仍按业务错误抛出", () => {
    const nodes = Array.from({ length: 3 }, (_, index) => `${node}${index}`);

    expect(() => parseSubscriptionBody(nodes.join("\n"), {}, { maxProxies: 2 })).toThrowError("节点数量不能超过 2");
  });
});
