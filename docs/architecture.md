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
- `cache:sub:{hash}`：按订阅 URL 哈希保存的外部订阅内容，默认 TTL 为 6 小时
- `cache:link-yaml:{id}`：短链接最终 YAML 与响应元数据，默认 TTL 与外部订阅一致
- `cache:deps:*`：短链对外部订阅、自建模板和子短链的内部依赖索引，用于递归失效缓存

## 缓存与失效

- `SUB_CACHE_TTL_SECONDS` 同时控制外部订阅与短链 YAML 缓存，默认值为 `21600`
- 长链接 `/sub/:payload` 与管理台 `/api/render` 不缓存最终 YAML；仅 `/s/:id` 在 `options.refresh = false` 时读写最终 YAML 缓存
- 订阅输出同时使用 Cloudflare 边缘缓存（HTTP `Cache-Control`）与 KV 两层：
  - `/sub/:payload` 响应 `public, s-maxage=21600`：payload 即配置指纹，URL 变化即新缓存条目，无失效问题
  - `/s/:id` 响应 `public, s-maxage=21600`：链接配置可被修改，管理台变更时按 `Cache-Tag` 调用 `ctx.cache.purge()` 精确失效，改动即时生效；KV 的 `invalidateLinkCaches` 继续负责 KV 层失效
  - 任一端点 `options.refresh = true` 时响应 `no-store`，强制刷新语义不受边缘缓存影响
  - 边缘缓存命中时 Worker 完全不执行，轮询型订阅客户端的请求数、CPU 与 KV 读取同步下降
  - 缓存层由 Workers Caching 承载（`cache.enabled` + `exports` 双入口）：default 入口关闭缓存作为 gateway，订阅输出转发到 `SubscriptionEntrypoint`（缓存开启），命中缓存时整个入口不执行；purge 按入口作用域隔离，管理台变更经 `purgeByTags` RPC 精确清除
- 短链 YAML 缓存写入与依赖索引同步移至 `ExecutionContext.waitUntil` 后台执行，两者并行且失败不影响响应；命中路径只读输出缓存（1 次 KV 读），未命中才读短链记录
- 管理台可单独刷新一个不同源的 HTTP/HTTPS 订阅；刷新使用 `no-store` 抓取，成功后覆盖订阅缓存，失败时保留旧值
- 手动刷新外部订阅、更新或删除短链、更新或删除自建模板时，会从直接依赖开始递归清除所有父短链 YAML 缓存
- 依赖索引（`cache:deps:*`）在依赖集合未变化时跳过全部写入；每次输出缓存过期后的冷渲染多数情况下依赖并无变化
- `options.refresh = true` 会同时绕过外部订阅缓存、短链 YAML 缓存与边缘缓存，且不会写回任一缓存

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
- 订阅源、Rule Provider、自定义规则和节点名替换统一使用行级 `enabled` 字段；只有显式 `false` 表示关闭，历史配置缺少该字段时按开启兼容
- 关闭行继续随长链接、短链和管理台配置保存，但域层不会抓取关闭的订阅源，也不会应用关闭的 Rule Provider、规则或替换项；关闭行不计入订阅源执行数量限制
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

- `link:{id}` 记录在 `config` 之外保存顶层 `remark`，该字段只服务于管理识别，不参与订阅渲染
- 管理台通过 `GET /api/links` 拉取短链摘要列表，返回 `id`、`remark` 与时间戳，不暴露完整配置
- 配置器导入区基于该目录做 autocomplete，候选项展示备注并支持按备注匹配，仍允许用户粘贴任意 `/sub/:payload` 或 `/s/:id` 链接
- 历史 KV 记录缺少 `remark` 时按空字符串读取，无需迁移即可继续使用

## 同域订阅解析

- 远程订阅默认按 URL 抓取并进入 6 小时 KV 缓存
- 当订阅源与当前请求同域，且路径命中 `/s/:id` 或 `/sub/:payload` 时，域层会直接在 Worker 内部解析，不再二次走公网 fetch
- 内部解析会沿用当前模板合并、覆写与节点过滤逻辑，但直接向父配置传递结构化节点，不再执行中间 YAML 序列化与二次解析
- 内部解析会对本地订阅循环引用做显式拦截，避免 `A -> B -> A` 递归超时

## Worker CPU 边界

- 渲染链路默认最多接收 10 个订阅源，受 `MAX_SUBSCRIPTION_COUNT` 控制
- 单次渲染默认最多处理 100 个输入节点，受 `MAX_PROXY_COUNT` 控制；限制同时覆盖远程订阅、内联节点、同域订阅与模板/覆写后的最终节点
- 订阅源按并发上限 4 分批抓取，缩短多源渲染延迟，同时避免同时打满上游
- `options.refresh = true` 强制绕过远程订阅与短链 YAML KV 缓存；正常模式仅缓存短链接最终 YAML
- 节点分享链接文本与 Base64 节点列表优先走轻量解析，只有 Clash YAML 内容才进入完整 YAML 解析
- 空规则增强与空 YAML 覆写不会复制整份配置对象
- 单行节点解析失败时跳过该行，不再让一个坏节点毁掉整个订阅；全局节点数量上限仍为必须强制的业务错误
- YAML 输出使用 `lineWidth: 0`，长节点名/URL 保持单行，输出更紧凑

## 配置负载护栏

- `/sub/:payload` 的 payload 上限 32KB（base64url 解码前检查）
- `routing.rules` ≤ 50、`routing.ruleProviders` ≤ 20、`transforms.replacements` ≤ 50
- `override.content` ≤ 64KB、`filterRegex` ≤ 1KB
- 以上限制同时约束未认证可访问的长链接路径，防止构造大 payload 消耗 CPU

## 安全模型

- 管理 API 需要会话 Cookie
- 密码来源于 `APP_PASSWORD`
- 会话签名来源于 `SESSION_SECRET`，未配置时拒绝签发/验证，不存在公开 fallback 密钥
- 会话签名比较使用恒定时间算法
- 登录失败按来源 IP 计数限速（10 次/15 分钟），成功登录清除计数；失败响应附加固定延时防时序探测
- 登录限速计数存放在 Cache API（边缘缓存）而非 KV：读写不消耗 KV 配额，仅在登录失败时产生操作；Cache API 为区域性、尽力而为的缓存，条目可能被回收或跨区域独立，限速因此是防御性降级而非绝对保证，关键场景可叠加 Cloudflare WAF Rate Limiting 规则
- 管理 API 请求体限制 1MB，响应统一 `Cache-Control: no-store`
- 未知 `/api/*` 路径返回 404 JSON，不会落入 SPA fallback
- 订阅链接视为敏感凭据，但保持公开可访问

## 当前实现状态

- Worker 入口已在 `src/index.js` 完成
- API 路由已按认证与业务边界拆分
- 内置模板由 `src/domain/builtin-templates.js` 直接提供，避免被静态资源 SPA fallback 污染
- 前端构建产物输出到 `public/`，Worker 直接托管
- 本地开发入口切换为 `frontend/vite.config.js` + `@cloudflare/vite-plugin`
- 开发时由 Vite 驱动 HMR，Worker 仍作为统一入口处理静态资源与动态接口
- 前端基础 UI 已迁移到 `shadcn/ui`，视觉主题继续由 `frontend/src/styles.css` 的暖色 token 控制
- 前端按页面做代码分割（`React.lazy`），登录页与编辑器按需加载，主包从 552KB 降至约 270KB
- `bun run build` 会先清理 `public/` 下旧前端产物再构建，部署上传量从约 8.1MB 降至约 0.6MB
- 首页与静态路径由 Workers Assets 直接服务，不执行 Worker（`run_worker_first` 排除 `/`、`/index.html`、`/favicon.ico`）
