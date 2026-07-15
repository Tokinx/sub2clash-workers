# API 设计

## 认证

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

## 模板

- `GET /api/templates`
- `POST /api/templates`
- `PUT /api/templates/:id`
- `DELETE /api/templates/:id`

## 配置转换

- `POST /api/render`
- `GET /sub/:payload`
- `GET /s/:id`

### `config` 关键字段

- `sources.subscriptions[].remark`：订阅源备注，仅用于管理台记录，不参与节点名渲染
- `sources.subscriptions[].enabled`：订阅源行开关；默认 `true`，为 `false` 时不抓取且不计入订阅源数量限制
- `routing.ruleProviders[].enabled`：Rule Provider 行开关；默认 `true`，为 `false` 时不生成 provider 与对应 `RULE-SET`
- `routing.rules[].enabled`：自定义规则行开关；默认 `true`，为 `false` 时不写入最终规则
- `transforms.replacements[].enabled`：节点名替换行开关；默认 `true`，为 `false` 时不执行对应正则替换
- 以上行级开关只有显式布尔值 `false` 才会关闭；旧配置未提供 `enabled` 时继续按开启处理，关闭行仍保留在配置 payload 中
- `override.type`：当前仅支持 `yaml`
- `override.content`：YAML 覆写文本，随 `/api/render`、短链配置和长链接 payload 一起传递
- `override.content` 同时支持基础 merge 语法和项目自定义的 `$patches` / `$select` 扩展
- `options.autoFlag`：默认 `false`；开启后会按节点名识别国家/地区并为未包含旗帜的节点名前缀对应 emoji 旗帜
- 当 `options.nodeList = true` 且存在规则增强或覆写内容时，接口仍正常返回 YAML，但 `warnings` 会提示对应配置已被忽略
- 单次配置默认最多包含 10 个订阅源，由 `MAX_SUBSCRIPTION_COUNT` 调整
- 单次渲染默认最多处理 100 个输入节点，由 `MAX_PROXY_COUNT` 调整；远程订阅、内联节点、同域订阅及模板/覆写最终结果均受此限制
- `options.refresh = true` 会绕过远程订阅 KV 缓存；当前不缓存最终 YAML

## 短链

- `GET /api/links`
- `POST /api/links`
- `GET /api/links/:id`
- `PUT /api/links/:id`
- `DELETE /api/links/:id`

## 返回约定

- 认证失败：`401`
- 参数错误：`400`
- 不存在：`404`
- 远程加载或模板处理失败：`422`
- 服务内部错误：`500`
