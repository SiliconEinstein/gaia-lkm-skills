---
name: lkm-search
description: Search the Bohrium LKM knowledge graph — find scientific claims and research questions (`POST /search`), trace how a conclusion was derived (`GET /claims/{id}/reasoning`), find papers with similar reasoning patterns (`POST /reasoning/search`), batch-fetch variable details with v2 metadata (`POST /variables/batch`), and retrieve a paper's full knowledge graph (`POST /papers/graph`). Use when the user wants to explore what LKM knows about a topic, trace the reasoning behind a claim, compare reasoning processes across papers, or inspect a paper's structured knowledge. Atomic — this skill covers the public LKM HTTP API surface; it does not prescribe retrieval methodology or downstream Gaia formalization.
---

# LKM Search

Query the Bohrium Large Knowledge Model (LKM) public HTTP API. Five endpoints that together cover the full external workflow: **discover → trace → enrich → compare**.

Preserve raw responses verbatim — every field (claim ids, source packages, factors, premises, `total_chains`, `data.papers`, `trace_id`) is potentially load-bearing for the caller's audit.

## When to use this skill

| You want to … | Endpoint |
|----------------|----------|
| Search for scientific claims or research questions by topic | `POST /search` |
| Trace how a specific conclusion was derived (premises, steps, weak points) | `GET /claims/{id}/reasoning` |
| Find papers that use a similar reasoning pattern | `POST /reasoning/search` |
| Batch-fetch full variable details (metadata, multi-source references) | `POST /variables/batch` |
| Inspect a single paper's complete knowledge graph | `POST /papers/graph` |
| Get paper full-text markdown | Use `$lkm-search-internal` instead |

## Base URL

```
https://open.bohrium.com/openapi/v1/lkm
```

All endpoint paths below are relative to this base.

## Authentication

Every request requires an `accessKey` HTTP header carrying the user's Bohrium access key. The CLI helper (`scripts/lkm_search.py`) reads from the `LKM_ACCESS_KEY` env var.

**Agent flow on first use:**

1. Check `printenv LKM_ACCESS_KEY`.
2. If unset, ask the user once for their Bohrium access key.
3. `export LKM_ACCESS_KEY=<key>` — do not echo or log the key.
4. Reuse for all subsequent requests; do not re-ask.

**Never** write the access key into any file in the repo, commit message, transcript, or uploaded artifact.

## Workflow

### Step 1 — Choose a search strategy

| User intent | Strategy | Endpoint |
|-------------|----------|----------|
| Explore a topic — find relevant claims | `search` with `retrieval_mode=hybrid` | `POST /search` |
| Only conclusions backed by reasoning chains | `search` with `reasoning_only=true` | `POST /search` |
| Precise terminology hit | `search` with `retrieval_mode=lexical` + `keywords` | `POST /search` |
| Already have a claim ID — trace its derivation | Skip search, go straight to reasoning | `GET /claims/{id}/reasoning` |
| Find papers with similar reasoning processes | Describe the reasoning pattern as query | `POST /reasoning/search` |
| Look up a paper's full structured content | Use paper ID, DOI, or title | `POST /papers/graph` |

### Step 2 — Execute

Use `scripts/lkm_search.py` (Python stdlib only, no `pip install`):

```bash
export LKM_ACCESS_KEY=<key>

# Discover claims
python skills/lkm-search/scripts/lkm_search.py search \
  --query "perovskite phase stability" --top-k 20 --out search.json

# Only reasoning-backed conclusions
python skills/lkm-search/scripts/lkm_search.py search \
  --query "..." --reasoning-only --out conclusions.json

# Lexical + keywords for precise terms
python skills/lkm-search/scripts/lkm_search.py search \
  --query "GFAP biomarker" --retrieval-mode lexical \
  --keywords "GFAP,astrocyte,neurodegeneration" --out search.json

# Trace reasoning
python skills/lkm-search/scripts/lkm_search.py reasoning \
  --id gcn_xxx --max-chains 10 --out reasoning.json

# Search by reasoning pattern
python skills/lkm-search/scripts/lkm_search.py reasoning-search \
  --query "Rietveld refinement from powder XRD to determine space group" \
  --out reasoning_search.json

# Batch variable details
python skills/lkm-search/scripts/lkm_search.py variables \
  --ids gcn_aaa,gcn_bbb --out variables.json

# Paper knowledge graph
python skills/lkm-search/scripts/lkm_search.py papers-graph \
  --doi 10.1038/s41586-023-06408-7 --out graph.json
```

### Step 3 — Read the results

Use `references/api-contract.md` for field-level request and response schemas.
At workflow level:

- Search returns variables; use claim ids with `has_reasoning=true` for
  reasoning lookup.
- Reasoning returns chains grouped by source paper; inspect premises,
  conclusion, derivation steps, and motivating questions together.
- `metadata` fields are JSON strings; parse them before reading weakness,
  narrative, keyword, or reference details.
- `data.papers` is the authoritative paper-id → bibliographic metadata map for
  source packages returned by search and reasoning endpoints.

### Step 4 — Drill deeper (optional)

From search results, pick claims with `has_reasoning=true` and call `reasoning` to see *how* the conclusion was derived and *where* the reasoning is weak.

From reasoning results, use `variables --ids` to fetch `local_members` (all paper-specific instantiations of a global variable) and full `metadata`.

From reasoning results, use `papers-graph --paper-id` to see the entire knowledge graph of the source paper.

## Key constraints

- **`score` is not confidence.** It is a retrieval ranking signal. Do not treat it as a truth probability or Gaia prior.
- **`question` ids cannot be passed to `reasoning`.** The reasoning endpoint accepts only `type=claim` ids; feeding a `type=question` id returns `290004`.
- **`reasoning_only` requires `scopes` to be omitted or `["claim"]`.** Combining it with other scopes returns `290002`.
- **`evidence_only` + `scopes` constraint.** `evidence_only=true` requires scopes omitted or exactly `["claim"]`.

## Error codes

| Code | Meaning | Action |
|------|---------|--------|
| `0` | Success | — |
| `290001` | Server-side query error (ByteHouse timeout etc.) | Retry once after 1–3 s |
| `290002` | Invalid request parameters | Check field names, enum values, constraints |
| `290004` | Claim not found | Verify the GCN ID exists and is type=claim |
| `290008` | Claim exists but has no reasoning chains | `total_chains == 0`; this claim is a premise or unchained |
| `290009` | Query timeout | Simplify query or reduce top_k |
| `290011` | Paper not found | Verify paper_id / DOI |
| `290012` | Title matched multiple candidates (ambiguous) | Pick from `candidates` list in response and retry with paper_id |
| `290013` | Paper exists but its knowledge graph is empty | Paper not yet ingested |

## Skill auto-update

Each `lkm_search.py` invocation forks a detached async subprocess that checks the upstream GitHub repo for a newer CalVer release tag. Best-effort, silent on failure, never blocks the API call. When a newer tag is detected, a one-shot notification is printed to stderr on the *next* invocation. Pull is agent-guided — this skill never auto-pulls.

## Field-level reference

See `references/api-contract.md` for complete request/response schemas of all five endpoints. For the latest online human-readable version, check Apifox:

https://s.apifox.cn/33d12311-ec59-4a5c-a849-391704fe7f84

The checked-in contract should be generated from the Apifox OpenAPI export:

```bash
python scripts/sync_apifox.py --out skills/lkm-search/references/api-contract.md
```

The sync script defaults to the five public `$lkm-search` paths and ignores unrelated Apifox project endpoints. If network/API access is unavailable, use the checked-in contract as the offline fallback. Workflow guidance, decision trees, known pitfalls, and CLI helper usage belong in this `SKILL.md`, not in the generated contract.
