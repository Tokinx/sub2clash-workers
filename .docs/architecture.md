# 架构说明

## 分层

- `src/routes`：HTTP 路由与中间件组装
- `src/auth`：密码校验、Cookie 会话、鉴权
- `src/data`：KV 读写仓库
- `src/domain`：订阅抓取、解析、模板合并、YAML 输出
- `frontend/src`：登录页、配置器、模板管理页

## 前端分层

- `frontend/src/components/ui`：`shadcn/ui` 生成的基础 primitive，仅承载通用交互与无障碍能力
- `frontend/src/components/dashboard`：配置器领域组合组件，如表格编辑器、预览弹窗、自动补全输入
- `frontend/src/components`：壳层与少量品牌化组合组件，不新增第二套基础 UI primitive
- `frontend/src/pages`：页面只保留状态、派生数据、路由与 API 编排，不再内嵌复杂控件实现

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
- 前端基础 UI 正在迁移到 `shadcn/ui`，视觉主题继续由 `frontend/src/styles.css` 的暖色 token 控制
