# 回归记录

## Phase 1

- 状态：已完成
- 目标：完成工程骨架、约束文件、基础文档
- 结果：`AGENTS.md`、`.tasks/`、`.docs/`、Wrangler、Bun、前后端骨架已建立

## Phase 2

- 状态：已完成
- 目标：实现认证、会话、中间件、KV 仓库
- 结果：已完成密码登录、Cookie 会话、模板仓库、短链仓库、缓存仓库

## Phase 3

- 状态：已完成
- 目标：实现订阅聚合、协议解析、模板合并与输出接口
- 结果：已支持长链接、短链接、实时渲染、Clash/Meta 输出和内置模板读取

## Phase 4

- 状态：已完成
- 目标：实现登录页、配置器、模板管理页
- 结果：管理台双页面已可用，前端构建成功输出到 `public/`

## Phase 5

- 状态：已完成
- 测试：
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - 4 个测试文件通过
  - 15 个测试用例通过
- 现存风险：
  - 国家识别规则为轻量关键词映射，不如上游映射表完整
  - 远程订阅解析已覆盖核心协议，但仍建议继续补更多真实样本夹具
  - KV eventual consistency 仍然意味着短链更新存在传播延迟

## UI 回归 2026-04-15 15:44 CST

- 状态：已完成
- 目标：按最新要求重构配置器布局与视觉层级
- 变更：
  - 配置器改为桌面端左右 50% 双栏，窄屏下回落为单列，预览位于页面底部
  - 顶部宣传卡片已移除，导入长链接/短链接改为顶部 `input + 解析`
  - “规则与 Provider” 改为 “规则”
  - 减少 section 卡片化表现，统一输入、按钮、切换器高度与更小圆角
- 测试：
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - 前端构建通过，`public/assets` 已更新
  - 4 个测试文件通过
  - 15 个测试用例通过
- 现存风险：
  - 本轮主要做结构与样式收口，未做真实浏览器截图级视觉回归
  - 模板管理页仍保持原有卡片布局，若要统一视觉语言，还需要单独收口

## UI 回归 2026-04-15 15:58 CST

- 状态：已完成
- 目标：将配置器中可新增的编辑区改为表头 + 多行结构，避免新增多个独立卡片
- 变更：
  - 订阅地址编辑区改为 table-like 单表头多行
  - Rule Provider、规则、替换规则同步切换为同类表格式编辑器
  - 表格中的前置开关改为紧凑模式，保证列对齐与行高统一
- 测试：
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - 前端构建通过，`public/assets` 已更新
  - 4 个测试文件通过
  - 15 个测试用例通过
- 现存风险：
  - 当前是响应式横向滚动表格，超窄屏可用性优先于完全无滚动
  - 模板管理页的动态编辑区尚未切换到同一套表格式结构

## UI 回归 2026-04-15 16:22 CST

- 状态：已完成
- 目标：统一自定义选择器与手动预览交互，继续收口表格空态和图标按钮
- 变更：
  - 原生 `select` 已替换为自定义下拉组件，并同步用于模板页
  - Rule Provider 的 `Behavior` 改为 autocomplete，内置 `domain`、`ipcidr`、`classical`，同时保留任意输入
  - 表格 0 行时仅显示居中的“添加”按钮，添加按钮改为图标 + 文字，删除改为 icon button
  - 配置器取消实时预览，改为手动点击预览并在 dialog 中查看结果
  - 配置器页面改回单列布局
- 测试：
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - 前端构建通过，`public/assets` 已更新
  - 4 个测试文件通过
  - 15 个测试用例通过
- 现存风险：
  - 自定义下拉当前以鼠标与基础键盘关闭为主，尚未补完整的方向键导航
  - 模板管理页仍未统一到与配置器一致的弱卡片单列语言

## 开发链路回归 2026-04-15 16:37 CST

- 状态：已完成
- 目标：将本地开发入口切换为 `Vite + @cloudflare/vite-plugin`，让 Worker 继续作为统一入口并支持前端 HMR
- 变更：
  - 根脚本 `bun run dev` 改为启动 `frontend` 下的 Vite 开发服务器
  - `frontend/vite.config.js` 在 `serve` 模式下接入 `@cloudflare/vite-plugin`
  - 生产构建保持原先 `public/` 产物输出，不让 Cloudflare 插件接管 `vite build`
- 测试：
  - `bun install`
  - `bun run build:frontend`
  - `timeout 10s bun run dev`
  - `bun run test`
- 结果：
  - 依赖安装成功，`bun.lock` 已更新
  - 前端构建通过，继续输出到 `public/index.html` 与 `public/assets/*`
  - `bun run dev` 可成功启动统一入口开发服务器
  - 4 个测试文件通过
  - 15 个测试用例通过
- 现存风险：
  - 若 `8787` 端口已被占用，Vite 会自动切换到下一个空闲端口
  - 当前仅在开发模式启用 Cloudflare Vite 插件，生产发布仍依赖现有 Wrangler + `public/` 目录流程
