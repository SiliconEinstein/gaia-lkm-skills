---
name: lkm-api
description: Query the Bohrium Large Knowledge Model (LKM) HTTP API. Covers the four endpoints (`POST /search`, `POST /claims/match`, `GET /claims/{id}/evidence`, `POST /variables/batch`), the `accessKey` auth contract, request/response shapes, the `data.papers` paper-metadata block, the `/search` v2 features (server-side `scopes`, `retrieval_mode`, `evidence_only`, plus the new `type:"question"` variable rows and `has_evidence` / `content_hash` response fields), and the two error-code families (gateway `code=2000` HTTP 401, and the LKM `code=2900xx` family at HTTP 200). Atomic: this skill is the API surface only — it does not prescribe retrieval methodology, root-selection policy, or downstream handoffs.
---

# LKM API

## Purpose

Talk to the Bohrium LKM HTTP API. This skill describes the endpoints, auth, request and response shapes, and the API's known quirks. It does not decide how the responses should be filtered, ranked, gated, or routed downstream — those are caller concerns.

Preserve raw responses verbatim — every field (claim ids, source packages, factors, premises, `total_chains`, `data.papers`, `trace_id`) is potentially load-bearing for the caller's audit.

## Canonical spec

The authoritative LKM HTTP API specification is the apifox shared doc: <https://s.apifox.cn/58766e3c-d581-407f-a78e-7f84c35ad330>. Confirmed by 邹志勇 (LKM service owner) on 2026-05-12 in the Feishu group "gaia lkm 文档 skills 讨论". When this skill (SKILL.md, references/, scripts/) disagrees with apifox, **apifox wins** — open an issue or PR to bring this skill back into sync rather than working around it.

## Default endpoint (production)

Use **`https://open.bohrium.com/openapi/v1/lkm`** as the base URL. As of 2026-05-12 this is the unified internal+external base — do not point the skill at the legacy internal address (`https://lkm.bohrium.com/api/v1`) or any non-production deployment. The gateway already strips the `/api/v1/` prefix that the apifox spec shows on individual operations: append only `/search`, `/claims/match`, etc. — adding `/api/v1/...` returns 404 from this gateway.

Four endpoints (all on this base):

- search: `POST /search`
- match: `POST /claims/match` (kept alive for back-compat; new callers should prefer `/search`)
- evidence: `GET /claims/{id}/evidence` (claim ids only — feeding a `type:"question"` id returns `code=290004`)
- variables: `POST /variables/batch`

Every request requires an `accessKey: <AK>` header (Bohrium access key). See **Authentication** below.

Read `references/api-contract.md` for request/response field-level expectations.

The `match` endpoint is currently understood as BM25-like free-text retrieval.
Callers should send concise domain keywords or anchor phrases in `text`; this
skill does not prescribe query-count, root-selection, or downstream mapping
policy.

`/search` exposes additional v2 controls — `scopes` (server-side enum `[action, claim, question, setting]`; `action` and `setting` are reserved placeholders with no data), `retrieval_mode` (`lexical` | `semantic` | `hybrid`), and `evidence_only`. See `references/api-contract.md` → "Search (public retrieval)" for the full schema.

## Authentication (access key)

Every endpoint requires an `accessKey` HTTP header carrying the user's Bohrium access key. The CLI helper (`scripts/lkm.py`) reads the key from the env var `LKM_ACCESS_KEY` and exits with a clear error if it is unset. Direct `curl` calls must include the same header.

**Agent flow on first use of this skill in a session:**

1. Check whether `LKM_ACCESS_KEY` is set in the shell (e.g. `printenv LKM_ACCESS_KEY`).
2. If unset, **ask the user once** for their Bohrium access key. Phrase the ask explicitly so the user knows what is being requested and why.
3. Once the user provides it, persist it for reuse:
   - **Current session:** `export LKM_ACCESS_KEY=<key>` so subsequent `lkm.py` calls in this session pick it up. Do **not** echo or log the key after exporting.
   - **Future sessions:** if the agent has a persistent memory facility, save the access key there so future invocations of this skill can read it back without re-asking. If no such facility exists, instruct the user to add the export line to their shell rc themselves — do not edit the user's shell rc without explicit permission.
4. Reuse the same key for every subsequent request in the run; do not re-ask.

**Never** write the access key into any file inside the repo (skills/, scripts/, references/, working folders, JSON artifacts), into a commit message, into a saved transcript, or into any cloud-uploaded artifact. The key is a per-user secret.

If a request returns an authentication error, surface it to the user and ask whether the key is current; do not silently retry with a different key.

## Skill Auto-Update

Each `lkm.py` invocation forks a detached async subprocess that asks the upstream GitHub repo for the latest CalVer release tag (`git ls-remote --tags https://github.com/SiliconEinstein/gaia-lkm-skills.git`). The check is best-effort: it runs with a 10-second timeout, network/parse failures are absorbed silently, and the user-facing API call is never blocked or delayed.

State files (both gitignored, both local-only):

- `skills/lkm-api/.skill-version` — last known upstream CalVer tag (e.g. `v2026.05.10`).
- `skills/lkm-api/.skill-version-notif` — one-shot pending notification, written by the async worker and consumed on the *next* `lkm.py` invocation.

Flow:

1. The user-facing invocation first prints any pending notification to stderr (`[lkm-api] new tag <X> available …`) and deletes the notif file — so each detection nags exactly once.
2. It then spawns the async check (fire-and-forget, detached via `start_new_session=True`, all stdio routed to `DEVNULL`) and proceeds to the regular verb dispatch.
3. The async worker compares upstream's latest CalVer tag to the local marker. If newer, it rewrites the marker and writes a notification to be surfaced next time.

Pull is **agent-guided**, not silent. When the agent sees the stderr notification, it reasons with the user about whether to update — this skill never auto-pulls and never clears any caches.

Skills that call `lkm.py` (`$lkm-explorer`, `$evidence-subgraph`, and other LKM-using skills) inherit this check automatically. Pure-doc skills that don't shell out to `lkm.py` aren't covered, and don't need to be.

## Response shape — paper metadata block

Both `/claims/match` and `/claims/{id}/evidence` return a `data.papers` map keyed by paper id (`paper:<id>`):

```json
{
  "data": {
    "new_claim_likely": false,  /* /claims/match only — diagnostic boolean */
    "variables": [...]  /* /claims/match: role ∈ {premise, conclusion}; /evidence uses "claim" + "evidence_chains" instead */,
    "papers": {
      "paper:812085204238729217": {
        "id": "812085204238729217",
        "doi": "10.1088/...",
        "publication_id": "500",
        "publication_name": "...",
        "zh_title": "...",
        "en_title": "...",
        "authors": "A. Last | B. Last | ...",
        "publication_date": "YYYY-M-D",
        "available_online": "...",
        "cover_date_start": "YYYY-MM-DD",
        "area": "...",
        "research_categories": "...",
        "keywords": "...",
        "created_at": "..."
      }
    }
  }
}
```

`data.papers` is the API's authoritative paper-id → bibliographic-metadata map. Each chain's `source_package` (`paper:<id>`) resolves to an entry in this map. If `data.papers` is empty or missing a key the chain references, the only id available is `evidence_chains[].source_package` itself — the API does not hydrate further.

## Error-code surface

Two distinct error families share the wire — easy to mix up. **`HTTP 200` does not mean "success"**: the LKM service signals failure inside the body, while the openapi gateway uses HTTP status codes. See `references/api-contract.md` → "Error-code surface" for the full table.

### Gateway errors (`code=2000`, HTTP 401)

Auth failures from the Bohrium openapi gateway, before the request reaches LKM:

```json
{ "code": 2000, "message": "AccessKey is required",
  "error_detail": { "reference": "https://open.bohrium.com/docs", ... } }
```

`message` is `"AccessKey is required"` (header missing) or `"Invalid AccessKey"` (header rejected). Do not retry blindly — surface to the user and re-confirm the key. This family also has `error_detail` and `timestamp`, distinguishing it from the LKM `2900xx` family below.

### LKM-service errors (`code=2900xx`, HTTP 200)

| Code | Meaning | Recovery |
|---|---|---|
| `0` | success | — |
| `290001` | transient downstream timeout (variable-hydration sub-call, multi-scope `/search` fan-out, …) | Retry once after 1–3 s; persistent across retries → escalate. |
| `290002` | request validation. Examples: missing `query` (`/search`) or `text` (`/claims/match`); unknown scope (`invalid scope: "<x>", valid values: [action, claim, question, setting]`). | Fix the request body; do not retry as-is. |
| `290004` | `claim not found`. Fires for unknown claim ids, **and** for `type:"question"` ids fed to `GET /claims/{id}/evidence` (the evidence endpoint is claim-only). | Treat as terminal for that id. |

Keep the response `trace_id` in any failure log — the LKM team uses it for diagnosis.

## Known temporary: premises with id-only, no content

Some premises currently come back with only their `id` populated and an empty `content` field, even within the parent chain. **This is a temporary state of the corpus** — the LKM is being progressively populated, and these premises will get content over time.

The id is preserved in the response either way; what the caller does with an empty-content premise is a caller decision.

## Known pit: premise ids may not round-trip standalone

Some `factors[].premises[].id` values exist only embedded in a parent claim's `evidence_chains`. Calling `GET /claims/{premise_id}/evidence` may return `claim not found` or `total_chains == 0` despite full content being recoverable from the parent chain's `factors[].premises[].content`. This is a property of the API — the embedded id is not always indexed as a standalone claim.

## CLI helper

Use `scripts/lkm.py` for deterministic API calls. The helper reads the access key from `LKM_ACCESS_KEY` and refuses to run if it is unset:

```bash
export LKM_ACCESS_KEY=<bohrium-access-key>   # set once per session

python skills/lkm-api/scripts/lkm.py search    --query "your query" --top-k 10 --out search.json
python skills/lkm-api/scripts/lkm.py search    --query "your query" --scopes claim,question --retrieval-mode semantic --out search.json
python skills/lkm-api/scripts/lkm.py search    --query "your query" --scopes claim --evidence-only --out search.json
python skills/lkm-api/scripts/lkm.py match     --text  "your query" --top-k 10 --out match.json
python skills/lkm-api/scripts/lkm.py evidence  --id    gcn_xxx --max-chains 10 --out evidence.json
python skills/lkm-api/scripts/lkm.py variables --ids   var1,var2 --out variables.json
```

Verbs: `search`, `match`, `evidence`, `variables`. The helper is Python stdlib only (no `pip install` step) — it uses `urllib.request` for HTTP and writes JSON to stdout, or to the file given by `--out`. See `references/api-contract.md` for field-level details.

`search`-specific flags:

- `--scopes` — comma-separated subset of `[action, claim, question, setting]`. Omit to let the server pick the default scope mix; valid scopes only — anything else is rejected with `code=290002`.
- `--retrieval-mode` — `lexical` | `semantic` | `hybrid`. Omit to keep the server default.
- `--evidence-only` — boolean flag; when set, the response is restricted to variables that already have at least one evidence chain (response items carry `has_evidence: true`). **Constraint** (enforced both client-side and server-side): `--evidence-only` may only be combined with `--scopes` *omitted entirely* or *set to exactly `claim`*. Any other scope combination is rejected by the server with `code=290002 invalid evidence_only constraint: evidence_only=true requires scopes=["claim"]`.
