# 架构说明

## 分层

- `src/routes`：HTTP 路由与中间件组装
- `src/auth`：密码校验、Cookie 会话、鉴权
- `src/data`：KV 读写仓库
- `src/domain`：订阅抓取、解析、模板合并、YAML 输出
- `frontend/src`：登录页、配置器、模板管理页

## 前端分层

- `frontend/src/components/ui`：`shadcn/ui` 生成的基础 primitive，仅承载通用交互与无障碍能力
- `frontend/src/components/dashboard`：配置器领域组合组件，如表格编辑器、预览弹窗、短链接自动补全输入
- `frontend/src/components`：壳层与少量品牌化组合组件，不新增第二套基础 UI primitive
- `frontend/src/pages`：页面只保留状态、派生数据、路由与 API 编排，不再内嵌复杂控件实现

## 存储模型

- `settings`：全局设置与自建模板
- `link:{id}`：短链配置

## 配置覆写

- 输入侧连接字符串当前支持：
  - `Clash`：`ss`、`ssr`、`vmess`、`trojan`、`socks5`
  - `Clash.Meta / Mihomo`：`ss`、`ssr`、`vmess`、`vless`、`trojan`、`hysteria`、`hysteria2`、`socks5`、`anytls`、`wireguard`、`ssh`、`snell`
- `wireguard` 仅参与 `Clash.Meta / Mihomo` 渲染；当目标为 `clash` 时会按既有支持矩阵直接过滤
- `wireguard` 分享链接兼容 `wireguard://` 与 `wg://` 前缀，核心字段采用 query 参数承载，并映射到 Mihomo 的 `private-key`、`public-key`、`pre-shared-key`、`ip`、`ipv6`、`dns`、`mtu`、`reserved`、`udp`、`dialer-proxy` 等字段
- `ssh` 仅参与 `Clash.Meta / Mihomo` 渲染；当目标为 `clash` 时会按既有支持矩阵直接过滤
- `ssh` 分享链接当前采用 `ssh://username:password@server:port#name` 形式，暂只解析密码认证所需字段
- `snell` 仅参与 `Clash.Meta / Mihomo` 渲染；当目标为 `clash` 时会按既有支持矩阵直接过滤
- `snell` 分享链接采用 `snell://psk@server:port?version=1&obfs=http&obfs-host=example.com#name` 形式；`version` 支持 1 至 5，缺省为 1，`obfs` 支持 `http`、`tls`、`shadow-tls`
- 订阅源字段统一使用 `sources.subscriptions[].remark` 保存备注，仅作为管理台辅助信息，不参与订阅渲染与节点改名
- `options.autoFlag` 作为单份配置的一部分参与长链接、短链接与实时预览；渲染层在节点过滤、替换、名称去重之后补齐旗帜，再生成国家组
- 自动旗帜仅基于内置国家/地区识别规则处理节点名；若节点名已包含 emoji 旗帜或无法识别对应国家/地区，则保持原名
- `config.override` 作为单份配置的一部分参与长链接、短链接与实时预览，不新增独立 KV key
- 规则增强仍保留结构化配置字段，但渲染层会转换为内部覆写对象执行，不写回长链接、短链或管理台表单
- 当前仅支持 `type: yaml`，用户覆写在模板合并、国家组生成和内部规则增强之后执行，拥有最终优先级
- YAML 覆写支持深度合并、`!` 整段替换、`+key` 前插数组、`key+` 后追加数组，以及 `<...>` 转义真实键名
- 扩展语法新增顶层 `$patches` 和值级 `$select`，用于按条件更新对象数组、upsert 策略组，以及从已有 `proxies` / `proxy-groups` 动态提取字段
- override 新增或修改过的 `proxy-groups` 会在最终输出前再次展开 `<all>` / `<countries>` / `<us>` 这类占位符
- `nodeList` 模式不会执行规则增强与覆写；若存在相关配置，渲染接口会返回 warning，避免静默失效

## 短链目录

- 管理台通过 `GET /api/links` 拉取短链摘要列表，仅返回 `id`、时间戳等目录信息
- 配置器导入区基于该目录做 autocomplete，仍允许用户粘贴任意 `/sub/:payload` 或 `/s/:id` 链接

## 同域订阅解析

- 远程订阅默认仍按 URL 抓取并进入 KV 缓存
- 当订阅源与当前请求同域，且路径命中 `/s/:id` 或 `/sub/:payload` 时，域层会直接在 Worker 内部解析，不再二次走公网 fetch
- 内部解析会沿用当前模板合并、覆写与节点过滤逻辑，但直接向父配置传递结构化节点，不再执行中间 YAML 序列化与二次解析
- 内部解析会对本地订阅循环引用做显式拦截，避免 `A -> B -> A` 递归超时

## Worker CPU 边界

- 渲染链路默认最多接收 10 个订阅源，受 `MAX_SUBSCRIPTION_COUNT` 控制
- 单次渲染默认最多处理 100 个输入节点，受 `MAX_PROXY_COUNT` 控制；限制同时覆盖远程订阅、内联节点、同域订阅与模板/覆写后的最终节点
- `options.refresh = true` 继续强制绕过远程订阅 KV 缓存，本阶段不增加最终 YAML 缓存
- 节点分享链接文本与 Base64 节点列表优先走轻量解析，只有 Clash YAML 内容才进入完整 YAML 解析
- 空规则增强与空 YAML 覆写不会复制整份配置对象

## 安全模型

- 管理 API 需要会话 Cookie
- 密码来源于 `APP_PASSWORD`
- 会话签名来源于 `SESSION_SECRET`
- 订阅链接视为敏感凭据，但保持公开可访问

## 当前实现状态

- Worker 入口已在 `src/index.js` 完成
- API 路由已按认证与业务边界拆分
- 内置模板由 `src/domain/builtin-templates.js` 直接提供，避免被静态资源 SPA fallback 污染
- 前端构建产物输出到 `public/`，Worker 直接托管
- 本地开发入口切换为 `frontend/vite.config.js` + `@cloudflare/vite-plugin`
- 开发时由 Vite 驱动 HMR，Worker 仍作为统一入口处理静态资源与动态接口
- 前端基础 UI 已迁移到 `shadcn/ui`，视觉主题继续由 `frontend/src/styles.css` 的暖色 token 控制
