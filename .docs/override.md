# YAML 覆写语法

本文档描述本项目当前支持的 YAML override 语法。它分为两层：

- 基础层：兼容 Clash Party 风格的深度合并语法
- 扩展层：项目自定义的 `$patches` / `$select`，用于条件匹配数组项和动态提取现有配置数据

当前不支持 JavaScript override。

## 执行顺序

渲染阶段的顺序如下：

1. 先完成模板合并、规则增强、节点解析、国家组生成
2. 执行基础 YAML override
3. 按顺序执行 `$patches`
4. 对最终 `proxy-groups` 再做一次 `<all>` / `<countries>` / `<us>` 这类占位符展开
5. `deepClean` 清理空对象、空数组、`null`，再输出 YAML

这意味着 override 永远拥有最终优先级。

## 基础语法

### 1. 普通键：深度合并

```yaml
dns:
  enable: true
  enhanced-mode: fake-ip
```

- 对象字段按 key 递归合并
- 标量字段直接覆盖

### 2. `foo!`：整段替换

```yaml
rules!:
  - MATCH,DIRECT
```

- 不做递归合并，直接整体替换 `rules`

### 3. `+foo`：数组前插

```yaml
+rules:
  - DOMAIN-SUFFIX,example.com,DIRECT
```

- 只能用于数组字段
- 会把新数组插到原数组前面

### 4. `foo+`：数组后追加

```yaml
rules+:
  - GEOIP,private,DIRECT
```

- 只能用于数组字段
- 会把新数组追加到原数组后面

### 5. `<...>`：转义真实键名

```yaml
<proxy-groups+>: raw-value
```

- 当真实 key 本身带有 `+`、`!` 这类特殊字符时，使用尖括号转义
- `raw-value` 会写入真实字段 `proxy-groups+`

## 扩展语法：`$patches`

`$patches` 是本项目新增的保留顶层 key，用于对数组字段做“按条件命中后再修改”的操作。

```yaml
$patches:
  - target: proxies
    op: merge
    match:
      name:
        includes: "| 落地"
    value:
      dialer-proxy: 前置节点
```

### Patch 字段

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `target` | 是 | 点路径，必须指向一个已存在的数组字段，如 `proxies`、`proxy-groups`、`dns.nameserver` |
| `op` | 是 | `merge` / `replace` / `remove` / `upsert` |
| `match` | 否 | 命中条件；缺省时表示命中全部元素 |
| `value` | 视操作而定 | `merge` / `replace` / `upsert` 会使用该值 |
| `position` | 否 | 仅 `upsert` 插入时生效，支持 `start` / `end`，默认 `end` |

### `op` 说明

#### `merge`

把 `value` 深度合并到所有命中的数组项。

要求：

- 目标数组元素必须是对象
- `value` 必须是对象

#### `replace`

把所有命中的数组项整体替换为 `value`。

#### `remove`

删除所有命中的数组项。

#### `upsert`

行为分两种：

- 如果命中了现有数组项：
  - `value` 是对象时，按 `merge` 处理
  - `value` 不是对象时，按 `replace` 处理
- 如果一个都没命中：
  - 按 `position` 插入新元素

## `match` 语法

`match` 是一个对象，每个字段都会以 AND 关系同时成立。

```yaml
match:
  name:
    notIn:
      - DIRECT
      - REJECT
    notIncludes: "| 落地"
```

### 字段路径

- `match.name`：匹配对象字段 `name`
- `match.servername`：匹配对象字段 `servername`
- `match.tls.sni`：匹配嵌套字段
- `match.$self`：匹配数组元素本身，常用于标量数组

### 支持的操作符

| 操作符 | 说明 |
| --- | --- |
| `equals` | 深度相等 |
| `in` | 当前值在给定数组中 |
| `notIn` | 当前值不在给定数组中 |
| `includes` | 字符串包含子串，或数组包含给定元素 |
| `notIncludes` | `includes` 的反向判断 |
| `startsWith` | 字符串前缀匹配 |
| `endsWith` | 字符串后缀匹配 |
| `regex` | 正则匹配 |
| `exists` | 是否存在该字段 |

### 简写

如果不写操作符，直接按“相等”匹配：

```yaml
match:
  name: 前置节点
```

等价于：

```yaml
match:
  name:
    equals: 前置节点
```

## 动态提取：`$select`

`$select` 只能作为一个值对象单独出现，用来从当前配置里动态提取数组内容。

```yaml
proxies:
  $select:
    from: proxies
    field: name
    where:
      name:
        notIn:
          - DIRECT
          - REJECT
```

### 字段

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `from` | 是 | 点路径，必须指向数组字段 |
| `field` | 否 | 提取每个元素的某个字段；省略时返回完整元素 |
| `where` | 否 | 与 `$patches[].match` 相同的匹配语法 |

### 行为

- `$select` 返回的是一个数组
- 如果配置了 `field`，会提取每个命中项的该字段
- 如果某个命中项没有该字段，会跳过，不会输出 `null`

## 示例

### 1. 给所有“落地”节点加 `dialer-proxy`

```yaml
$patches:
  - target: proxies
    op: merge
    match:
      name:
        includes: "| 落地"
    value:
      dialer-proxy: 前置节点
```

### 2. 不存在时新增“前置节点”策略组

```yaml
$patches:
  - target: proxy-groups
    op: upsert
    position: start
    match:
      name: 前置节点
    value:
      name: 前置节点
      type: select
      proxies:
        $select:
          from: proxies
          field: name
          where:
            name:
              notIn:
                - DIRECT
                - REJECT
              notIncludes: "| 落地"
```

### 3. 对应你那段 JavaScript 的 YAML 版本

```yaml
+rules:
  - DOMAIN-SUFFIX,30420400.xyz,DIRECT
  - DOMAIN-SUFFIX,buf1.osid.cn,编程开发
  - DOMAIN-SUFFIX,qmye.com,编程开发

$patches:
  - target: proxy-groups
    op: upsert
    position: start
    match:
      name: 前置节点
    value:
      name: 前置节点
      icon: https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/Gcp.png
      type: select
      proxies:
        $select:
          from: proxies
          field: name
          where:
            name:
              notIn:
                - DIRECT
                - REJECT
              notIncludes: "| 落地"

  - target: proxies
    op: merge
    match:
      name:
        includes: "| 落地"
    value:
      dialer-proxy: 前置节点
```

### 4. override 新增的 group 也支持 `<all>`

```yaml
$patches:
  - target: proxy-groups
    op: upsert
    match:
      name: 全部节点
    value:
      name: 全部节点
      type: select
      proxies:
        - <all>
```

在本项目里，这类 override 新增 group 会在最终输出前再次展开占位符。

## 限制

- 当前只支持 YAML override，不支持 JavaScript override
- `$patches` 只在顶层保留；如果你确实要写真实字段 `$patches`，请使用 `<$patches>`
- `patch.target` 必须指向已存在的数组字段，不会自动创建缺失路径
- `nodeList` 模式不会执行 override；若 override 非空，会返回 warning
