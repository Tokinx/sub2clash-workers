# 架构说明

## 分层

- `src/routes`：HTTP 路由与中间件组装
- `src/auth`：密码校验、Cookie 会话、鉴权
- `src/data`：KV 读写仓库
- `src/domain`：订阅抓取、解析、模板合并、YAML 输出
- `frontend/src`：登录页、配置器、模板管理页

## 存储模型

- `settings`：全局设置与自建模板
- `link:{id}`：短链配置

## 安全模型

- 管理 API 需要会话 Cookie
- 密码来源于 `APP_PASSWORD`
- 会话签名来源于 `SESSION_SECRET`
- 订阅链接视为敏感凭据，但保持公开可访问

## 当前实现状态

- Worker 入口已在 `src/index.js` 完成
- API 路由已按认证与业务边界拆分
- 内置模板由 `public/templates/` 静态托管
- 前端构建产物输出到 `public/`，Worker 直接托管
- 本地开发入口切换为 `frontend/vite.config.js` + `@cloudflare/vite-plugin`
- 开发时由 Vite 驱动 HMR，Worker 仍作为统一入口处理静态资源与动态接口
