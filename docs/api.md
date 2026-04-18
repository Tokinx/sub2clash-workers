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

- `override.type`：当前仅支持 `yaml`
- `override.content`：YAML 覆写文本，随 `/api/render`、短链配置和长链接 payload 一起传递
- `override.content` 同时支持基础 merge 语法和项目自定义的 `$patches` / `$select` 扩展
- 当 `options.nodeList = true` 且 `override.content` 非空时，接口仍正常返回 YAML，但 `warnings` 会包含“仅输出节点列表时已忽略覆写”

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
