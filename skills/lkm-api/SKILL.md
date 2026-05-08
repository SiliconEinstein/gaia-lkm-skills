---
name: lkm-api
description: Query the Bohrium Large Knowledge Model (LKM) HTTP API. Covers the three endpoints (`POST /claims/match`, `GET /claims/{id}/evidence`, `POST /variables/batch`), the `accessKey` auth contract, request/response shapes, the `data.papers` paper-metadata block, and known API quirks (`code=290001` transient, `code=290002` validation, id-only-with-empty-content premises, premise ids that may not round-trip standalone). Atomic: this skill is the API surface only — it does not prescribe retrieval methodology, root-selection policy, or downstream handoffs.
---

# LKM API

## Purpose

Talk to the Bohrium LKM HTTP API. This skill describes the endpoints, auth, request and response shapes, and the API's known quirks. It does not decide how the responses should be filtered, ranked, gated, or routed downstream — those are caller concerns.

Preserve raw responses verbatim — every field (claim ids, source packages, factors, premises, `total_chains`, `data.papers`, `trace_id`) is potentially load-bearing for the caller's audit.

## Default endpoint (production)

Use **`https://open.bohrium.com/openapi/v1/lkm`** as the base URL. Do not point the skill at any non-production deployment.

Three endpoints (all on this base):

- match: `POST /claims/match`
- evidence: `GET /claims/{id}/evidence`
- variables: `POST /variables/batch`

Every request requires an `accessKey: <AK>` header (Bohrium access key). See **Authentication** below.

Read `references/api-contract.md` for request/response field-level expectations.

The `match` endpoint is currently understood as BM25-like free-text retrieval.
Callers should send concise domain keywords or anchor phrases in `text`; this
skill does not prescribe query-count, root-selection, or downstream mapping
policy.

## Authentication (access key)

Every endpoint requires an `accessKey` HTTP header carrying the user's Bohrium access key. The CLI helper (`scripts/lkm.mjs`) reads the key from the env var `LKM_ACCESS_KEY` and exits with a clear error if it is unset. Direct `curl` calls must include the same header.

**Agent flow on first use of this skill in a session:**

1. Check whether `LKM_ACCESS_KEY` is set in the shell (e.g. `printenv LKM_ACCESS_KEY`).
2. If unset, **ask the user once** for their Bohrium access key. Phrase the ask explicitly so the user knows what is being requested and why.
3. Once the user provides it, persist it for reuse:
   - **Current session:** `export LKM_ACCESS_KEY=<key>` so subsequent `lkm.mjs` calls in this session pick it up. Do **not** echo or log the key after exporting.
   - **Future sessions:** if the agent has a persistent memory facility, save the access key there so future invocations of this skill can read it back without re-asking. If no such facility exists, instruct the user to add the export line to their shell rc themselves — do not edit the user's shell rc without explicit permission.
4. Reuse the same key for every subsequent request in the run; do not re-ask.

**Never** write the access key into any file inside the repo (skills/, scripts/, references/, working folders, JSON artifacts), into a commit message, into a saved transcript, or into any cloud-uploaded artifact. The key is a per-user secret.

If a request returns an authentication error, surface it to the user and ask whether the key is current; do not silently retry with a different key.

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

## Known transient: `code=290001`

Sometimes the first call after a quiet period returns:

```json
{ "code": 290001, "error": { "msg": "hydrate provenance failed: batch get global variables failed: ... context deadline exceeded" } }
```

This is a transient downstream timeout in the variable-hydration sub-call. **Retry once after a short delay (1–3 s).** If it persists across multiple retries, it is a server-side issue.

## Known validation error: `code=290002`

`POST /claims/match` rejects the request body if the required field `text` is missing. The historical field name `query` is rejected with `code=290002` (`Field validation for 'Text' failed on the 'required' tag`). Always send `text`.

## Known temporary: premises with id-only, no content

Some premises currently come back with only their `id` populated and an empty `content` field, even within the parent chain. **This is a temporary state of the corpus** — the LKM is being progressively populated, and these premises will get content over time.

The id is preserved in the response either way; what the caller does with an empty-content premise is a caller decision.

## Known pit: premise ids may not round-trip standalone

Some `factors[].premises[].id` values exist only embedded in a parent claim's `evidence_chains`. Calling `GET /claims/{premise_id}/evidence` may return `claim not found` or `total_chains == 0` despite full content being recoverable from the parent chain's `factors[].premises[].content`. This is a property of the API — the embedded id is not always indexed as a standalone claim.

## CLI helper

Use `scripts/lkm.mjs` for deterministic API calls. The helper reads the access key from `LKM_ACCESS_KEY` and refuses to run if it is unset:

```bash
export LKM_ACCESS_KEY=<bohrium-access-key>   # set once per session

node skills/lkm-api/scripts/lkm.mjs match     --text "your query" --top-k 10 --out match.json
node skills/lkm-api/scripts/lkm.mjs evidence  --id gcn_xxx --max-chains 10 --out evidence.json
node skills/lkm-api/scripts/lkm.mjs variables --ids var1,var2 --out variables.json
```

Verbs: `match`, `evidence`, `variables`. The helper uses Node built-in `fetch` and writes JSON to stdout, or to the file given by `--out`. See `references/api-contract.md` for field-level details.
