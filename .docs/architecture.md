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

- `config.override` 作为单份配置的一部分参与长链接、短链接与实时预览，不新增独立 KV key
- 当前仅支持 `type: yaml`，内容在模板合并、规则增强、国家组生成之后执行
- YAML 覆写支持深度合并、`!` 整段替换、`+key` 前插数组、`key+` 后追加数组，以及 `<...>` 转义真实键名
- 扩展语法新增顶层 `$patches` 和值级 `$select`，用于按条件更新对象数组、upsert 策略组，以及从已有 `proxies` / `proxy-groups` 动态提取字段
- override 新增或修改过的 `proxy-groups` 会在最终输出前再次展开 `<all>` / `<countries>` / `<us>` 这类占位符
- `nodeList` 模式不会执行覆写；若存在覆写内容，渲染接口会返回 warning，避免静默失效

## 短链目录

- 管理台通过 `GET /api/links` 拉取短链摘要列表，仅返回 `id`、时间戳等目录信息
- 配置器导入区基于该目录做 autocomplete，仍允许用户粘贴任意 `/sub/:payload` 或 `/s/:id` 链接

## 同域订阅解析

- 远程订阅默认仍按 URL 抓取并进入 KV 缓存
- 当订阅源与当前请求同域，且路径命中 `/s/:id` 或 `/sub/:payload` 时，域层会直接在 Worker 内部解析，不再二次走公网 fetch
- 内部解析会沿用当前模板合并与节点过滤逻辑，并对本地订阅循环引用做显式拦截，避免 `A -> B -> A` 递归超时

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
