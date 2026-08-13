# 回归记录

## 订阅源与短链 YAML 长时缓存回归 2026-07-15

- 状态：已完成
- 目标：将外部订阅缓存延长至 6 小时，为单个外部源提供手动刷新，并仅缓存短链接最终 YAML
- 变更：
  - `SUB_CACHE_TTL_SECONDS` 默认值调整为 21600 秒，同时控制外部订阅与短链 YAML KV 缓存
  - 管理台订阅表格在关闭全局强制刷新时显示逐行刷新按钮；关闭行、非法地址和同域地址不可刷新
  - 新增受会话保护的 `POST /api/subscriptions/refresh`，使用 `no-store` 更新单个外部订阅，失败时保留旧缓存
  - `/s/:id` 在非强制刷新模式下缓存最终 YAML、统计、warning 与 `subscription-userinfo`；长链接和实时预览不缓存
  - 新增外部源、自建模板和嵌套短链依赖索引；订阅刷新、短链更新/删除、模板更新/删除会递归失效父短链缓存
  - 同域 `/s/:id` 与 `/sub/:payload` 继续内部解析，不再写入外部订阅缓存
- 测试：
  - `bun run test:worker -- tests/unit/cache.test.js tests/unit/render.test.js tests/integration/api.test.js tests/unit/http.test.js`
  - `bun run test:frontend -- src/components/dashboard/editors.test.jsx src/pages/DashboardPage.test.jsx`
  - `bun run test`
  - `bun run build:frontend`
  - `git diff --check`
- 结果：
  - Worker 定向回归：4 个测试文件、32 个用例通过
  - 前端定向回归：2 个测试文件、15 个用例通过
  - 完整回归：Worker 侧 8 个测试文件、76 个用例通过；前端 7 个测试文件、25 个用例通过
  - 前端生产构建成功，差异格式检查通过
- 现存风险：
  - 依赖反向索引基于 KV 读改写，极端并发修改同一依赖集合时仍受 KV eventual consistency 影响
  - 已生成的静态资源主包约 551 kB，Vite 继续提示单 chunk 超过 500 kB，本次缓存功能未扩大既有代码拆分范围

## Workers 订阅抓取缓存参数修复 2026-07-15

- 状态：已完成
- 目标：修复关闭“强制刷新订阅缓存”且 KV 未命中时，Workers 因不支持 `cache: "default"` 而无法抓取远程订阅的问题
- 变更：
  - 普通远程抓取不再向 Workers `fetch` 传入 `cache` 字段，由 KV 继续负责订阅内容缓存
  - 强制刷新仍显式使用 `cache: "no-store"`，并继续绕过 KV 缓存读写
  - 新增 HTTP 抓取单元测试，分别覆盖普通模式省略 `cache` 和强制刷新使用 `no-store`
- 测试：
  - `bun run test:worker -- tests/unit/http.test.js tests/unit/render.test.js`
  - `bun run test`
- 结果：
  - Worker 定向回归：2 个测试文件、22 个用例通过
  - 完整回归：Worker 侧 7 个测试文件、68 个用例通过；前端 7 个测试文件、23 个用例通过
- 现存风险：
  - 远程订阅抓取仍依赖目标服务的可访问性；网络错误、超时和非成功状态码会继续按既有逻辑返回 422

## 表格行级开关回归 2026-07-15

- 状态：已完成
- 目标：为订阅源、Rule Provider、自定义规则和节点名替换表格增加默认开启的行级开关，关闭后执行链路自动跳过对应行
- 变更：
  - 四类表格统一新增“启用”列并固定在“操作”前一列，新建行显式写入 `enabled: true`
  - 前后端配置归一化以“仅显式 `false` 表示关闭”为兼容规则，历史长链接、短链和 KV 配置缺少字段时继续按开启处理
  - 关闭行继续保留在配置 payload 中，可保存不完整内容；渲染时不会抓取关闭的订阅源，也不会应用关闭的 Provider、规则或替换项
  - 订阅源数量限制只统计开启行，关闭的非法替换正则不会进入执行阶段，`nodeList` warning 也只判断开启的规则增强
- 测试：
  - `bun run test:worker -- tests/unit/config.test.js tests/unit/render.test.js`
  - `bun run test:frontend -- src/lib/config.test.js src/components/dashboard/editors.test.jsx`
  - `bun run test:frontend -- src/components/dashboard/editors.test.jsx`
  - `bun run test`
  - `bun run build:frontend`
  - `git diff --check`
- 结果：
  - Worker 定向回归：2 个测试文件、26 个用例通过
  - 前端定向回归：2 个测试文件、15 个用例通过
  - “启用”列名称与位置定向回归：1 个测试文件、11 个用例通过
  - 完整回归：Worker 侧 6 个测试文件、66 个用例通过；前端 7 个测试文件、23 个用例通过
  - 前端生产构建成功，差异格式检查通过
- 现存风险：
  - 单节点文本输入与全局过滤正则不是表格行，本次不增加行级开关，继续沿用原有启用语义

## Snell 连接字符串回归 2026-07-11

- 状态：已完成
- 目标：为连接字符串转换增加 `snell` 协议支持，并明确其仅在 `Clash.Meta / Mihomo` 目标下保留
- 变更：
  - `src/domain/parsers/index.js` 新增 `snell://` 解析器，输出 Mihomo 所需的 `psk`、`version` 与可选 `obfs-opts`
  - `version` 仅接受 1 至 5，缺省时输出 1；`obfs` 仅接受 `http`、`tls`、`shadow-tls`，`obfs-host` 必须随 `obfs` 一同提供
  - 协议支持矩阵已更新为仅在 `meta` 目标保留 `snell`，`clash` 目标继续过滤
  - `README.md`、`docs/architecture.md` 与 `/.tasks/roadmap.md` 已同步更新支持范围和连接字符串约定
- 测试：
  - `bun run test:worker -- tests/unit/parsers.test.js tests/unit/render.test.js`
  - `bun run test`
- 结果：
  - 定向 Worker 回归：2 个测试文件、45 个用例通过
  - 完整回归：Worker 侧 6 个测试文件、63 个用例通过；前端 7 个测试文件、16 个用例通过
  - 已覆盖 URL 编码 PSK、版本默认值与边界、非法参数、混淆字段映射，以及 `meta` 保留和 `clash` 过滤
- 现存风险：
  - 当前仅支持 `snell://` 前缀及 PSK、版本、混淆模式/主机名字段；`reuse`、`client-fingerprint`、ShadowTLS 密码和版本等 Mihomo 扩展参数暂未纳入

## CPU 优化回归 2026-07-11

- 状态：已完成
- 目标：降低 Workers 免费版单请求 CPU 预算下的订阅渲染开销，优先覆盖同域聚合和常规小规模订阅
- 变更：
  - 同域 `/s/:id` 与 `/sub/:payload` 订阅改为传递结构化 `proxies`，不再产生子链 YAML 序列化与父链二次 YAML 解析
  - 新增 `MAX_PROXY_COUNT`（默认 100）和 `MAX_SUBSCRIPTION_COUNT`（默认 10）；远程、内联、同域和覆写后的最终节点均受限
  - 节点文本与 Base64 节点列表优先走逐行解析，只有非节点列表内容才尝试 YAML 解析
  - 空 routing 与空 override 不再触发整份配置 JSON 深拷贝
- 测试：
  - `bun run test`
  - 本机合成基准：20 / 100 节点同域嵌套渲染中位墙钟约为 2.1ms / 4.7ms
- 结果：
  - Worker 侧 6 个测试文件、58 个测试用例通过
  - 前端 7 个测试文件、16 个测试用例通过
  - 已覆盖同域覆写节点传递、节点与订阅源上限、远程订阅为内联节点预留容量和订阅文本解析
- 现存风险：
  - 基准为本机 Bun 墙钟，不能替代 Cloudflare 线上 `cpuTime`；部署后应通过 Workers Observability 观察真实请求分布
  - `options.refresh = true` 仍会绕过远程订阅 KV 缓存，符合强制刷新语义，当前未缓存最终 YAML

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

## 订阅输出回归 2026-04-15 18:10 CST

- 状态：已完成
- 目标：修复内置模板在开发环境下被 SPA fallback 的 `index.html` 污染，导致 `/sub/*` 输出顶部出现 `"0": "<"` 等脏字段
- 变更：
  - 内置模板内容改为由后端域层直接提供，不再依赖 `ASSETS.fetch`
  - 模板合并前新增 YAML 顶层对象校验，阻止字符串/数组模板继续进入合并流程
  - 补充回归测试，覆盖 `ASSETS` 返回 HTML 时 builtin 模板仍能正常渲染
- 测试：
  - `bun run test`
- 结果：
  - 内置模板渲染已与静态资源 SPA fallback 解耦
  - `/sub/:payload` 与 `/s/:id` 不会再因为读到 `index.html` 产出脏 YAML

## 配置器分享区回归 2026-04-15 18:22 CST

- 状态：已完成
- 目标：移除“自定义短链 ID”输入，统一分享区主操作按钮位置
- 变更：
  - 删除“自定义短链 ID”前端入口，短链统一走系统生成 ID
  - 后端创建短链逻辑不再接收 `customId`，避免前端删除入口后接口仍保留旧能力
  - 将“生成短链接”移动到“复制长链接”旁边
  - 将“预览 YAML”从导入区移到长链接操作区
- 测试：
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - 分享区顶部主操作已合并为“复制长链接 / 生成短链接 / 预览 YAML”
  - 导入区仅保留“解析”，短链仍可正常生成与更新
  - 后端创建短链已不再接受 `customId`，删除前端入口后不存在隐藏旧能力

## Tailwind 收口回归 2026-04-15 18:45 CST

- 状态：已完成
- 目标：在保持现有 Dashboard 布局不变的前提下，改为更偏 `tailwind-first` 的实现方式
- 变更：
  - 抽离通用 `Button` 组件，减少页面内重复按钮 class
  - 将表单控件样式尽量收口到组件内部，减少 `styles.css` 中的 `field-*` 规则
  - 页面层优先保留布局、间距、响应式，降低语义样式类的直接使用
- 测试：
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - `styles.css` 已收缩为主题 token 与全局基底样式，不再承载按钮、表单、弹窗、表格等组件语义样式
  - 新增通用 `Button` 组件并接入 Dashboard、Templates、Shell、Login
  - `Fields.jsx` 改为组件内部自带 Tailwind 样式，页面层主要保留布局与业务状态

## shadcn 迁移回归 2026-04-15

- 状态：已完成
- 目标：将前端基础交互层切换为 `shadcn/ui`，并补齐前端测试基座
- 变更：
  - 新增 `frontend/components.json`、`frontend/jsconfig.json`、`frontend/src/components/ui/*`，前端基础组件统一改为 `shadcn/ui`
  - 登录页、配置器、模板页、Shell、预览弹窗均已切到 `shadcn/ui` 组合实现，旧 `Fields.jsx` 已移除
  - `frontend/src/styles.css` 已改为 `shadcn` CSS variables 主题层，并保留暖纸张、陶土色和编辑部式排版 token
  - 新增前端 `vitest + jsdom + Testing Library` 测试基座，根测试脚本改为同时跑 Worker 与前端测试
- 测试：
  - `bun run build:frontend`
  - `bun run test:frontend`
  - `bun run test:worker`
  - `bun run test`
- 结果：
  - 前端构建通过，继续输出到 `public/index.html` 与 `public/assets/*`
  - Worker 侧 4 个测试文件、16 个测试用例通过
  - 前端 4 个测试文件、7 个测试用例通过
  - 根测试脚本已可串联 Worker 与前端回归
- 现存风险：
  - `DashboardPage` 虽已拆出编辑器组件，但仍有进一步下沉分享区与选项区的空间
  - 前端测试以行为回归为主，尚未加入浏览器截图级视觉回归
  - jsdom 环境在 Shell 登出路径上仍会打印一次 `navigation to another Document` 提示，但不影响浏览器中的真实行为

## 短链自动补全回归 2026-04-16 13:17 CST

- 状态：已完成
- 目标：将 Dashboard 导入输入升级为可搜索的短链 autocomplete，同时保留手动输入 `/sub/*` 与 `/s/*`
- 变更：
  - 新增 `GET /api/links`，短链列表仅返回 `id`、`createdAt`、`updatedAt` 摘要，不暴露完整配置
  - `DashboardPage` 顶部导入区改为 autocomplete，下拉展示已生成短链接，仍支持用户自定义输入并解析相对路径
  - 短链创建、更新、删除后会同步刷新前端短链目录状态，分享区按钮补充更明确的无障碍名称
  - Dashboard 表格编辑区补齐“新增订阅 / 新增 Rule Provider / 新增规则 / 新增替换规则”按钮文本
- 测试：
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - Worker 侧 4 个测试文件、16 个测试用例通过
  - 前端 4 个测试文件、7 个测试用例通过
  - 根测试链路通过，短链导入、生成、复制与预览行为均完成回归
- 现存风险：
  - 当前短链目录来自 KV `list`，条目数量继续增长时仍需考虑分页或最近使用裁剪
  - jsdom 仍会在 Shell 登出测试中打印一次 `navigation to another Document` 提示，但不影响浏览器真实行为

## 部署脚本回归 2026-04-16 15:10 CST

- 状态：已完成
- 目标：提供一键部署脚本，并在发布前清理旧的前端构建产物，避免 `public/assets` 长期堆积历史 hash 文件
- 变更：
  - 根目录新增 `clean:public`、`build:deploy`、`deploy`、`deploy:dry-run`、`deploy:keep-vars`
  - 新增 `scripts/prepare-public.mjs`，仅清理 `public/index.html` 和 `public/assets/`
  - README 部署说明改为优先使用 `bun run deploy*` 系列脚本
- 测试：
  - `bun run build:deploy`
- 结果：
  - 发布前可稳定清理旧前端产物，同时保留 `public/templates/`
  - 一键部署入口已统一收口到根脚本，减少手动拼接构建与发布命令
- 现存风险：
  - `deploy:dry-run` 与 `deploy` 仍依赖真实 Cloudflare 认证、有效 KV Namespace ID 与已配置 secrets，无法在未登录环境下完成端到端验证

## 同域短链聚合回归 2026-04-16 17:30 CST

- 状态：已完成
- 目标：修复线上将本项目生成的 `/s/:id` 短链再次作为订阅源时，Worker 通过公网二次抓取同域链接而触发 `522` 的问题
- 变更：
  - `src/domain/render.js` 新增同域 `/s/:id` 与 `/sub/:payload` 的 Worker 内部解析逻辑，不再对这类本地订阅做公网 `fetch`
  - 渲染链路新增本地订阅活动集合，用于显式拦截循环引用并返回 `422`
  - 更新架构文档与路线图，明确“同域内联解析 + 循环引用保护”的实现边界
- 测试：
  - `bun run test:worker -- tests/unit/render.test.js`
  - `bun run test:worker`
  - `bun run test`
  - `bun run deploy:dry-run`
  - `bun run deploy`
  - `curl -iL https://deploy.example.com/s/example-merged-link`
- 结果：
  - Worker 侧 4 个测试文件、18 个测试用例通过
  - 新增回归已覆盖“同域短链聚合不走远程抓取”和“循环引用返回 422”
  - 线上目标短链已从 `422 + 522` 恢复为 `200`，返回正常 YAML
  - 正式部署版本 ID 已脱敏
- 现存风险：
  - 同域内联解析按请求 origin 生效；若混用自定义域名与平台默认域名，仍会回退到远程抓取逻辑
  - `bun run test` 中前端 `frontend/src/pages/DashboardPage.test.jsx` 现有 2 条断言失败，与本次后端修复无直接代码关联，部署前已单独确认 Worker 测试与线上链路通过

## UDP 字段输出回归 2026-04-16 17:52 CST

- 状态：已完成
- 目标：当页面未开启 UDP 时，不再给解析出的节点显式写入 `udp: false`；仅在页面开启或链接自身明确携带 `udp` 参数时输出该字段
- 变更：
  - `src/domain/parsers/index.js` 新增 UDP 字段解析 helper，统一为“有值才输出字段”
  - `ss`、`ssr`、`vmess`、`vless`、`trojan`、`socks5`、`anytls` 解析器已切换到该策略
  - 新增协议解析回归测试，覆盖“默认不输出”“页面开启输出 true”“链接显式 `udp=false` 保留 false”
- 测试：
  - `bun run test:worker -- tests/unit/parsers.test.js tests/unit/render.test.js`
  - `bun run test:worker`
- 结果：
  - Worker 侧 4 个测试文件、21 个测试用例通过
  - 页面未开启 UDP 时，生成结果不再出现多余的 `udp: false`

## SS-2022 密钥回归 2026-04-16 17:58 CST

- 状态：已完成
- 目标：修复 `ss-2022` 节点在解析时被错误二次解码，导致 Mihomo/Clash 校验密钥长度时报 `required 32, got 24`
- 变更：
  - `src/domain/parsers/index.js` 中 `ss` 解析器对 `2022-*` cipher 停止执行密码二次 base64 解码
  - `ss` 用户名和密码在解析前先做 URL decode，避免 `%3D` 之类转义残留到最终 YAML
  - 新增单测覆盖 `ss-2022` password 原样保留 base64 输出
- 测试：
  - `bun run test:worker -- tests/unit/parsers.test.js tests/unit/render.test.js`
- 结果：
  - `ss-2022` 节点输出将恢复为合法的 base64 PSK
  - 定向回归 2 个测试文件、18 个测试用例通过

## SS-2022 双段密钥回归 2026-04-16 18:08 CST

- 状态：已完成
- 目标：修复 `ss://<base64(method:password)>@host:port` 形式下，`2022-blake3-aes-256-gcm` 的 `base64-1:base64-2` 双段密钥在解析后被截断为仅 `base64-1` 的问题
- 变更：
  - `src/domain/parsers/index.js` 为 `ss` 解析器新增 `splitOnce`，仅在解出 `method:password` 时按首个冒号分割，保留密码中的剩余冒号内容
  - 新增协议解析回归测试，覆盖 `ss-2022` 双段密钥在 legacy base64 userinfo 形式下完整保留
- 测试：
  - `bun run test:worker -- tests/unit/parsers.test.js tests/unit/render.test.js`
- 结果：
  - `ss-2022` 的 `base64-1:base64-2` 双段 key 现已完整输出
  - 定向回归 2 个测试文件、19 个测试用例通过

## Hysteria2 密码解码回归 2026-04-16 18:11 CST

- 状态：已完成
- 目标：修复 `hysteria2` 节点输出中的 `password` / `obfs-password` 残留 `%3D` 等 URL 编码字符的问题
- 变更：
  - `src/domain/parsers/index.js` 中 `parseHysteria2` 对 `password` 与 `obfs-password` 统一做 URL decode
  - 新增协议解析回归测试，覆盖 `hysteria2` 带 `%3D` 的 `password` 和 `obfs-password`
- 测试：
  - `bun run test:worker -- tests/unit/parsers.test.js tests/unit/render.test.js`
- 结果：
  - `hysteria2` 节点输出将恢复为客户端可直接使用的明文密码
  - 定向回归 2 个测试文件、20 个测试用例通过

## 仓库脱敏回归 2026-04-16 18:15 CST

- 状态：已完成
- 目标：清理仓库文档与测试夹具中残留的真实线上环境标识，并将“所有提交文件必须脱敏”固化为仓库规则
- 变更：
  - `AGENTS.md` 新增仓库级脱敏约束，明确禁止提交真实订阅地址、真实域名、真实密码/密钥、真实邮箱、真实部署标识与真实线上返回片段
  - `tests/unit/parsers.test.js` 中协议回归样例已切换为占位常量与合成数据，不再引用真实线上密码样式
  - 本文档中的真实自定义域名、平台默认域名地址与部署版本号已统一改为脱敏描述
- 检查：
  - 使用 `rg` 对 `tests/`、`.docs/`、`.tasks/`、`AGENTS.md` 做真实域名与敏感样式扫描
- 结果：
  - 当前仓库内已提交的测试与回归文档不再依赖真实订阅数据
  - 后续新增提交可按 `AGENTS.md` 中的脱敏规则进行统一约束

## User-Agent 默认值回归 2026-04-16 18:30 CST

- 状态：已完成
- 目标：将远程订阅 `User-Agent` 改为默认留空，仅在用户主动填写时才随请求发送，并为输入框补充可选提示文案
- 变更：
  - `src/domain/config.js` 中 `userAgent` 默认值改为空字符串
  - `frontend/src/lib/config.js` 中空配置初始值同步改为空字符串
  - `frontend/src/pages/DashboardPage.jsx` 的 `User-Agent` 输入框新增 placeholder：`获取远程订阅时携带的 User-Agent 标识（可选）`
- 测试：
  - `bun run test:worker -- tests/unit/config.test.js tests/unit/render.test.js`
  - `cd frontend && bun run vitest run src/pages/DashboardPage.user-agent.test.jsx`
- 结果：
  - 未填写 `User-Agent` 时，配置默认不再注入内置标识
  - 前端页面默认展示空输入，并通过 placeholder 明确该项为可选

## YAML 覆写回归 2026-04-18 CST

- 状态：已完成
- 目标：为单份配置增加 YAML override，并让覆写内容随长链接、短链接和预览全链路流转
- 变更：
  - `src/domain/config.js` 与 `frontend/src/lib/config.js` 新增 `override: { type, content }` 配置段，当前仅接受 `type: yaml`
  - `src/domain/yaml-override.js` 新增覆写合并器，支持深度合并、`!` 整段替换、`+key` 前插数组、`key+` 后追加数组和 `<...>` 转义真实键名
  - `src/domain/render.js` 调整为“模板合并 -> 应用 override -> deepClean -> YAML 输出”，并在 `nodeList` 模式返回“仅输出节点列表时已忽略覆写” warning
  - `frontend/src/pages/DashboardPage.jsx` 新增“配置覆写”编辑区与 YAML 格式化按钮，导入长链接/短链接时可回填 override 内容
  - 更新 `.docs/architecture.md`、`.docs/api.md`、`.tasks/roadmap.md`，明确 override 字段、渲染顺序与 `nodeList` 特例
- 测试：
  - `bun run test:worker -- tests/unit/config.test.js tests/unit/yaml-override.test.js tests/unit/render.test.js tests/integration/api.test.js`
  - `cd frontend && bun run test -- src/pages/DashboardPage.test.jsx src/pages/DashboardPage.user-agent.test.jsx`
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - Worker 侧 6 个测试文件、33 个测试用例通过
  - 前端 5 个测试文件、8 个测试用例通过
  - 前端生产构建通过，`public/index.html` 与 `public/assets/*` 已更新
- 现存风险：
  - 当前仅支持 YAML override，不支持 JavaScript override
  - Vite 生产构建仍提示主包体积超过 500 kB，本次未处理拆包

## YAML 覆写语法扩展回归 2026-04-18 CST

- 状态：已完成
- 目标：让 YAML override 能覆盖对象数组条件修改、upsert 策略组和动态提取现有节点字段的场景，替代一部分原本必须依赖 JavaScript override 的需求
- 变更：
  - `src/domain/yaml-override.js` 新增顶层 `$patches` 和值级 `$select`
  - `$patches` 支持 `merge / replace / remove / upsert`，并提供 `match` 条件匹配和 `position` 插入位置
  - `match` 支持 `equals`、`in`、`notIn`、`includes`、`notIncludes`、`startsWith`、`endsWith`、`regex`、`exists`
  - `src/domain/render.js` 在 override 之后新增一轮 `proxy-groups` 占位符展开，让 override 插入的 `<all>` 等占位符也能正常工作
  - 新增 [.docs/override.md](./override.md)，汇总完整语法、执行顺序、限制和示例
- 测试：
  - `bun run test:worker -- tests/unit/yaml-override.test.js tests/unit/render.test.js`
  - `bun run test`
  - `bun run build:frontend`
- 结果：
  - Worker 侧 6 个测试文件、39 个测试用例通过
  - 前端 5 个测试文件、8 个测试用例通过
  - YAML override 现已能表达“按节点名命中后写入 `dialer-proxy`”“不存在则 upsert 前置节点组”“从 `proxies` 动态提取名字列表”等场景
  - override 新增的策略组中使用 `<all>` 不会再原样泄漏到最终 YAML
- 现存风险：
  - `$patches` 当前要求 `target` 指向已存在的数组字段，不会自动创建缺失路径
  - `$select` 当前只支持返回数组，不支持聚合、去重和排序等更复杂表达式

## 订阅备注回归 2026-04-21 14:54 CST

- 状态：已完成
- 目标：取消“节点前缀”能力，改为订阅源“备注”字段，并保持历史长链接、短链配置可继续导入和渲染
- 变更：
  - 配置模型从 `sources.subscriptions[].prefix` 收口为 `sources.subscriptions[].remark`
  - 订阅备注仅用于管理台记录，不再参与订阅节点名拼接
  - 前端导入层与后端校验层均兼容历史 `prefix` 字段，旧长链接与已生成短链无需迁移即可继续使用
  - 补充 Worker 与前端回归测试，覆盖 `prefix -> remark` 归一化与“备注不改写节点名”
- 测试：
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - 前端构建通过，`public/` 产物已刷新
  - Worker 侧 6 个测试文件、40 个测试用例通过
  - 前端 5 个测试文件、8 个测试用例通过
- 现存风险：
  - 既有 KV 里的短链配置仍可能保留原始 `prefix` 字段，当前依赖运行时兼容读取；若后续需要统一存量数据，需额外设计迁移脚本

## 表格编辑焦点回归 2026-04-26 19:47 CST

- 状态：已完成
- 目标：修复配置器各表格行使用首列字段作为 React key，导致编辑首列时输入框重挂载并丢失焦点的问题
- 变更：
  - `frontend/src/components/dashboard/editors.jsx` 新增前端本地稳定行 key 管理，行身份不再依赖 `url`、`name`、`value`、`pattern` 等可编辑业务字段
  - 表格增删改统一走稳定行操作函数，删除中间行时同步移除对应本地 key，避免内部状态错配
  - 新增 `frontend/src/components/dashboard/editors.test.jsx`，覆盖订阅、Rule Provider、规则、替换四类表格首列输入后的焦点保持
- 测试：
  - `bun run test:frontend`
  - `bun run build:frontend`
- 结果：
  - 前端 6 个测试文件、12 个测试用例通过
  - 前端生产构建通过，未改变保存配置的数据结构
- 现存风险：
  - Vite 生产构建仍提示主包体积超过 500 kB，本次未处理拆包

## 表格拖拽排序回归 2026-06-01 14:34 CST

- 状态：已完成
- 目标：为配置器中的数组型表格增加拖拽排序，保留现有字段结构与保存语义
- 变更：
  - `frontend/src/components/dashboard/editors.jsx` 在稳定行 key 管理中加入行重排逻辑，拖拽时同步移动本地 key 与业务行数据
  - 订阅、Rule Provider、规则、替换规则四类表格新增统一的排序把手列
  - 拖拽状态使用当前陶土色系高亮，不改变已有表格布局和数据模型
- 测试：
  - `cd frontend && bun run test -- src/components/dashboard/editors.test.jsx`
  - `bun run test:frontend`
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - Worker 侧 6 个测试文件、40 个测试用例通过
  - 前端 6 个测试文件、13 个测试用例通过
  - 前端生产构建通过，未改变保存配置的数据结构
  - 新增覆盖订阅表格拖拽排序后的渲染顺序回归
- 现存风险：
  - 当前实现基于浏览器原生 HTML Drag and Drop，桌面端体验优先；触屏端拖拽手感需后续用真实设备回归

## 自动添加旗帜回归 2026-06-01 15:01 CST

- 状态：已完成
- 目标：为配置器增加“自动添加旗帜”开关，开启后按节点名识别国家/地区并补齐 emoji 旗帜
- 变更：
  - 新增 `options.autoFlag`，默认关闭，长链接、短链接和预览 payload 均会保留该选项
  - `src/domain/country.js` 为现有国家/地区识别规则补充旗帜映射，并在节点名已包含 emoji 旗帜时跳过
  - `src/domain/render.js` 在过滤、替换、名称去重之后补齐旗帜，并再次确保节点名唯一
  - Dashboard 选项区新增“自动添加旗帜”开关，沿用当前 shadcn Switch 与暖纸张视觉风格
  - 前端 Vitest include 扩展到 `.test.js`，让纯 JS 配置 helper 测试纳入回归
- 测试：
  - `bun run test:worker -- tests/unit/config.test.js tests/unit/render.test.js`
  - `bun run test:frontend`
  - `bun run test:worker`
  - `bun run build:frontend`
  - `bun run test`
- 结果：
  - Worker 侧 6 个测试文件、42 个测试用例通过
  - 前端 7 个测试文件、16 个测试用例通过
  - 前端生产构建通过，未改变已有配置字段含义
  - 新增覆盖默认关闭、开启后补旗帜、已有旗帜不重复添加和前端预览 payload 携带开关
- 现存风险：
  - 国家/地区识别仍沿用当前轻量关键词表，未命中的节点不会自动补旗帜

## 规则增强与配置覆写后端融合回归 2026-06-01 16:22 CST

- 状态：已完成
- 目标：在不改变 UI、长链接 payload 和短链配置结构的前提下，让规则增强走后端内部覆写链路，并保持用户 YAML 覆写最终优先级
- 变更：
  - `src/domain/yaml-override.js` 新增 `applyParsedOverride`，让已解析对象和用户 YAML 共用同一套合并、整段替换、数组操作与 `$patches` 逻辑
  - `src/domain/render.js` 将规则增强从模板合并逻辑拆出，改为基于当前模板结果生成内部覆写对象后执行
  - 内部规则增强会继续把后置 Rules 和后置 Rule Provider 插入到 `MATCH` 之前，并对同名 Rule Provider 做整段替换
  - 用户 `override.content` 仍在内部规则增强之后执行，可覆盖 `rules` 或同名 `rule-providers`
  - `nodeList` 模式继续不执行规则增强与覆写，并在存在相关配置时返回 warning
- 测试：
  - `bun run test:worker -- tests/unit/yaml-override.test.js tests/unit/render.test.js`
  - `bun run test`
- 结果：
  - Worker 侧 2 个目标测试文件、23 个测试用例通过
  - 完整回归中 Worker 侧 6 个测试文件、46 个测试用例通过
  - 完整回归中前端 7 个测试文件、16 个测试用例通过
  - 新增覆盖规则增强输出顺序、同名 Rule Provider 替换、用户覆写最终优先级和 nodeList 忽略提示
- 现存风险：
  - 本轮只做后端融合，前端仍保留规则增强表格与覆写编辑区两个入口

## WireGuard 连接字符串回归 2026-06-22 16:14 CST

- 状态：已完成
- 目标：为连接字符串转换增加 `wireguard` 协议支持，并明确其仅在 `Clash.Meta / Mihomo` 目标下保留
- 变更：
  - `src/domain/parsers/index.js` 新增 `wireguard` 解析器，兼容 `wireguard://` 与 `wg://` 前缀
  - `wireguard` 分享链接当前采用“服务端地址 + query 参数”格式，支持映射 `private-key`、`public-key`、`pre-shared-key`、`ip`、`ipv6`、`dns`、`mtu`、`reserved`、`udp`、`dialer-proxy`
  - 协议支持矩阵已更新为仅在 `meta` 目标保留 `wireguard`，`clash` 目标继续过滤
  - `README.md`、`docs/architecture.md` 与 `/.tasks/roadmap.md` 已同步更新支持范围和实现边界
- 测试：
  - `bun run test:worker -- tests/unit/parsers.test.js tests/unit/render.test.js`
- 结果：
  - Worker 侧 2 个目标测试文件、31 个测试用例通过
  - 新增覆盖 `wg://` 前缀、地址别名、`reserved` 数组、`dns`、`udp`、`dialer-proxy` 解析
  - 新增覆盖 `meta` 目标保留 `wireguard` 与 `clash` 目标过滤 `wireguard`
- 现存风险：
  - `wireguard://` 分享格式在生态内缺少统一标准，本次实现采用与 Mihomo YAML 字段直接对应的 query 参数约定；若后续需要兼容其他生成器方言，应基于真实样例再扩展别名

## SSH 连接字符串回归 2026-06-24 11:28 CST

- 状态：已完成
- 目标：为连接字符串转换增加 `ssh` 协议支持，并明确当前仅支持密码模式且仅在 `Clash.Meta / Mihomo` 目标下保留
- 变更：
  - `src/domain/parsers/index.js` 新增 `ssh` 解析器，采用 `ssh://username:password@server:port#name` 格式
  - `ssh` 解析结果映射到 Mihomo 所需的 `server`、`port`、`username`、`password` 字段，并对 URL 编码后的用户名和密码做 decode
  - 当 `ssh` 链接缺少用户名或密码时，解析器会显式报错 `SSH 节点暂只支持密码认证`
  - 协议支持矩阵已更新为仅在 `meta` 目标保留 `ssh`，`clash` 目标继续过滤
  - `README.md`、`docs/architecture.md` 与 `/.tasks/roadmap.md` 已同步更新支持范围和连接字符串约定
- 测试：
  - `bun run test:worker -- tests/unit/parsers.test.js tests/unit/render.test.js`
  - `bun run test:worker`
- 结果：
  - Worker 侧 2 个目标测试文件、35 个测试用例通过
  - 完整回归中 Worker 侧 6 个测试文件、53 个测试用例通过
  - 新增覆盖 `ssh` 的基础识别、URL decode、无密码报错、`meta` 目标保留与 `clash` 目标过滤
- 现存风险：
  - 当前未支持 SSH 私钥认证、`host-key` 等扩展字段；若后续需要兼容更多 Mihomo `ssh` 字段，应基于真实分享样例继续扩展 query 参数约定

## 短链备注回归 2026-07-15 CST

- 状态：已完成
- 目标：生成订阅短链接时可设置备注，并在配置器顶部历史链接下拉菜单中展示备注信息
- 变更：
  - `link:{id}` 记录新增顶层 `remark`，与 `config` 分离，不参与 `/s/:id` 渲染
  - 短链创建、更新、详情与目录接口统一返回备注；备注去除首尾空白并限制为 100 个字符
  - 历史 KV 记录缺少备注时按空字符串兼容，更新接口未提供备注时保留原值
  - 配置器分享区新增短链备注输入；导入、生成、更新和删除短链时同步维护备注状态
  - 顶部历史短链候选项展示备注，并把备注纳入候选匹配排序
- 测试：
  - `bun run test:worker -- tests/integration/api.test.js`
  - `cd frontend && bun run test -- src/pages/DashboardPage.test.jsx`
  - `bun run test`
  - `bun run build:frontend`
- 结果：
  - Worker 侧 6 个测试文件、66 个测试用例通过
  - 前端 7 个测试文件、23 个测试用例通过
  - 前端生产构建通过，`public/` 静态产物已刷新
- 现存风险：
  - 短链目录仍基于 KV `list` 且未分页；备注只增加少量 metadata 体积，不改变既有扩展性边界
  - Vite 仍提示主包体积超过 500 kB，本次未处理拆包

## 短链备注展示微调回归 2026-07-15 CST

- 状态：已完成
- 目标：让历史短链备注与更新时间保持同一行，并让短链备注输入框占满可用宽度
- 变更：
  - 历史短链候选项辅助信息统一为 `备注 · 最近更新：YYYY-MM-DD HH:mm:ss`
  - 无备注的历史短链仍只显示最近更新时间
  - 移除短链备注输入区域的最大宽度限制，沿用现有全宽输入控件样式
- 测试：
  - `cd frontend && bun run test -- src/pages/DashboardPage.test.jsx`
  - `bun run build:frontend`
- 结果：
  - Dashboard 目标测试文件 2 个测试用例通过
  - 前端生产构建通过
- 现存风险：
  - Vite 仍提示主包体积超过 500 kB，本次未处理拆包

## 全面审查与资源优化回归 2026-08-13

- 状态：已完成
- 目标：全面审查 Worker、前端与构建链路，实施资源成本、安全、可靠性三类优化
- 资源成本：
  - `/sub/:payload` 与 `/s/:id` 增加边缘缓存头（`s-maxage` 21600 / 300），refresh 请求 `no-store`；边缘命中时 Worker 零执行
  - 短链 YAML 缓存写入与依赖索引同步移至 `waitUntil` 后台并行执行；命中路径 KV 读从 2 次降为 1 次
  - 依赖索引仅在集合变化时写入 KV，冷渲染不再产生写放大
  - 上游抓取 4xx 不再重试（出站请求数 ÷3），仅 5xx/超时/网络错误退避重试
  - 订阅源按并发上限 4 分批抓取，缩短多源渲染延迟
  - `bun run build` 先清理旧前端产物；部署上传量从约 8.1MB 降至约 0.6MB
  - 前端页面级代码分割：主包 552KB → 270KB（gzip 174KB → 86KB），编辑器重依赖懒加载
  - `run_worker_first` 排除 `/`、`/index.html`、`/favicon.ico`，首页直接由 Assets 服务
- 安全：
  - 移除 `SESSION_SECRET` 硬编码 fallback，未配置时拒绝签发/验证会话
  - 会话签名改用恒定时间比较
  - 登录失败按 IP 限速（10 次/15 分钟）+ 固定延时，成功登录清除计数；计数存放于 Cache API，不消耗 KV 配额
  - `/sub/:payload` payload 上限 32KB；rules ≤ 50、ruleProviders ≤ 20、replacements ≤ 50、override ≤ 64KB、filterRegex ≤ 1KB
  - 未知 `/api/*` 返回 404 JSON；API 响应统一 `no-store`；请求体限制 1MB
- 可靠性：
  - 单行节点解析失败跳过坏行，不再毁掉整个订阅；非法 payload 返回 400 而非 500
  - filterRegex 每次 test 前重置 lastIndex，防止状态化误过滤
  - YAML 输出 `lineWidth: 0` 不折行
- 测试：
  - `bun run test:worker`
  - `bun run test:frontend`
  - `bun run test`
  - `bun run build`
- 结果：
  - Worker 侧 8 个测试文件、93 个用例通过（新增 17 个：缓存头、限速、护栏、404、会话篡改/过期/错误密钥、依赖索引跳过、并发抓取、坏行跳过、过滤行为）
  - 前端 7 个测试文件、25 个用例通过
  - 前端生产构建成功，产物仅约 600KB
- 现存风险：
  - `/s/:id` 边缘缓存 TTL 为 5 分钟：修改链接配置后最长 5 分钟生效（KV 精确失效不受影响，refresh 分支不缓存）
  - 边缘缓存命中期间 `subscription-userinfo` 流量统计头最长滞后 6 小时（`/sub/:payload`）
  - wrangler v4.13 schema 不支持 assets 自定义 `cache_control`，hashed 资源缓存沿用 Assets 默认 ETag/条件请求
  - 登录限速计数为 KV 键（`rate:login:{ip}`），带 TTL 自动过期，不占用永久存储

## Workers Caching 缓存层回归 2026-08-13

- 状态：已完成
- 目标：将订阅输出接入 Workers Caching 缓存层，管理台变更可即时失效边缘缓存
- 变更：
  - 升级 wrangler 4.122 / vitest 4 / vitest-pool-workers 0.21（vitest.config 迁移到 cloudflareTest() 插件）
  - 新增 SubscriptionEntrypoint（cache.enabled=true）承载 /s/ 与 /sub/ 输出，命中缓存时 Worker 不执行；default 入口保持 gateway 语义并转发订阅路径，无 exports 环境走内联兜底
  - /s/:id 与 /sub/:payload 边缘缓存 TTL 统一为 21600 秒；响应携带 Cache-Tag（link:{id}）
  - 更新/删除短链、更新/删除模板、订阅手动刷新后，按失效 link id 经 purgeByTags RPC 精确清除 Workers Caching 条目，改配置即时生效
  - 登录限速计数迁移到独立 Cache API 命名空间 caches.open("sub2clash:ratelimit")
  - 部署自动冷缓存：Worker 版本是缓存 key 的一部分，发版后旧缓存自动失效
- 测试：
  - `bun run test:worker`
  - `bun run test:frontend`
  - `bun run test`
  - `bun run build`
- 结果：
  - Worker 侧 8 个测试文件、98 个用例通过（新增：缓存入口分发链路、失效 id 返回、purge RPC 调用）
  - 前端 7 个测试文件、25 个用例通过
  - 前端生产构建成功
- 现存风险：
  - Workers Caching 为较新能力，生产行为（缓存命中、purge、部署冷缓存）需部署后通过 cf-cache-status 与 Observability 实测验证
  - purge 使用 zone purge API 的速率限制体系，管理操作频率极低，实际不会触限
  - vitest 4 已知噪音：miniflare isolate 内被正确断言的 rejection 仍报告 unhandled（cloudflare/workers-sdk#14736），不影响断言正确性
