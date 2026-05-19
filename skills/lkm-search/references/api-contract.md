# API Contract

<!-- DO NOT EDIT BY HAND. Regenerate with `python scripts/sync_apifox.py`. -->

This file is auto-generated from the Apifox OpenAPI export.
Apifox project: `6039175`.

Source title: **默认模块** (`1.0.0`).

Agent workflow, endpoint-selection guidance, known pitfalls, and CLI helper usage live in `SKILL.md`.

---

## GET /claims/{id}/reasoning

查询 claim 的推理链

给定单个 claim ID，返回支撑该结论的全部推理链，每条链包含前提（premises）、结论（conclusion）、
推理步骤（steps），以及驱动该 claim 的动机问题（motivating_questions）。常用于"为某条结论找证据 / 解释来源"。

**入参要点**：
- `id`（path）：必填，claim ID
- `max_chains`（query）：返回链数量上限，默认 10，最大 100
- `sort_by`（query）：`comprehensive`（按前提数量降序，默认）或 `recent`（按时间倒序）

**响应要点**：
- `reasoning_chains[]`：每条链含 premises / conclusion / steps / motivating_questions
- `total_chains`：未截断前的链总数

**业务码**（HTTP 始终 200）：
- `0`：找到 claim 且有推理链
- `290008`：找到 claim 但无任何推理链（业务子状态，data 仍含完整结构）
- `290004`：claim 不存在
- `290009`：查询超时，可重试
- `290002`：入参错误（id 空 / sort_by 非法）
- `290001`：其他查询错误

**调用示例**：`GET /v1/claims/gcn_abc123/reasoning?max_chains=5&sort_by=comprehensive`

### Parameters

| Name | In | Type | Required | Default | Description |
|------|----|------|----------|---------|-------------|
| `id` | path | string | yes |  | Claim ID |
| `max_chains` | query | integer | no | `10` | 推理链数量上限，默认 10，最大 100 |
| `sort_by` | query | string | no | `comprehensive` | 排序策略 |
| `AccessKey` | header | string | no |  |  |

### Response

业务错误，按响应体 code / msg 分类

_No JSON schema published in the OpenAPI export._

---

## POST /papers/graph

按论文取完整知识图谱

给定 `package_id` / `paper_id` / `doi` / `title` 任一标识，返回该论文（或 title 召回的多篇论文）从 LKM 抽取出来的
完整知识结构：variables（变量节点）、factors（推理 factor）、motivations（驱动问题）以及聚合统计。
适合"看一篇论文里 KB 提取了什么"或在论文页里渲染知识图谱。

**入参要点**：
- 四个标识至少传一个；同时传多个按 `package_id > paper_id > doi > title` 取生效项，其余忽略
- `package_id` 必须形如 `paper:<数字>`
- `include`：要返回哪些子图，默认 `["paper","variables","factors","motivations"]`；可追加 `priors` / `factor_params`
- `hydrate_factor_refs`：默认 true，factor 的前提 / 结论会展开成对象；置 false 仅返回 ID 引用（响应体小约 60%）
- `title_resolve.limit`：title 路径下每个 title 返回的候选论文上限，默认 5、最大 20

**响应要点**：
- 统一形态 `{ "papers": [ { paper, variables, factors, motivations, stats, ... } ] }`
- 非 title 路径：`papers` 长度为 1
- title 路径：`papers` 长度为命中候选数，每项含 `title_match_type`（`exact` 优先于 `keyword`）

**业务码**（HTTP 始终 200）：
- `0`：命中且至少一篇有 variables / factors
- `290002`：入参错误（全空 / package_id 形态非法 / include 含未知值）
- `290011`：论文不存在（任何标识都解析不到）
- `290013`：找到论文但 KB 侧未抽出任何图谱内容（data 仍含完整结构）
- `290009`：查询超时，可重试
- `290001`：其他查询错误

**请求示例**：
```json
{
"package_id": "paper:1020661015349559308",
"include": ["paper", "variables", "factors", "motivations"],
"hydrate_factor_refs": true
}
```

### Request Body

_No JSON schema published in the OpenAPI export._

### Response

业务错误，按响应体 code / msg 分类

_No JSON schema published in the OpenAPI export._

---

## POST /reasoning/search

推理链检索：按整条推理过程召回

用一段自然语言 `query`（可选关键词）直接在"推理链"粒度上检索，命中的每条结果包含完整的因子结构（前提→结论→步骤）、
驱动的动机问题以及来源论文。
与 `/v1/search` 的区别：本接口召回的是"整条推理过程"，而 `/v1/search` 召回的是单个节点。

**入参要点**：
- `query`：必填，自然语言描述
- `retrieval_mode`：`semantic` / `lexical` / `hybrid`，默认 `hybrid`
- `keywords`：可选关键词数组（≤ 10 个，每个 ≤ 100 字），仅影响 lexical 通道
- `filters.paper_ids`：可选论文 ID 数组（≤ 100，纯数字串，不含 `paper:` 前缀）；只在这些论文范围内召回
- `offset` / `limit`：分页，默认 `0 / 20`，`offset` 最大 10000，`limit` 最大 100

**响应要点**：
- `reasoning_chains[]`：命中链列表，每条含 `chain_id` / `paper_id` / `score` / `conclusion` / `factors` / `motivating_questions`
- `total`：未受 limit 截断的全量计数
- `papers`：被命中链引用到的论文元数据，按 `paper:<id>` 去重

**业务码**（HTTP 始终 200）：
- `0`：成功
- `290002`：入参错误（mode / keywords / paper_ids / 分页越界等）
- `290009`：查询超时
- `290001`：其他查询错误

**请求示例**：
```json
{
"query": "perovskite stability",
"retrieval_mode": "hybrid",
"keywords": ["FAPbI3"],
"filters": {"paper_ids": ["1020661015349559308"]},
"offset": 0,
"limit": 10
}
```

### Request Body

_No JSON schema published in the OpenAPI export._

### Response

业务错误，按响应体 code / msg 分类

_No JSON schema published in the OpenAPI export._

---

## POST /search

公开检索：claim /  question

用一段自然语言 query（可选若干关键词）跨 claim / question 节点做检索，
返回排序后的命中节点列表，便于上游做后续问答 / 推荐 / 引用召回。

**检索模式 retrieval_mode（默认 hybrid）**：
- `semantic`：按语义相近度召回，适合"措辞不同但意思相近"
- `lexical`：按关键词字面命中召回，适合"必须含某专业术语"
- `hybrid`：两路并发后融合，任意单路失败自动降级到另一路（推荐默认）

**入参要点**：
- `query`：必填，自然语言描述，建议 ≤ 200 字
- `scopes`：限定召回节点类型，空数组表示四类全查；取值见示例
- `keywords`：可选关键词数组（≤ 10 个，每个 ≤ 100 字），仅影响 lexical 通道；英文术语效果更佳
- `filters.visibility`：默认 `public`
- `filters.role`：可选，按角色过滤；常用取值 `conclusion` / `premise`，不传则不过滤
- `reasoning_only`（旧名 `evidence_only`，二选一即可）：true 时只返回**有推理链支撑的 claim**，
会自动把 scopes 收敛到 `["claim"]`、role 收敛到 `conclusion`；调用方若同时传冲突值会被拒绝
- `offset` / `limit`：分页，默认 `0 / 20`，`offset` 最大 10000，`limit` 最大 100

**响应要点**：
- `variables[]`：统一节点列表，按 `variables[i].type` 区分 claim / setting / question / action
- `total`：不受 limit 截断的全量计数，下一页判定：`offset + len(variables) < total`

**业务码**（HTTP 始终 200）：
- `0`：成功
- `290002`：入参错误（scopes / retrieval_mode / keywords / 分页越界 / reasoning_only 与 scopes 冲突等）
- `290001`：检索失败

**请求示例**：
```json
{
"query": "perovskite thermal stability",
"scopes": ["claim"],
"retrieval_mode": "hybrid",
"keywords": ["FAPbI3", "Cs doping"],
"filters": {"visibility": "public"},
"reasoning_only": true,
"offset": 0,
"limit": 20
}
```

### Parameters

| Name | In | Type | Required | Default | Description |
|------|----|------|----------|---------|-------------|
| `AccessKey` | header | string | no |  |  |

### Request Body

_No JSON schema published in the OpenAPI export._

### Response

业务错误，按响应体 code / msg 分类

_No JSON schema published in the OpenAPI export._

---

## POST /variables/batch

批量按 ID 取 variable 详情

已知 variable 的 ID 列表（通常由其他接口返回），批量回查完整内容、代表性表述、关联的 local 成员、
及其溯源论文等元信息。适用于"先检索拿到 ID 后再水合详情"的典型 KB 浏览场景。

**入参要点**：
- `ids`：必填，最多 100 个；服务端自动去空 / 去重；全空等价未传

**响应要点**：
- `variables[]`：按入参 ids 顺序返回的详情列表，含 `representative_lcn` / `local_members` / `provenance` / `papers` 等
- `not_found[]`：未命中的 ID 集合；命中部分仍正常返回，不影响整体成功
- 不做 visibility 过滤，由调用方按业务上下文决定是否进一步处理

**业务码**（HTTP 始终 200）：
- `0`：成功
- `290002`：入参错误（ids 空 / 超上限）
- `290001`：查询失败

**请求示例**：
```json
{"ids": ["gcn_abc123", "gcn_def456"]}
```

### Parameters

| Name | In | Type | Required | Default | Description |
|------|----|------|----------|---------|-------------|
| `AccessKey` | header | string | no |  |  |

### Request Body

_No JSON schema published in the OpenAPI export._

### Response

业务错误，按响应体 code / msg 分类

_No JSON schema published in the OpenAPI export._
