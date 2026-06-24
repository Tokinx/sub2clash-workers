import YAML from "yaml";

import { decodeBase64Loose } from "../../utils/base64url.js";
import { badRequest } from "../../utils/errors.js";

const SUPPORT_MATRIX = {
  clash: new Set(["ss", "ssr", "vmess", "trojan", "socks5"]),
  meta: new Set([
    "ss",
    "ssr",
    "vmess",
    "vless",
    "trojan",
    "hysteria",
    "hysteria2",
    "socks5",
    "anytls",
    "wireguard",
    "ssh"
  ])
};

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw badRequest("端口号无效");
  }
  return port;
}

function isBase64Like(value) {
  return /^[A-Za-z0-9+/=_-]+$/.test(value);
}

function isShadowsocks2022Cipher(cipher) {
  return String(cipher || "").startsWith("2022-");
}

function decodeUrlComponentSafe(value) {
  if (!value) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function boolFromQuery(value) {
  return value === "1" || value === "true";
}

function optionalBoolFromQuery(value) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  return boolFromQuery(value);
}

function resolveUdp(queryValue, options = {}) {
  const fromQuery = optionalBoolFromQuery(queryValue);
  if (fromQuery !== undefined) {
    return fromQuery;
  }

  return options.useUDP ? true : undefined;
}

function buildUdpField(queryValue, options = {}) {
  const udp = resolveUdp(queryValue, options);
  return udp === undefined ? {} : { udp };
}

function getNameFromUrl(link) {
  return decodeURIComponent(link.hash.replace(/^#/, "")) || `${link.hostname}:${link.port}`;
}

function splitOnce(value, separator) {
  const index = value.indexOf(separator);
  if (index === -1) {
    return [value, ""];
  }

  return [value.slice(0, index), value.slice(index + separator.length)];
}

function parseInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw badRequest(`${label} 无效`);
  }
  return number;
}

function getFirstQueryValue(query, keys) {
  for (const key of keys) {
    const value = query.get(key);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return undefined;
}

function normalizeBase64QueryValue(value) {
  if (!value) {
    return value;
  }
  return decodeUrlComponentSafe(value).replace(/ /g, "+");
}

function parseQueryList(value) {
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => decodeUrlComponentSafe(item.trim()))
    .filter(Boolean);
}

function resolveWireGuardLocalAddress(query) {
  const directIpv4 = getFirstQueryValue(query, ["ip", "ipv4"]);
  const directIpv6 = getFirstQueryValue(query, ["ipv6"]);
  const combined = parseQueryList(
    getFirstQueryValue(query, ["address", "addresses", "local-address", "local_address"])
  );

  const pickFromCombined = (matcher) => combined?.find((item) => matcher(item));
  const ip = directIpv4 || pickFromCombined((item) => !item.includes(":"));
  const ipv6 = directIpv6 || pickFromCombined((item) => item.includes(":"));

  return {
    ip: ip ? decodeUrlComponentSafe(ip) : undefined,
    ipv6: ipv6 ? decodeUrlComponentSafe(ipv6) : undefined
  };
}

function parseWireGuardReserved(value) {
  if (!value) {
    return undefined;
  }

  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length && items.every((item) => /^\d+$/.test(item))) {
    return items.map((item) => parseInteger(item, "WireGuard reserved", { min: 0, max: 255 }));
  }

  return decodeUrlComponentSafe(value);
}

function parseShadowsocks(proxy, options) {
  let source = proxy;
  if (!source.includes("@")) {
    const [body, fragment = ""] = source.replace(/^ss:\/\//, "").split("#");
    const decoded = decodeBase64Loose(body);
    source = `ss://${decoded}${fragment ? `#${fragment}` : ""}`;
  }

  const link = new URL(source);
  let cipher = decodeUrlComponentSafe(link.username);
  let password = decodeUrlComponentSafe(link.password);

  if (!password && isBase64Like(cipher)) {
    const decoded = decodeBase64Loose(cipher);
    const [decodedCipher, decodedPassword = ""] = splitOnce(decoded, ":");
    cipher = decodedCipher;
    password = decodedPassword;
  }

  if (password && isBase64Like(password) && !isShadowsocks2022Cipher(cipher)) {
    try {
      password = decodeBase64Loose(password);
    } catch {
      password = decodeUrlComponentSafe(link.password);
    }
  }

  return {
    type: "ss",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    password,
    cipher,
    ...buildUdpField(undefined, options)
  };
}

function splitRight(value, separator, count) {
  const parts = value.split(separator);
  if (parts.length <= count) {
    return parts;
  }
  const left = parts.slice(0, parts.length - count + 1).join(separator);
  return [left, ...parts.slice(parts.length - count + 1)];
}

function parseShadowsocksR(proxy, options) {
  const decoded = decodeBase64Loose(proxy.replace(/^ssr:\/\//, ""));
  const [serverInfo, queryString = ""] = decoded.split("/?");
  const parts = splitRight(serverInfo, ":", 6);
  if (parts.length < 6) {
    throw badRequest("SSR 节点格式错误");
  }
  const params = new URLSearchParams(queryString);
  const name = params.get("remarks")
    ? decodeBase64Loose(params.get("remarks"))
    : `${parts[0]}:${parts[1]}`;

  return {
    type: "ssr",
    name,
    server: parts[0],
    port: parsePort(parts[1]),
    protocol: parts[2],
    cipher: parts[3],
    obfs: parts[4],
    password: decodeBase64Loose(parts[5]),
    "obfs-param": params.get("obfsparam") ? decodeBase64Loose(params.get("obfsparam")) : undefined,
    "protocol-param": params.get("protoparam")
      ? decodeBase64Loose(params.get("protoparam"))
      : undefined,
    ...buildUdpField(undefined, options)
  };
}

function parseVmess(proxy, options) {
  const decoded = JSON.parse(decodeBase64Loose(proxy.replace(/^vmess:\/\//, "")));
  const result = {
    type: "vmess",
    name: decoded.ps || `${decoded.add}:${decoded.port}`,
    server: decoded.add,
    port: parsePort(decoded.port),
    uuid: decoded.id,
    alterId: Number(decoded.aid || 0),
    cipher: decoded.scy || "auto",
    ...buildUdpField(undefined, options)
  };

  if (decoded.tls === "tls") {
    result.tls = true;
  }
  if (decoded.sni) {
    result.servername = decoded.sni;
  }
  if (decoded.fp) {
    result["client-fingerprint"] = decoded.fp;
  }
  if (decoded.alpn) {
    result.alpn = decoded.alpn.split(",");
  }
  if (decoded.net === "ws") {
    result.network = "ws";
    result["ws-opts"] = {
      path: decoded.path || "/",
      headers: {
        Host: decoded.host || decoded.add
      }
    };
  }
  if (decoded.net === "grpc") {
    result.network = "grpc";
    result["grpc-opts"] = {
      "grpc-service-name": decoded.path || ""
    };
  }
  if (decoded.net === "h2") {
    result.network = "h2";
    result["h2-opts"] = {
      host: decoded.host ? decoded.host.split(",") : [],
      path: decoded.path || "/"
    };
  }

  return result;
}

function parseVless(proxy, options) {
  const link = new URL(proxy);
  const query = link.searchParams;
  const result = {
    type: "vless",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    uuid: link.username,
    flow: query.get("flow") || undefined,
    ...buildUdpField(query.get("udp"), options)
  };

  if (query.get("security") === "tls" || query.get("security") === "reality") {
    result.tls = true;
  }
  if (query.get("security") === "reality") {
    result["reality-opts"] = {
      "public-key": query.get("pbk") || "",
      "short-id": query.get("sid") || ""
    };
  }
  if (query.get("alpn")) {
    result.alpn = query.get("alpn").split(",");
  }
  if (query.get("sni")) {
    result.servername = query.get("sni");
  }
  if (query.get("fp")) {
    result["client-fingerprint"] = query.get("fp");
  }
  if (boolFromQuery(query.get("allowInsecure"))) {
    result["skip-cert-verify"] = true;
  }

  const networkType = query.get("type");
  if (networkType === "ws") {
    result.network = "ws";
    result["ws-opts"] = {
      path: query.get("path") || "/"
    };
    if (query.get("host")) {
      result["ws-opts"].headers = {
        Host: query.get("host")
      };
    }
  }
  if (networkType === "grpc") {
    result.network = "grpc";
    result["grpc-opts"] = {
      "grpc-service-name": query.get("serviceName") || ""
    };
  }
  if (networkType === "http") {
    result.network = "http";
    result["http-opts"] = {
      path: (query.get("path") || "").split(",").filter(Boolean),
      headers: query.get("host")
        ? {
            host: query.get("host").split(",")
          }
        : undefined
    };
  }
  return result;
}

function parseTrojan(proxy, options) {
  const link = new URL(proxy);
  const query = link.searchParams;
  const result = {
    type: "trojan",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    password: link.username,
    ...buildUdpField(query.get("udp"), options)
  };

  if (query.get("alpn")) {
    result.alpn = query.get("alpn").split(",");
  }
  if (query.get("sni")) {
    result.sni = query.get("sni");
  }
  if (query.get("fp")) {
    result["client-fingerprint"] = query.get("fp");
  }
  if (boolFromQuery(query.get("allowInsecure"))) {
    result["skip-cert-verify"] = true;
  }
  if (query.get("security") === "reality") {
    result["reality-opts"] = {
      "public-key": query.get("pbk") || "",
      "short-id": query.get("sid") || ""
    };
  }
  if (query.get("type") === "ws") {
    result.network = "ws";
    result["ws-opts"] = {
      path: query.get("path") || "/",
      headers: {
        Host: query.get("host") || link.hostname
      }
    };
  }
  if (query.get("type") === "grpc") {
    result.network = "grpc";
    result["grpc-opts"] = {
      "grpc-service-name": query.get("serviceName") || ""
    };
  }
  return result;
}

function parseHysteria(proxy) {
  const link = new URL(proxy);
  const query = link.searchParams;
  return {
    type: "hysteria",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    protocol: query.get("protocol") || undefined,
    up: query.get("upmbps") || "",
    down: query.get("downmbps") || "",
    auth: query.get("auth") || undefined,
    "auth-str": query.get("auth-str") || undefined,
    obfs: query.get("obfs") || undefined,
    sni: query.get("sni") || undefined,
    alpn: query.get("alpn") ? query.get("alpn").split(",") : undefined,
    "skip-cert-verify": boolFromQuery(query.get("insecure"))
  };
}

function parseHysteria2(proxy) {
  const link = new URL(proxy.replace(/^hy2:\/\//, "hysteria2://"));
  const query = link.searchParams;
  return {
    type: "hysteria2",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    password: decodeUrlComponentSafe(link.password || link.username),
    obfs: query.get("obfs") || undefined,
    "obfs-password": decodeUrlComponentSafe(query.get("obfs-password")) || undefined,
    sni: query.get("sni") || undefined,
    "skip-cert-verify": boolFromQuery(query.get("insecure"))
  };
}

function parseSocks(proxy, options) {
  const link = new URL(proxy);
  let username = link.username;
  let password = link.password;

  if (!password && username && isBase64Like(username)) {
    try {
      const decoded = decodeBase64Loose(username);
      const [decodedUser, decodedPassword = ""] = decoded.split(":");
      username = decodedUser;
      password = decodedPassword;
    } catch {
      username = link.username;
    }
  }

  return {
    type: "socks5",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    username: username || undefined,
    password: password || undefined,
    tls: boolFromQuery(link.searchParams.get("tls")),
    ...buildUdpField(link.searchParams.get("udp"), options)
  };
}

function parseAnytls(proxy, options) {
  const link = new URL(proxy);
  const query = link.searchParams;
  return {
    type: "anytls",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    password: link.password || link.username,
    sni: query.get("sni") || undefined,
    "skip-cert-verify": boolFromQuery(query.get("insecure")),
    ...buildUdpField(undefined, options)
  };
}

function parseSsh(proxy) {
  const link = new URL(proxy);
  const username = decodeUrlComponentSafe(link.username);
  const password = decodeUrlComponentSafe(link.password);

  if (!username || !password) {
    throw badRequest("SSH 节点暂只支持密码认证");
  }

  return {
    type: "ssh",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    username,
    password
  };
}

function parseWireGuard(proxy, options) {
  const link = new URL(proxy.replace(/^wg:\/\//, "wireguard://"));
  const query = link.searchParams;
  const { ip, ipv6 } = resolveWireGuardLocalAddress(query);
  const privateKey =
    decodeUrlComponentSafe(link.username) ||
    normalizeBase64QueryValue(
      getFirstQueryValue(query, ["private-key", "private_key", "privatekey", "secret-key", "secretkey"])
    );
  const publicKey = normalizeBase64QueryValue(
    getFirstQueryValue(query, ["public-key", "public_key", "publickey", "peer-public-key", "peer_public_key"])
  );

  if (!privateKey) {
    throw badRequest("WireGuard private-key 缺失");
  }
  if (!publicKey) {
    throw badRequest("WireGuard public-key 缺失");
  }
  if (!ip) {
    throw badRequest("WireGuard ip 缺失");
  }

  const allowedIps =
    parseQueryList(
      getFirstQueryValue(query, ["allowed-ips", "allowed_ips", "allowedips"])
    ) || ["0.0.0.0/0"];
  const dns = parseQueryList(getFirstQueryValue(query, ["dns"]));
  const remoteDnsResolve = optionalBoolFromQuery(
    getFirstQueryValue(query, ["remote-dns-resolve", "remote_dns_resolve", "remoteDnsResolve"])
  );
  const preSharedKey = normalizeBase64QueryValue(
    getFirstQueryValue(query, ["pre-shared-key", "pre_shared_key", "presharedkey"])
  );
  const reserved = parseWireGuardReserved(
    getFirstQueryValue(query, ["reserved", "reserve"])
  );
  const persistentKeepaliveValue = getFirstQueryValue(query, [
    "persistent-keepalive",
    "persistent_keepalive",
    "persistentKeepalive"
  ]);
  const mtuValue = getFirstQueryValue(query, ["mtu"]);
  const dialerProxy = decodeUrlComponentSafe(
    getFirstQueryValue(query, ["dialer-proxy", "dialer_proxy", "dialerProxy"])
  );

  return {
    type: "wireguard",
    name: getNameFromUrl(link),
    server: link.hostname,
    port: parsePort(link.port),
    ip,
    ipv6,
    "private-key": privateKey,
    "public-key": publicKey,
    "allowed-ips": allowedIps,
    "pre-shared-key": preSharedKey || undefined,
    reserved,
    "persistent-keepalive":
      persistentKeepaliveValue === undefined
        ? undefined
        : parseInteger(persistentKeepaliveValue, "WireGuard persistent-keepalive", { min: 0 }),
    mtu: mtuValue === undefined ? undefined : parseInteger(mtuValue, "WireGuard mtu", { min: 1 }),
    "dialer-proxy": dialerProxy || undefined,
    "remote-dns-resolve": remoteDnsResolve,
    dns: dns?.length ? dns : undefined,
    ...buildUdpField(query.get("udp"), options)
  };
}

const PARSERS = [
  ["ss://", parseShadowsocks],
  ["ssr://", parseShadowsocksR],
  ["vmess://", parseVmess],
  ["vless://", parseVless],
  ["trojan://", parseTrojan],
  ["hysteria://", parseHysteria],
  ["hysteria2://", parseHysteria2],
  ["hy2://", parseHysteria2],
  ["socks://", parseSocks],
  ["socks5://", parseSocks],
  ["anytls://", parseAnytls],
  ["ssh://", parseSsh],
  ["wireguard://", parseWireGuard],
  ["wg://", parseWireGuard]
];

export function isProxyLink(line) {
  return PARSERS.some(([prefix]) => line.startsWith(prefix));
}

export function parseProxyLink(line, options = {}) {
  const target = line.trim();
  for (const [prefix, parser] of PARSERS) {
    if (target.startsWith(prefix)) {
      return parser(target, options);
    }
  }
  throw badRequest(`不支持的协议: ${line.slice(0, 24)}`);
}

export function parseSubscriptionBody(body, options = {}) {
  try {
    const parsed = YAML.parse(body);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.proxies)) {
      return parsed.proxies;
    }
  } catch {}

  const sourceText = isProxyLink(body.trim())
    ? body
    : (() => {
        try {
          return decodeBase64Loose(body.trim());
        } catch {
          return body;
        }
      })();

  return sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => isProxyLink(line))
    .map((line) => parseProxyLink(line, options));
}

export function filterSupportedProxies(proxies, target) {
  return proxies.filter((proxy) => SUPPORT_MATRIX[target].has(proxy.type));
}
