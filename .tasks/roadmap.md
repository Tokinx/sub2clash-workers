# 实施路线图

## Phase 1

- 建立约束文件、文档、根目录工程配置
- 初始化 Worker 与前端目录
- 建立测试与 Wrangler 配置
- 状态：已完成

## Phase 2

- 实现认证、会话、中间件
- 实现 KV 设置、模板、短链仓库
- 状态：已完成

## Phase 3

- 实现订阅抓取、解析与 YAML 生成
- 实现长链接、短链接与渲染 API
- 状态：已完成

## Phase 4

- 实现登录页、配置器、模板管理页
- 完成前端到后端联调
- 状态：已完成

## Phase 5

- 补充单元与集成测试
- 更新回归文档并完成交付说明
- 状态：已完成

## Phase 6

- 切换本地开发链路到 `Vite + @cloudflare/vite-plugin`
- 保持 Worker 统一入口，开发时支持前端 HMR
- 状态：已完成

## Phase 7

- 继续收口配置器分享区交互，移除自定义短链 ID 输入
- 将“复制长链接 / 生成短链接 / 预览 YAML”集中到同一操作区
- 状态：已完成

## Phase 8

- 推进前端 `tailwind-first`，减少 `styles.css` 中的组件语义样式
- 抽离通用按钮与表单 UI 组件，让页面更多只保留布局与业务状态
- 在不破坏现有页面布局的前提下完成收口
- 状态：已完成

## Phase 9

- 前端一次性迁移到 `shadcn/ui` 基座，停用手搓基础 UI primitive
- 建立 `components/ui`、`components.json`、`@` alias、前端测试基座
- 在保持 `DESIGN.md` 暖纸张与编辑部视觉语言的前提下重构登录页、配置器、模板页与弹窗交互
- 状态：已完成

## Phase 10

- 为短链接增加管理侧列表接口，支撑配置器导入区的自动补全
- 将 Dashboard 导入输入改为可搜索、可自定义输入的 autocomplete
- 同步补 Worker 与前端回归，更新 API 与架构文档
- 状态：已完成

## Phase 11

- 修复线上同域短链作为订阅源时的二次公网抓取问题
- 为 `/s/:id` 与 `/sub/:payload` 增加 Worker 内部解析能力，避免自引用链路触发 522
- 补充循环引用保护与对应回归测试
- 状态：已完成

## Phase 12

- 清理仓库内残留的真实线上域名、部署标识与测试敏感样式数据
- 在 `AGENTS.md` 明确“所有提交文件必须脱敏”的仓库级约束
- 同步更新回归文档，避免后续排障记录再次回流真实环境信息
- 状态：已完成

## Phase 13

- 为单份配置增加 YAML override，跟随长链接、短链接和预览全链路流转
- 在域层实现 Clash Party 风格覆写语义，并明确 `nodeList` 模式下的忽略 warning
- 在 Dashboard 增加覆写编辑区与格式化交互，补齐 Worker / 前端回归
- 状态：已完成

## Phase 14

- 为 YAML override 增加项目自定义扩展语法：`$patches` 条件更新、`$select` 动态提取
- 支持用 override 对对象数组做 `merge / replace / remove / upsert`，覆盖“前置节点 + dialer-proxy”这类声明式场景
- 补充完整 override 文档，并让 override 新增的 `proxy-groups` 也支持占位符展开
- 状态：已完成

## Phase 15

- 为配置器增加自动添加旗帜开关
- 渲染层按现有国家/地区识别规则为未包含旗帜的节点补齐 emoji 旗帜
- 补充 Worker 与前端回归，确保长链接、短链和预览都能保留该配置项
- 状态：已完成

## Phase 16

- 将规则增强在后端转换为内部覆写对象执行，保留现有 UI 与配置字段
- 让用户 YAML override 继续作为最终优先级，覆盖内部规则增强结果
- 补充 Worker 回归，覆盖规则顺序、同名 Rule Provider 替换和 nodeList 忽略 warning
- 状态：已完成

## Phase 17

- 为连接字符串转换增加 `wireguard` 协议支持
- 仅在 `Clash.Meta / Mihomo` 目标下保留 `wireguard` 节点，`Clash` 目标继续过滤
- 补充协议解析与渲染回归，明确 `wireguard://` / `wg://` 的兼容字段约定
- 状态：已完成

## Phase 18

- 为连接字符串转换增加 `ssh` 协议支持
- 当前仅支持 `ssh://username:password@server:port#name` 密码模式
- 仅在 `Clash.Meta / Mihomo` 目标下保留 `ssh` 节点，`Clash` 目标继续过滤
- 状态：已完成

## Phase 19

- 面向 Cloudflare Workers 免费版 CPU 限制优化订阅渲染热路径
- 同域订阅改为结构化传递节点，避免子链 YAML 序列化后被父链再次解析
- 增加订阅源与节点数量上限，默认最多 10 个订阅源、100 个输入节点
- 删除空规则增强、空覆写产生的无效深拷贝，并为节点文本/Base64 订阅增加快速分流
- 状态：已完成

## Phase 20

- 为连接字符串转换增加 `snell` 协议支持
- 仅在 `Clash.Meta / Mihomo` 目标下保留 `snell` 节点，`Clash` 目标继续过滤
- 支持 `snell://psk@server:port` 及 `version`、`obfs`、`obfs-host` 参数，并补充解析与渲染回归
- 状态：已完成

## Phase 21

- 为订阅源、Rule Provider、自定义规则和节点名替换表格增加行级 `enabled` 开关
- 新增行默认开启，历史配置缺少 `enabled` 时兼容为开启
- 关闭行继续保留在配置中，但不参与校验后的执行、订阅源数量限制、订阅抓取、规则增强和节点名替换
- 状态：已完成

## Phase 22

- 为短链接记录增加独立备注字段，不改变订阅配置与公开渲染行为
- 创建、更新、详情与目录接口统一返回备注，历史短链缺少备注时按空字符串兼容
- 配置器分享区支持填写和更新短链备注，顶部历史链接下拉菜单展示并支持按备注匹配
- 状态：已完成

## Phase 23

- 将外部订阅源 KV 缓存默认时长调整为 6 小时，并支持管理台逐条强制刷新外部订阅
- 仅为 `/s/:id` 增加最终 YAML KV 缓存，长链接与实时预览继续逐次渲染
- 建立外部订阅、自建模板与嵌套短链的依赖索引，变更时递归失效相关短链 YAML 缓存
- 状态：已完成
