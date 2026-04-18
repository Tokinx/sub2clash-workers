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
