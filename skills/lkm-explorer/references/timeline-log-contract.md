# LKM-Explorer Timeline Log Contract

This contract covers the LKM-specific timeline logs emitted by `$lkm-explorer`.

> **Canonical `graph_growth_log.jsonl` schema lives in
> [`$gaia-package/references/audit-log.md`](../../gaia-package/references/audit-log.md).**
> This file documents only the LKM-specific `retrieval_log.jsonl` schema and
> the LKM-only event subset of `graph_growth_log.jsonl`. `$lkm-explorer` emits
> the full canonical `graph_growth_log.jsonl` per `$gaia-package`, plus this
> sibling `retrieval_log.jsonl` that ties graph events back to the LKM API
> calls that grounded them.

The goal is frontend replayability. A static web UI should be able to read
both logs and replay the Gaia starmap from `t=0` without calling LKM again or
parsing Python source. Therefore every LKM call observable during skill
execution but hard to reconstruct later must be logged in `retrieval_log.jsonl`
and linked from the corresponding graph-growth event.

## Required files

Every LKM-explorer package stores two append-only chronological logs under
`artifacts/lkm-discovery/`:

```text
artifacts/lkm-discovery/
├── input/
├── retrieval_log.jsonl     # LKM-specific (this file)
└── graph_growth_log.jsonl  # canonical v1 schema in $gaia-package/references/audit-log.md
```

`retrieval_log.jsonl` records LKM API calls and their raw payload files.
`graph_growth_log.jsonl` records source/audit graph-growth decisions that use
those payloads; each growth event references the retrieval events that
grounded it via `retrieval_event_ids`.

Both files are line-delimited JSON. Each line is one event. Do not rewrite older
events to fix interpretation; append a later correction event with
`supersedes_event_id` when needed. Schema-versioning, event-identity rules
(`schema_version`, `event_id`, `timestamp_utc`, `stage`, `round_id`, `actor`,
`actor_id`, `seq`), `graph_delta` requirements, decision vocabulary, round
lifecycle, and structured rationale fields all follow the canonical schema in
[`$gaia-package/references/audit-log.md`](../../gaia-package/references/audit-log.md).

## Retrieval events (LKM-specific)

Append one retrieval event for every `$lkm-api` call made for an
LKM-explorer package: `match`, `evidence`, or `variables`.

Minimum schema:

```json
{
  "schema_version": "1",
  "event_id": "2026-05-05T14:00:00.123Z__orchestrator-18422__support__12",
  "timestamp_utc": "2026-05-05T14:00:00.123Z",
  "stage": "frontier_expansion",
  "round_id": "round_0001",
  "actor": "orchestrator",
  "actor_id": "orchestrator-18422",
  "seq": 12,
  "frontier_claim": {
    "label": "gcn_example",
    "lkm_id": "gcn_example"
  },
  "obligation_id": "obl-2026-05-05-0007",
  "channel": "support",
  "endpoint": "match",
  "request": {
    "text": "2D HEG effective mass finite-size extrapolation",
    "top_k": 10,
    "filters": {"visibility": "public"}
  },
  "raw_output": "input/round_0001_001_match_support_effective_mass.json",
  "trace_id": "trace-from-response",
  "response_code": 0,
  "result_summary": {
    "candidate_count": 10,
    "candidate_ids": ["gcn_x", "gcn_y"],
    "evidence_ids": []
  },
  "scope_tuple": null,
  "scope_diff": null,
  "open_problem": null,
  "rejection_reason": null,
  "warrant_prior": null,
  "retry_of_event_id": null,
  "notes": "optional short rationale"
}
```

Field rules:

- `frontier_claim` is the **current obligation target claim** for the round
  (the claim whose qid the orchestrator pinned this round when it popped an
  obligation from `gaia inquiry obligation list`). It is `null` during
  broad cold-start search before a root exists. In `round_0000` it carries
  the user-selected cold-start root; from `round_0001` onward it carries
  the obligation target.
- `obligation_id` is the id of the obligation popped to drive the round (when
  applicable). It is `null` in `round_0000` (cold start has no obligation
  pop) and during pre-package discovery. Together with `frontier_claim` it
  lets a replay UI show "this round was driven by obligation X targeting
  claim Y".
- `channel` is one of `root_discovery`, `support`,
  `open_question_conflict`, `evidence_hydration`, `variables_hydration`,
  `duplicate_review`, `quality_repair`, or `other`.
- `endpoint` is one of `match`, `evidence`, or `variables`.
- `raw_output` points to a verbatim JSON file under
  `artifacts/lkm-discovery/input/`.
- `result_summary` must include enough successful-return facts for the frontend
  to show what the query hit without reparsing the raw JSON.
- Record transient failures too when useful. If a `code=290001` response is
  retried, log the failed event and the retry event; the retry's
  `retry_of_event_id` points to the failed event. Frontend replay can ignore
  events whose `response_code` is not `0`.
- Never include access keys, shell environment, or other secrets in a log
  event.

If discovery occurs before the package directory exists, raw payloads may be
staged temporarily, but before the user-selection checkpoint the agent must
copy them into `artifacts/lkm-discovery/input/` and backfill retrieval events
that preserve the actual call order as accurately as available.

## LKM-specific graph-growth event subset

`$lkm-explorer` emits the full canonical `graph_growth_log.jsonl` schema; the
LKM-specific decisions/no-ops that this skill is responsible for emitting are:

- `support_not_found` — no candidate satisfied the support standard for the
  current target claim after the support-channel queries were run.
- `conflict_not_found` — no candidate satisfied the hypothesis or contradiction
  standard for the current target claim after the open-question/conflict-channel
  queries were run.
- LKM-specific `accepted_*` decisions tied back to retrieval events:
  `retrieval_event_ids` MUST point at the LKM `retrieval_log.jsonl` events
  whose raw payloads grounded the decision.
- Round-lifecycle events (`round_open`, `round_close`, `stage_transition`)
  during cold-start root discovery and post-cold-start obligation-driven
  expansion rounds — generic event format in `$gaia-package`, but the
  LKM-explorer workflow guarantees one round per cold-start selection plus
  one per obligation pop. Specifically:
  - `round_open.frontier_in` carries the obligation target's claim qid; in
    `round_0001+` `round_open.payload.obligation_id` carries the popped
    obligation's id.
  - `round_close.decisions_summary.next_obligations` lists the ids of
    obligations newly added during this round (typically by Step 3
    accepted contradictions and Step 4 weak-premise flags), and
    `decisions_summary.obligation_list_remaining` carries the post-round
    queue size.
  - `round_close.exhausted=true` MUST hold if and only if
    `obligation_list_empty=true ∧ open_holes=0 ∧ unreviewed_warrants=0`
    after this round.
- `package_initialized`, `user_selection_checkpoint_opened`, and
  `user_selection_checkpoint_closed` during cold start so the replay UI can
  show the package creation and human root-selection pause.
- `quality_gate_result` events MUST carry `payload.gate_flavor`, one of
  `intermediate` or `final`. `gate_flavor="final"` MUST appear exactly once
  per package run (Step 5 caller gate) and is the only gate where
  `gaia infer .` ran; intermediate gates report `infer_pass=null`.

All other generic decision values (`accepted_claim`, `accepted_deduction`,
`accepted_support`, `accepted_contradiction`, `equivalence`, `hypothesis_only`,
`dismissed`, `merge`, `keep_distinct`, `prior_added`, `hypothesis_added`,
`obligation_added`, `quality_gate_result`, `repair`) follow the canonical
schema unchanged.

## Replay questions

The two logs together must be sufficient to answer:

1. Which package was initialized and when?
2. Which stages were entered and left?
3. Which root-selection checkpoint opened and which root closed it?
4. Which root was selected and when?
5. For each round, which obligation was popped and which target claim it
   pinned, and what were the round's `next_obligations` /
   `obligation_list_remaining` at close?
6. For the round's current target claim, which support-channel queries were
   run?
7. For the round's current target claim, which open-question/conflict
   queries were run?
8. Which raw payload files came from each query or evidence call?
9. Which candidates were considered, admitted, dismissed, or left as search
   leads?
10. Which Gaia nodes and edges were added or removed by each decision?
11. Which inquiry hypotheses/obligations were added (and which accepted
    `contradiction(...)` ops fed which `obligation_added` event)?
12. Which intermediate quality gates ran after each growth round and what
    happened, and which single `final` quality gate ran `gaia infer .` at
    hand-off?

Human-readable audit files (`mapping_audit.md`, `contradictions.md`,
`equivalences.md`, `merge_audit.md`, and `merge_decisions.todo`) remain the
place for detailed scientific rationale. The two JSONL logs are the ordered
structured index that lets a frontend replay the workflow.
