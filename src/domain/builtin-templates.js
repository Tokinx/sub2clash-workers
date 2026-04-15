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
      - 手动切换
      - DIRECT
  - name: 手动切换
    type: select
    proxies:
      - <all>
  - name: OpenAI
    type: select
    proxies:
      - 节点选择
      - <countries>
      - 手动切换
      - DIRECT
  - name: 国外媒体
    type: select
    proxies:
      - 节点选择
      - <countries>
      - 手动切换
      - DIRECT
  - name: Telegram
    type: select
    proxies:
      - 节点选择
      - <countries>
      - 手动切换
      - DIRECT
  - name: 漏网之鱼
    type: select
    proxies:
      - 节点选择
      - <countries>
      - 手动切换
      - DIRECT
rules:
  - DOMAIN-SUFFIX,openai.com,OpenAI
  - DOMAIN-SUFFIX,chatgpt.com,OpenAI
  - DOMAIN-SUFFIX,telegram.org,Telegram
  - GEOIP,LAN,DIRECT
  - MATCH,漏网之鱼
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
proxies: []
proxy-groups:
  - name: 节点选择
    type: select
    proxies:
      - <countries>
      - 手动切换
      - DIRECT
  - name: 手动切换
    type: select
    proxies:
      - <all>
  - name: OpenAI
    type: select
    proxies:
      - 节点选择
      - <countries>
      - 手动切换
      - DIRECT
  - name: 国外媒体
    type: select
    proxies:
      - 节点选择
      - <countries>
      - 手动切换
      - DIRECT
  - name: Telegram
    type: select
    proxies:
      - 节点选择
      - <countries>
      - 手动切换
      - DIRECT
  - name: 漏网之鱼
    type: select
    proxies:
      - 节点选择
      - <countries>
      - 手动切换
      - DIRECT
rules:
  - GEOSITE,openai,OpenAI
  - GEOSITE,telegram,Telegram
  - GEOSITE,geolocation-!cn,国外媒体
  - GEOIP,private,DIRECT
  - MATCH,漏网之鱼
`
  }
];

export function listBuiltinTemplates() {
  return BUILTIN_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    target: template.target,
    builtin: true
  }));
}

export async function loadBuiltinTemplate(_env, _request, id) {
  const template = BUILTIN_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    throw notFound("内置模板不存在");
  }
  return template;
}
