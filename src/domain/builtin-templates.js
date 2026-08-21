import { notFound } from "../utils/errors.js";

export const BUILTIN_TEMPLATES = [
  {
    id: "clash-default",
    name: "Clash 默认模板",
    target: "clash",
    builtin: true,
    content: `mixed-port: 7890
allow-lan: true
mode: Rule
log-level: info
proxies: []
proxy-groups:
  - name: 节点选择
    type: select
    proxies:
      - <countries>
      - <all>
      - DIRECT
rules:
  - GEOIP,LAN,DIRECT
  - IP-CIDR,127.0.0.1/8,DIRECT,no-resolve
  - IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - IP-CIDR,100.64.0.0/10,DIRECT,no-resolve
  - IP-CIDR,224.0.0.0/4,DIRECT,no-resolve
  - IP-CIDR,255.255.255.255/32,DIRECT,no-resolve
  - IP-CIDR6,::1/128,DIRECT,no-resolve
  - IP-CIDR6,fc00::/7,DIRECT,no-resolve
  - IP-CIDR6,fe80::/10,DIRECT,no-resolve
  - GEOIP,CN,DIRECT
  - MATCH,节点选择
`
  },
  {
    id: "meta-default",
    name: "Clash.Meta 默认模板",
    target: "meta",
    builtin: true,
    content: `mixed-port: 7890
allow-lan: true
mode: Rule
log-level: info
ipv6: true
tcp-concurrent: true
unified-delay: true
proxies: []
proxy-groups:
  - name: 节点选择
    type: select
    proxies:
      - <countries>
      - <all>
      - DIRECT
rules:
  - GEOSITE,private,DIRECT
  - GEOIP,private,DIRECT
  - IP-CIDR,127.0.0.1/8,DIRECT,no-resolve
  - IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - IP-CIDR,100.64.0.0/10,DIRECT,no-resolve
  - IP-CIDR,224.0.0.0/4,DIRECT,no-resolve
  - IP-CIDR,255.255.255.255/32,DIRECT,no-resolve
  - IP-CIDR6,::1/128,DIRECT,no-resolve
  - IP-CIDR6,fc00::/7,DIRECT,no-resolve
  - IP-CIDR6,fe80::/10,DIRECT,no-resolve
  - GEOSITE,geolocation-!cn,节点选择
  - GEOSITE,cn,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,节点选择
`
  }
];

export function listBuiltinTemplates(builtinOverrides = {}) {
  return BUILTIN_TEMPLATES.map((template) => {
    const override = builtinOverrides[template.id];
    if (override) {
      return {
        id: template.id,
        name: override.name || template.name,
        target: override.target || template.target,
        builtin: true,
        isModified: true,
        content: override.content ?? template.content,
        updatedAt: override.updatedAt
      };
    }
    return {
      id: template.id,
      name: template.name,
      target: template.target,
      builtin: true,
      isModified: false,
      content: template.content
    };
  });
}

export function getRawBuiltinTemplate(id) {
  const template = BUILTIN_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    throw notFound("内置模板不存在");
  }
  return template;
}

export async function loadBuiltinTemplate(env, _request, id) {
  const template = getRawBuiltinTemplate(id);
  if (env) {
    const { getBuiltinOverride } = await import("../data/settings-repository.js");
    const override = await getBuiltinOverride(env, id);
    if (override) {
      return {
        ...template,
        name: override.name || template.name,
        target: override.target || template.target,
        content: override.content ?? template.content,
        isModified: true
      };
    }
  }
  return template;
}
