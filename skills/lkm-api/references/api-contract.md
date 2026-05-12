# API Contract

> **Canonical spec.** The authoritative request/response specification for the LKM HTTP API is the apifox shared doc: <https://s.apifox.cn/58766e3c-d581-407f-a78e-7f84c35ad330>. Confirmed by 邹志勇 (LKM service owner) on 2026-05-12 in the Feishu group "gaia lkm 文档 skills 讨论" as the latest source. This file is a curated, agent-facing distillation — when it disagrees with apifox, apifox wins; bring this file back into sync.

> **Internal vs. external base URL.** Internal (`https://lkm.bohrium.com/api/v1`) and external (`https://open.bohrium.com/openapi/v1/lkm`) callers were unified to a single open gateway base on 2026-05-12 (邹志勇 / 黄远 in the same thread): every consumer should hit `https://open.bohrium.com/openapi/v1/lkm`, never the internal address. The gateway already strips any `/api/v1/` prefix the apifox doc shows on individual operations, so endpoint paths under this base are *just* `/search`, `/claims/match`, etc. — appending `/api/v1/search` returns 404.

Production base URL: **`https://open.bohrium.com/openapi/v1/lkm`**. Every endpoint below requires the header `accessKey: <bohrium-access-key>` (see `SKILL.md` → "Authentication" for the agent flow that obtains and persists the key).

## Search (public retrieval)

Endpoint:

```http
POST https://open.bohrium.com/openapi/v1/lkm/search
```

Headers:

```
accessKey: <bohrium-access-key>
content-type: application/json
```

Default body:

```json
{
  "query": "search terms",
  "top_k": 10,
  "scopes": ["claim"],
  "filters": {
    "visibility": "public"
  },
  "retrieval_mode": "hybrid",
  "evidence_only": false
}
```

Body field name is **`query`** (required) — distinct from `/claims/match`, which uses `text`. Empty or missing `query` → `code=290002` (`'Query' failed on the 'required' tag`).

Optional fields:

- `top_k` (integer): if omitted or `0`, the server returns its default (currently 20). Larger values (50, 100) work without complaint.
- `scopes` (string array — note plural; the singular `scope` is silently ignored): server-side enum is **fixed** as `[action, claim, question, setting]`. The error message itself enumerates this — sending any other value yields `code=290002 invalid scope: "<x>", valid values: [action, claim, question, setting]`.
  - `claim` returns `type:"claim"` rows (the historical shape).
  - `question` returns `type:"question"` rows. **This is a new variable type.** A question id does **not** resolve through `GET /claims/{id}/evidence` (the evidence endpoint is claim-only — feeding a question id returns `code=290004 claim not found`).
  - `action`, `setting` are reserved scopes — both production and test corpora currently return `data.variables: []` for them. Treat them as placeholders; do not build retrieval logic that depends on either having data.
- `filters.visibility` (string): defaults to `public` even when the entire `filters` block is omitted.
- `filters.role` (string): `premise` | `conclusion`. Filters `data.variables[]` to that role only.
- `retrieval_mode` (string): `lexical` | `semantic` | `hybrid`. Different scoring distributions:
  - `lexical` — BM25-like, scores in `[0, 1]`, top hits frequently `≈1.0`.
  - `semantic` — embedding-cosine-like distribution; scores spread more broadly.
  - `hybrid` — fused (default-shaped score magnitudes when `retrieval_mode` is omitted entirely).
- `evidence_only` (bool): if `true`, every returned variable carries `has_evidence: true` (i.e. at least one chain exists for it). **Constraint:** the server only accepts `evidence_only=true` together with `scopes` either *omitted entirely* or *equal to `["claim"]`* — combining it with `["question"]`, `["action"]`, `["setting"]`, or any multi-scope mix is rejected with `code=290002 invalid evidence_only constraint: evidence_only=true requires scopes=["claim"] only, got <…>`. Setting `evidence_only=false` (or omitting it) lifts the constraint.

Apifox names this surface "公开检索" (public retrieval). Both `/search` and `/claims/match` return per-entry results in `data.variables[]` keyed by the same paper provenance, but they are separate endpoints with distinct request bodies — keep `query` (search) and `text` (match) straight.

Response shape:

```json
{
  "code": 0,
  "data": {
    "variables": [
      {
        "id": "gcn_…",
        "type": "claim" | "question",
        "role": "premise" | "conclusion",
        "content": "...",
        "content_hash": "…",
        "score": 0.0,
        "has_evidence": true,
        "provenance": {
          "source_packages": ["paper:<id>"],
          "representative_lcn": { "local_id": "...", "package_id": "...", "version": "..." }
        },
        "visibility": "public"
      }
    ],
    "papers": {
      "paper:<id>": { /* paper-metadata block — see "Paper metadata block (data.papers)" below */ }
    }
  },
  "trace_id": "..."
}
```

Per-entry fields:

- `id`, `role`, `content`, `score`, `provenance`, `visibility` — same shape as `/claims/match`.
- `type` — `"claim"` for the historical conclusion/premise rows; `"question"` for question-scope rows (new).
- `content_hash` — stable hex digest of `content`, useful for deduping across calls.
- `has_evidence` — present (and `true`) on rows that the API knows have at least one evidence chain. Driven by `evidence_only` filtering or by intrinsic indexing — its absence does not strictly imply "no evidence", only "not flagged".

The `data.papers` map follows the shape used elsewhere in this contract — see "Paper metadata block (`data.papers`)" below for the full schema; do not redefine inline.

## Match (claim retrieval by free text)

Endpoint:

```http
POST https://open.bohrium.com/openapi/v1/lkm/claims/match
```

Headers:

```
accessKey: <bohrium-access-key>
content-type: application/json
```

Default body:

```json
{
  "text": "search terms",
  "top_k": 10,
  "filters": {
    "visibility": "public"
  }
}
```

Body field name is **`text`** (required). The old field name `query` is rejected with `code=290002` (`Field validation for 'Text' failed on the 'required' tag`).

Current endpoint behavior is understood as BM25-like free-text retrieval. Put
concise domain keywords or anchor phrases in `text`. Retrieval methodology
(number of queries, query families, candidate admission, and handoff rules)
belongs to the caller's SOP, not this API contract.

Response shape:

```json
{
  "code": 0,
  "data": {
    "new_claim_likely": false,
    "variables": [
      {
        "id": "gcn_…",
        "type": "claim",
        "role": "premise" | "conclusion",
        "content": "...",
        "score": 0.0,
        "provenance": {
          "source_packages": ["paper:<id>"],
          "representative_lcn": { "local_id": "...", "package_id": "...", "version": "..." }
        },
        "visibility": "public"
      }
    ],
    "papers": {
      "paper:<id>": { /* paper-metadata block, see below */ }
    }
  },
  "trace_id": "..."
}
```

The candidate list is at **`data.variables`** — note the rename from the previous endpoint family, which used `data.claims`. Per-entry structure: `id`, `type` (`"claim"`), `role` (`"premise"` | `"conclusion"`), `content`, `score`, `provenance` (with `source_packages` and `representative_lcn`), and `visibility`.

`score` is a retrieval ranking/debug signal from the match engine. Do not treat
it as scientific confidence, a truth probability, or a Gaia prior.

`data.new_claim_likely` and the top-level `trace_id` are diagnostic.

## Evidence

Endpoint:

```http
GET https://open.bohrium.com/openapi/v1/lkm/claims/{id}/evidence?max_chains=10&sort_by=comprehensive
```

Headers:

```
accessKey: <bohrium-access-key>
```

Response shape:

```json
{
  "code": 0,
  "data": {
    "claim": { "id": "gcn_…", "content": "..." },
    "total_chains": 1,
    "evidence_chains": [
      {
        "source_package": "paper:<id>",
        "factors": [
          {
            "id": "gfac_…",
            "factor_type": "strategy",
            "subtype": "noisy_and",
            "premises": [
              { "id": "gcn_…", "content": "..." }
            ],
            "conclusion": { "id": "gcn_…", "content": "..." },
            "steps": [ /* optional, see notes */ ]
          }
        ],
        "motivating_questions": [...]
      }
    ],
    "papers": {
      "paper:<id>": { /* paper-metadata block, see below */ }
    }
  }
}
```

Per-chain fields: `source_package`, `factors[]` (each with `id`, `factor_type`, `subtype`, `premises[]`, `conclusion`, optional `steps[]`), and `motivating_questions[]`. The top-level `data.total_chains` reports how many chains the API found for the claim.

`sort_by=premises` may not be valid on all deployments. Prefer `comprehensive` or `recent`.

## Paper metadata block (`data.papers`)

Both `/claims/match` and `/claims/{id}/evidence` return a `data.papers` map keyed by `paper:<id>`. Each entry has:

```json
{
  "id": "812085204238729217",
  "doi": "10.1088/0963-0252/15/3/021",
  "publication_id": "500",
  "publication_name": "Plasma Sources Science and Technology _ Plasma Sources Sci. Technol.",
  "zh_title": "...",
  "en_title": "...",
  "authors": "Last1 First1 | Last2 First2 | ...",
  "publication_date": "2006-8-1",
  "available_online": "2006-5-16",
  "cover_date_start": "2006-05-16",
  "area": "...",
  "research_categories": "...",
  "keywords": "...",
  "created_at": "..."
}
```

This is the API's authoritative paper-id → bibliographic-metadata map. Each chain's `source_package` (`paper:<id>`) keys into it. The API does not hydrate further: if `data.papers` is empty or missing a key the chain references, the only id available from this endpoint is `evidence_chains[].source_package` itself.

## Variables (Batch)

```http
POST https://open.bohrium.com/openapi/v1/lkm/variables/batch
```

Headers:

```
accessKey: <bohrium-access-key>
content-type: application/json
```

Body:

```json
{ "ids": ["var_id_1", "var_id_2"] }
```

Response shape:

```json
{
  "code": 0,
  "data": {
    "variables": [ /* hydrated variable objects */ ],
    "papers": { "paper:<id>": { /* paper-metadata block */ } },
    "not_found": ["var_id_unknown"]
  },
  "trace_id": "..."
}
```

Call only when a chain step references a `var_*` id. If no `var_*` ids appear in the chain, skip this endpoint.

## Error-code surface

Two distinct error families share the wire — easy to mix up. **Don't equate `HTTP 200` with success**: the LKM service signals failure inside the body, while the openapi gateway uses HTTP status codes.

### Gateway errors (`code: 2000`, HTTP 401)

Auth/transport failures handled by the Bohrium openapi gateway *before* the request reaches LKM. Body schema differs from the LKM family — `message` (top level) plus `error_detail` with a Bohrium-docs `reference`:

```json
{
  "code": 2000,
  "message": "AccessKey is required",   /* or "Invalid AccessKey" */
  "error_detail": {
    "code": 2000,
    "message": "未授权访问",
    "en_message": "Unauthorized",
    "description": "请求需要身份验证，但未提供有效的认证信息",
    "solution": "请在请求头中提供有效的accessKey",
    "reference": "https://open.bohrium.com/docs"
  },
  "trace_id": "...",
  "timestamp": 1778583083
}
```

If you see `code=2000`, do not retry blindly — the `accessKey` header is missing or invalid. Surface the failure to the user and ask whether the key is current.

### LKM-service errors (`code: 2900xx`, HTTP 200)

The HTTP status is `200` even when these fire. Inspect `code` + `error.msg`:

```json
{ "code": 290001, "error": { "msg": "hydrate provenance failed: batch get global variables failed: ... context deadline exceeded" } }
```

| Code | Meaning | Recovery |
|---|---|---|
| `0` | success | — |
| `290001` | transient downstream timeout in variable-hydration / scope fan-out (e.g. multi-scope `/search`) | Retry once after 1–3 s. Persistent across multiple retries → escalate as a server-side issue, do not work around it. |
| `290002` | request validation. Examples: `'Query' failed on the 'required' tag` (missing `query` on `/search`), `'Text' failed on the 'required' tag` (missing `text` on `/claims/match`), `invalid scope: "<x>", valid values: [action, claim, question, setting]`. | Fix the request body; do not retry as-is. |
| `290004` | `claim not found`. Fires for unknown claim ids on `GET /claims/{id}/evidence`, and also when feeding a `type:"question"` id to that endpoint (the evidence endpoint is claim-only). | Treat as terminal for that id; do not retry. |

Keep the `trace_id` in any failure log — the service team uses it for diagnosis.

## Known temporary: id-only premises

Some `factors[].premises[].id` entries currently come back with **empty `content`** even within the parent chain — only the id is populated. This is a temporary state of the corpus (LKM is being progressively populated); the id itself is preserved in the response. A standalone `GET /claims/{premise_id}/evidence` may recover content but often fails (see "premise A2 pit" below).

## Premise A2 pit

Premise ids listed inside `evidence_chains[].factors[].premises[]` may **not** resolve as standalone `GET /claims/{premise_id}/evidence` targets (`claim not found` or `total_chains == 0` despite full content being recoverable from the parent chain's `factors[].premises[].content`). This is a property of the API: the embedded id is not always indexed as a standalone claim.
