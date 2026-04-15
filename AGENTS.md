# sub2clash-workers Agent Rules

## 核心约束

- 中文优先：分析、说明、注释、文档默认使用中文。
- 严格按当前实施方案推进，不擅自恢复远程模板、D1、TypeScript、多用户、模板上传。
- 技术栈固定为 Bun、JavaScript、Cloudflare Workers、Hono、React、Tailwind CSS。
- 前端设计必须遵循 `DESIGN.md`，保持暖纸张、陶土色、编辑部式层级与高辨识度排版。
- 状态层固定为 KV 分键设计：
  - `settings`
  - `link:{id}`
- 管理台与 `/api/*` 必须基于 Workers Secret 密码 + Cookie 会话保护。
- `/sub/:payload` 与 `/s/:id` 保持可供订阅客户端直接访问。

## 交付规则

- 任何结构性变更、接口调整、数据模型变化，先更新 `/.tasks/` 和 `/.docs/`。
- 每完成一个里程碑，必须执行对应测试，并更新 `/.docs/regression.md`。
- 不允许以临时补丁替代稳定实现；优先保持领域模型、接口和测试一致。
- 新增代码默认写在现有模块边界内，避免把业务逻辑塞进路由层。

## 当前范围

- 私有管理台登录
- 订阅聚合与转换
- 内置模板 + 自建模板管理
- 订阅连接
- Worker/KV/静态资源一体部署

## 当前非目标

- 远程模板 URL
- D1 或其他数据库
- 多用户与权限系统
- 模板版本历史
- 短链访问统计
