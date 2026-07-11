<div align="center">
<h1>Sub2Clash on Workers</h1>

一个基于 Cloudflare Workers 的私有订阅聚合与转换工具，支持将多个订阅和单节点聚合统一收口成一份可复用的 Clash / Clash.Meta 配置

</div>

## 界面预览

![SnapShort](./snapshort.png)

## 核心功能

- 把多个订阅、零散节点和自定义规则收口到一个统一入口
- 需要一个工具维护模板、规则和短链接，而不是手写 YAML
- 扩展了 $patches、$select，服务端配置覆写规则更轻松
- 无需服务器，部署简单无需维护

## 协议支持

输入侧当前支持以下分享协议：

- Clash：`ss`、`ssr`、`vmess`、`trojan`、`socks5`
- Clash.Meta：`ss`、`ssr`、`vmess`、`vless`、`trojan`、`hysteria`、`hysteria2`、`socks5`、`anytls`、`wireguard`、`ssh`

远程订阅内容支持两类格式：

- 已经是 Clash YAML，且顶层包含 `proxies`
- Base64 或纯文本的节点分享链接列表

## 部署

### 一键部署：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Tokinx/sub2clash-workers)

### 手动部署：

```bash
# 创建 KV Namespace
创建一个用于 CACHE 绑定的 KV Namespace
并把 ID 填入 wrangler.jsonc

# 设置生产 Secret
wrangler secret put APP_PASSWORD
wrangler secret put SESSION_SECRET

# 发布 Worker
bun run deploy
```

## 技术栈

- Runtime：Bun
- Backend：JavaScript、Cloudflare Workers、Hono
- Frontend：React 19、React Router 7、Tailwind CSS v4、shadcn/ui
- Test：Vitest、Testing Library、Cloudflare Workers Vitest Pool

## 快速开始

### 前置条件

- Bun
- Cloudflare 账号
- 一个 KV Namespace

### 安装依赖

```bash
bun install
```

### 本地开发

1. 准备本地密钥文件 `.dev.vars`

```dotenv
APP_PASSWORD=your-local-password
SESSION_SECRET=replace-with-a-random-secret
SESSION_TTL_SECONDS=2592000
SUB_CACHE_TTL_SECONDS=300
MAX_REMOTE_FILE_SIZE=1048576
MAX_PROXY_COUNT=100
MAX_SUBSCRIPTION_COUNT=10
```

2. 启动统一开发入口

```bash
bun run dev
```

默认会在 `http://127.0.0.1:8787` 启动，由 Vite 提供前端 HMR，并通过 `@cloudflare/vite-plugin` 挂接 Worker 运行时。

## 环境变量与 Secret

| 变量名                   | 必需 | 说明                         | 默认值       |
| ------------------------ | ---- | ---------------------------- | ------------ |
| `APP_PASSWORD`           | ✓    | 管理台登录密码               | -            |
| `SESSION_SECRET`         | ✓    | 会话签名密钥                 | -            |
| `SESSION_TTL_SECONDS`    | -    | Cookie 会话有效期            | 2592000 秒   |
| `SUB_CACHE_TTL_SECONDS`  | -    | 远程订阅缓存 TTL             | 300 秒       |
| `MAX_REMOTE_FILE_SIZE`   | -    | 单次远程订阅拉取大小上限     | 1048576 字节 |
| `MAX_PROXY_COUNT`        | -    | 单次渲染最多处理的输入节点数 | 100          |
| `MAX_SUBSCRIPTION_COUNT` | -    | 单份配置最多包含的订阅源数量 | 10           |

## 补充说明

### WireGuard 分享链接

`wireguard` 当前仅用于 `Clash.Meta / Mihomo` 目标，支持 `wireguard://` 和 `wg://` 两种前缀。

当前采用“`server:port` + query 参数”的连接字符串格式：

| 参数                   | 必填 | 说明                               | 别名 / 备注                                                                                    |
| ---------------------- | ---- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `server`               | 是   | 节点服务器地址，放在 URL host 部分 | 例如 `wg.example.com`                                                                          |
| `port`                 | 是   | 节点端口，放在 URL port 部分       | 例如 `51820`                                                                                   |
| `private-key`          | 是   | WireGuard 私钥                     | 支持 `private_key` / `privatekey` / `secret-key` / `secretkey`；也可直接放在 URL username 部分 |
| `public-key`           | 是   | Peer 公钥                          | 支持 `public_key` / `publickey` / `peer-public-key` / `peer_public_key`                        |
| `ip`                   | 是   | 本地 IPv4 地址/CIDR                | 例如 `172.16.0.2/32`                                                                           |
| `ipv6`                 | 否   | 本地 IPv6 地址/CIDR                | 可与 `ip` 同时使用                                                                             |
| `address`              | 否   | 一次传入 IPv4 和 IPv6 本地地址     | 支持 `addresses` / `local-address` / `local_address`；例如 `172.16.0.2/32,2606:.../128`        |
| `dns`                  | 否   | DNS 列表                           | 多个值用英文逗号分隔                                                                           |
| `pre-shared-key`       | 否   | 预共享密钥                         | 无                                                                                             |
| `mtu`                  | 否   | MTU                                | 整数                                                                                           |
| `reserved`             | 否   | Reserved 值                        | 可传 `1,2,3` 这类数组                                                                          |
| `udp`                  | 否   | 是否显式输出 UDP 字段              | 支持 `1` / `true` / `false`                                                                    |
| `dialer-proxy`         | 否   | 绑定前置节点名                     | 支持 `dialer_proxy` / `dialerProxy`                                                            |
| `allowed-ips`          | 否   | Allowed IPs 列表                   | 支持 `allowed_ips` / `allowedips`；默认 `0.0.0.0/0`                                            |
| `persistent-keepalive` | 否   | Persistent Keepalive               | 支持 `persistent_keepalive` / `persistentKeepalive`                                            |
| `remote-dns-resolve`   | 否   | 是否启用远端 DNS 解析              | 支持 `remote_dns_resolve` / `remoteDnsResolve`                                                 |

示例：

```text
key 中如果包含 `=`、`+`、`/`，建议做 URL encode

wireguard://cHJpdmF0ZS1rZXk=@wg.example.com:51820?public-key=cHVibGljLWtleQ%3D%3D&ip=172.16.0.2%2F32#WG-Min

wireguard://cHJpdmF0ZS1rZXk=@wg.example.com:51820?public-key=cHVibGljLWtleQ%3D%3D&address=172.16.0.2%2F32,2606%3A4700%3A110%3A8765%3Aabcd%3Aef01%3A2345%3A6789%2F128&dns=1.1.1.1,8.8.8.8#WG-Address

wg://cHJpdmF0ZS1rZXk=@wg.example.com:51820?public-key=cHVibGljLWtleQ%3D%3D&pre-shared-key=cHJlc2hhcmVkLWtleQ%3D%3D&ip=172.16.0.2%2F32&mtu=1280&reserved=1,2,3&udp=false&dialer-proxy=%E5%89%8D%E7%BD%AE%E8%8A%82%E7%82%B9#WG-Full
```

### SSH 分享链接

`ssh` 当前仅用于 `Clash.Meta / Mihomo` 目标，暂只支持密码认证，不支持私钥认证。

当前采用标准 URL 形式：

```text
ssh://username:password@ssh.example.com:22#SSH-Node
```

字段约定：

| 参数       | 必填 | 说明           | 备注                                                                 |
| ---------- | ---- | -------------- | -------------------------------------------------------------------- |
| `username` | 是   | SSH 用户名     | 放在 URL username 部分                                               |
| `password` | 是   | SSH 密码       | 放在 URL password 部分，若包含 `@`、`:`、`/` 等字符需先做 URL encode |
| `server`   | 是   | SSH 服务端地址 | 放在 URL host 部分                                                   |
| `port`     | 是   | SSH 服务端端口 | 放在 URL port 部分                                                   |
| `name`     | 否   | 节点名         | 放在 URL fragment 部分，缺省时回退为 `server:port`                   |

## 相关文档

- [DESIGN.md](./DESIGN.md)
- [docs/architecture.md](./docs/architecture.md)
- [docs/api.md](./docs/api.md)
- [docs/override.md](./docs/override.md)
- [docs/regression.md](./docs/regression.md)
- [.tasks/roadmap.md](./.tasks/roadmap.md)

## 鸣谢

本项目基于 <a href="https://github.com/bestnite/sub2clash" target="_blank">bestnite/sub2clash</a> 由 AI 驱动二次开发
