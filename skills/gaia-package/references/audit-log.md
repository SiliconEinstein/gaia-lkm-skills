# Audit Log — `graph_growth_log.jsonl` v1 + `mapping_audit.md`

This document defines the audit trail every `<name>-gaia/` package carries:
the structured replay log (`graph_growth_log.jsonl`) and the human-readable
audit tables (`mapping_audit.md`). Both files live under
`artifacts/<audit-dir>/` (caller-named — see `package-shape.md`).

The goal is **frontend replayability**. A static UI should be able to read
the timeline log and replay the Gaia starmap from `t=0` without parsing
Python source. Therefore every fact that is observable during skill
execution but hard to reconstruct later is logged in structured form.

The replay layers are:

- **Decision layer**: candidate scope comparison, accept/dismiss/
  hypothesis-only / contradiction rationale.
- **Graph-construction layer**: per-event node/edge deltas, frontier
  changes, stage transitions.
- **(Optional) LKM call layer**: successful query/evidence results and raw
  payload pointers. Logged in the LKM-specific `retrieval_log.jsonl`,
  which is **not** owned by this contract — see the consumer skill for
  details.

Retry and failure events may still be logged for debugging, but frontend
replay is expected to ignore unsuccessful retrieval events.

## 1. File and format

```
artifacts/<audit-dir>/
  graph_growth_log.jsonl
  mapping_audit.md
  input/
```

`graph_growth_log.jsonl` is line-delimited JSON: one event per line,
append-only. **Do not rewrite older events** to fix interpretation; append
a later correction event with `supersedes_event_id` referencing the
original.

LKM-specific files (`retrieval_log.jsonl`, `merge_audit.md`,
`merge_decisions.todo`, `dismissed/`) are **out of scope for this
contract** — they live under the audit dir but are owned by `$lkm-explorer`.

## 2. Schema versioning

Every event includes:

```json
{"schema_version": "1"}
```

Rules:

- `schema_version` is a **string**, not a number.
- Additive optional fields may remain in the same schema version.
- Removing fields, changing meanings, or changing enum values requires a
  new schema version.
- Consumers should branch on `schema_version` before rendering.

This is **v1**. Any consumer that does not know v1 should ignore
unrecognized events rather than crash.

## 3. Event identity

Every event has the following identity fields:

```json
{
  "schema_version": "1",
  "event_id": "2026-05-05T14:00:00.123Z__lkm-explorer-18430__accepted_claim__7",
  "timestamp_utc": "2026-05-05T14:00:00.123Z",
  "stage": "mapping",
  "round_id": "round_0001",
  "actor": "lkm-explorer",
  "actor_id": "lkm-explorer-18430",
  "seq": 7,
  "decision": "accepted_claim"
}
```

Rules:

- **`timestamp_utc`** is an ISO-8601 UTC timestamp with millisecond
  precision: `YYYY-MM-DDTHH:mm:ss.SSSZ`.
- **`event_id`** format is
  `<timestamp_ms>__<actor_id>__<channel_or_decision>__<seq>`. The
  `<channel_or_decision>` token is the literal string from the
  `decision` field of the same event, with one allowed shortening: the
  `package_initialized` event may use the shorter token `init` for
  readability. No other shortenings.
- **`stage`** is one of `cold_start`, `frontier_expansion`, `mapping`,
  `duplicate_prior_maintenance`, `quality_gate`, or `repair`.
  Single-pass paper-extract emitters use `"mapping"` for every event.
- **`round_id`** is stable for a unit of graph growth. Cold start uses
  `round_0000`; later frontier rounds use `round_0001`, `round_0002`,
  etc. Single-pass paper-extract emitters use `"round_0000"` always.
- **`actor`** is the emitting skill name (e.g., `"orchestrator"`,
  `"lkm-explorer"`, `"formalize"`, or a delegated worker name).
- **`actor_id`** identifies the emitting actor and includes a worker name
  plus pid or uuid (e.g., `lkm-explorer-18430`,
  `worker-support-a-550e8400`).
- **`seq`** is a monotonically increasing integer per actor; reset within
  a run is not allowed.

### 3a. Optional `phase` field (paper-extract extension)

Paper-extract emitters may include a top-level `phase` field on every
event (e.g., `"phase": 4` to mark Phase 4 emit time). The field is an
**additive extension**: consumers built for LKM workflows ignore it. Use
it to capture *emit time*, not analytical-discovery time; if a consumer
needs the analytical phase, put it in the event's `notes` field.

## 4. Decision vocabulary

Allowed `decision` values:

- **Lifecycle / control flow:**
  - `package_initialized` — first event; payload includes the package
    name and upstream key.
  - `stage_transition` — workflow moves between major stages.
  - `round_open` / `round_close` — frontier round lifecycle.
  - `user_selection_checkpoint_opened` /
    `user_selection_checkpoint_closed` — human-in-the-loop pauses.
  - `selected_root` — root claim chosen for frontier expansion.
- **Graph growth:**
  - `accepted_claim` — every conclusion-claim and weak-point-claim
    emitted in source. Distinguish via `payload.claim_kind` for
    paper-extract.
  - `accepted_deduction` — every `deduction(...)` emitted (one event per
    call; see §5).
  - `accepted_support` — every `support([...], target, ...)` emitted.
  - `accepted_contradiction` — every `contradiction(A, B, ...)` emitted.
  - `equivalence` — every `equivalence(A, B, ...)` emitted (or recorded
    as merged with no operator — see emit-mapping.md §6).
  - `prior_added` — every `priors.py` entry. Payload: `label`, `prior`,
    `justification`.
  - `hypothesis_added` — paired with `gaia inquiry hypothesis add`.
  - `obligation_added` — paired with `gaia inquiry obligation add`. For
    paper-extract emitters, also used when the user opts in to
    materialize Phase 1 open-questions as `question(...)` nodes.
- **Candidate handling:**
  - `candidate_considered` — emitted before a final accept/dismiss
    decision in support / open-question / conflict handling.
  - `hypothesis_only` — interesting tension kept as audit-only.
  - `dismissed` — false alarm, duplicate, or unsupported lead.
  - `not_found` / `support_not_found` / `conflict_not_found` — channel
    completed without a candidate satisfying the standard.
  - `needs_more_evidence` — pause pending later retrieval.
  - `merge` / `keep_distinct` — duplicate-pair verdict.
- **Quality / repair:**
  - `quality_gate_result` — `gaia compile`, `gaia check --hole`, etc.
    pass/fail status.
  - `repair` — corrective pass that may carry `supersedes_event_id`.

A consumer that does not recognize a decision value should treat the
event as informational and continue replay.

### 4a. Subset semantics

Different emitters use different subsets of the decision vocabulary:

- **`$lkm-explorer`** uses the full vocabulary: lifecycle (cold start,
  frontier rounds, user-selection checkpoints), candidate handling
  (`candidate_considered`, `dismissed`, `hypothesis_only`, the `_not_found`
  family, `merge`/`keep_distinct`), graph growth, and quality gates.
- **`$formalize`** (paper-extract) uses a strict subset: typically only
  `package_initialized`, `accepted_claim` (with `claim_kind` distinguishing
  conclusion vs weak point), `accepted_deduction`, `prior_added`, and
  optionally `obligation_added` (for opt-in open-question emission). No
  candidate-handling events because the workflow is single-pass; no
  cold-start or frontier-round events because there is no expansion.

Both subsets comply with the **same v1 schema** — frontend replay tooling
that locates the log by glob (`**/graph_growth_log.jsonl`) reads both
without modification. The presence or absence of decision values is
emitter-dependent, not schema-dependent.

## 5. The `graph_delta` block

`graph_delta` is **mandatory on every event**. Use empty arrays for events
that do not change the executable graph. The frontend must be able to draw
the starmap delta from `graph_delta` without parsing Python.

Shape:

```json
"graph_delta": {
  "nodes_added": [
    {
      "id": "<label>",
      "kind": "claim",
      "label": "<short label or title>",
      "lkm_id": "<gcn_xxx>",                  // optional, lkm-driven only
      "source_paper": "<reference_key>",
      "prior": null,
      "content_excerpt": "<first 200 chars or so of the body>"
    }
  ],
  "edges_added": [
    {
      "from": "<premise_label>",
      "to": "<conclusion_label>",
      "kind": "deduction",
      "prior": 0.95,
      "reason_excerpt": "<truncated reason= prose>"      // for support edges; see §5a
    }
  ],
  "nodes_removed": [],
  "edges_removed": []
}
```

### Allowed node `kind` values

- `claim`
- `question` (motivation node, opt-in open-question nodes)
- `deduction`
- `support`
- `contradiction`
- `equivalence`

Paper-extract emitters normally only emit `claim` and `question` node
kinds in `nodes_added` (single-paper packages have no cross-paper
operators); LKM-driven emitters use the full set.

### Allowed edge `kind` values

Gaia relation/operator kinds: `deduction`, `support`, `contradiction`,
`equivalence`, `inquiry`. Paper-extract emitters for single-paper
packages typically only emit `deduction` edges; the others are reserved
for cross-paper relations.

### 5a. Single-event-per-deduction with multi-edge expansion

For `accepted_deduction`, emit **one event per `deduction(...)` call**,
even when the deduction has multiple premises. The event's
`payload.premises` is the full list and `payload.reason_excerpt` carries
the truncated `reason=` prose **once**, not per edge.
`graph_delta.edges_added` lists one slim edge per `(premise → conclusion)`
pair, carrying only `from`, `to`, `kind`, and `prior`. Do **not** repeat
`reason_excerpt` on each edge — it is per-deduction, not per-edge.

Example `accepted_deduction` event:

```json
{
  "schema_version": "1",
  "event_id": "...__accepted_deduction__6",
  "decision": "accepted_deduction",
  "warrant_prior": 0.95,
  "payload": {
    "premises": ["liu2015_c1_wp_static_screening", "liu2015_c1_wp_finite_size"],
    "conclusion": "liu2015_c1_fibonacci_emergence",
    "reason_excerpt": "1. The mean-field analysis ... 2. ..."
  },
  "gaia_actions": [
    {"action": "deduction", "symbol": null, "file": "src/liu2015_fibonacci_anyons/paper_liu2015.py"}
  ],
  "graph_delta": {
    "nodes_added": [],
    "edges_added": [
      {"from": "liu2015_c1_wp_static_screening", "to": "liu2015_c1_fibonacci_emergence", "kind": "deduction", "prior": 0.95},
      {"from": "liu2015_c1_wp_finite_size",      "to": "liu2015_c1_fibonacci_emergence", "kind": "deduction", "prior": 0.95}
    ],
    "nodes_removed": [],
    "edges_removed": []
  }
}
```

`gaia_actions[].symbol` is the Python identifier the call binds to; for
`deduction(...)` calls (which Gaia does not return as a named symbol)
use `null`. Consumers should treat `symbol: null` as "anonymous strategy"
rather than as missing data.

## 6. Append-only and corrections

The log is **append-only**: never rewrite an earlier line. Mistakes get a
later correction event with `supersedes_event_id` referencing the
original.

Example correction:

```json
{
  "schema_version": "1",
  "event_id": "...__repair__42",
  "decision": "repair",
  "supersedes_event_id": "...__accepted_claim__7",
  "payload": {"reason": "rebound conclusion to the correct deduction"},
  "graph_delta": {"nodes_added": [], "edges_added": [], "nodes_removed": [], "edges_removed": []}
}
```

A consumer replaying the log applies corrections in `seq` order; later
events override earlier ones when they share `supersedes_event_id`.

## 7. Logical-order vs wall-clock-order

For single-pass emitters that write all events in a final flush (typical
for `$formalize` Phase 4), `seq` and `event_id` reflect the **logical
emission order**, not the wall-clock order in which lines were appended:

- init →
- all conclusion claims in topological order →
- all weak-point claims grouped by conclusion →
- all priors →
- all deductions in topological order.

A frontend that replays by `seq` will see the package come into existence
in the order Phase 4 conceptually emitted it, regardless of when the file
was actually flushed to disk.

For multi-pass emitters (e.g., `$lkm-explorer`'s frontier-expansion
rounds), wall-clock order and logical order coincide because events are
appended as decisions are made.

## 8. Required event sequence (paper-extract example)

```json
{"schema_version":"1", "event_id":"...__formalize-<id>__init__1", "timestamp_utc":"...", "stage":"mapping", "round_id":"round_0000", "actor":"formalize", "actor_id":"...", "seq":1, "phase":4, "decision":"package_initialized", "payload":{"package":"<name>-gaia", "source_paper":"<reference_key>"}, "graph_delta":{"nodes_added":[],"edges_added":[],"nodes_removed":[],"edges_removed":[]}, "audit_files":["artifacts/paper-extract/mapping_audit.md"]}

{"schema_version":"1", "event_id":"...__accepted_claim__2", "timestamp_utc":"...", "stage":"mapping", "round_id":"round_0000", "actor":"formalize", "actor_id":"...", "seq":2, "phase":4, "decision":"accepted_claim", "payload":{"label":"<key>_problem", "node_kind":"question", "title":"motivation"}, "gaia_actions":[{"action":"question", "symbol":"<key>_problem", "file":"src/<import>/paper_<key>.py"}], "graph_delta":{"nodes_added":[{"id":"<key>_problem","kind":"question","label":"motivation","source_paper":"<key>","content_excerpt":"..."}],"edges_added":[],"nodes_removed":[],"edges_removed":[]}, "audit_files":["artifacts/paper-extract/mapping_audit.md"]}

{"schema_version":"1", "event_id":"...__accepted_claim__3", ..., "seq":3, "decision":"accepted_claim", "payload":{"label":"<key>_c1_<suffix>", "claim_kind":"conclusion", "conclusion_id":1, "review_prior":0.78, "title":"..."}, "gaia_actions":[{"action":"claim", "symbol":"<key>_c1_<suffix>", "file":"src/<import>/paper_<key>.py"}], "graph_delta":{"nodes_added":[{"id":"<key>_c1_<suffix>","kind":"claim","label":"...","source_paper":"<key>","content_excerpt":"..."}],"edges_added":[],"nodes_removed":[],"edges_removed":[]}, "audit_files":["artifacts/paper-extract/mapping_audit.md"]}

{"schema_version":"1", "event_id":"...__accepted_claim__4", ..., "seq":4, "decision":"accepted_claim", "payload":{"label":"<key>_c1_wp_<suffix>", "claim_kind":"weak_point", "conclusion_id":1, "weak_types":["model"], "p1":0.7, "p2":0.85, "title":"..."}, "gaia_actions":[{"action":"claim", "symbol":"<key>_c1_wp_<suffix>", "file":"src/<import>/paper_<key>.py"}], "graph_delta":{"nodes_added":[{"id":"<key>_c1_wp_<suffix>","kind":"claim","label":"...","source_paper":"<key>","content_excerpt":"..."}],"edges_added":[],"nodes_removed":[],"edges_removed":[]}, "audit_files":["artifacts/paper-extract/mapping_audit.md"]}

{"schema_version":"1", "event_id":"...__prior_added__5", ..., "seq":5, "decision":"prior_added", "payload":{"label":"<key>_c1_wp_<suffix>", "prior":0.65, "justification":"... TODO:review"}, "gaia_actions":[{"action":"prior", "symbol":"<key>_c1_wp_<suffix>", "file":"src/<import>/priors.py"}], "graph_delta":{"nodes_added":[],"edges_added":[],"nodes_removed":[],"edges_removed":[]}, "audit_files":["artifacts/paper-extract/mapping_audit.md"]}

{"schema_version":"1", "event_id":"...__accepted_deduction__6", ..., "seq":6, "decision":"accepted_deduction", "warrant_prior":0.95, "payload":{"premises":["<key>_c1_wp_<suffix>","..."], "conclusion":"<key>_c1_<suffix>", "reason_excerpt":"first ~200 chars..."}, "gaia_actions":[{"action":"deduction", "symbol":null, "file":"src/<import>/paper_<key>.py"}], "graph_delta":{"nodes_added":[],"edges_added":[{"from":"<key>_c1_wp_<suffix>","to":"<key>_c1_<suffix>","kind":"deduction","prior":0.95}],"nodes_removed":[],"edges_removed":[]}, "audit_files":["artifacts/paper-extract/mapping_audit.md"]}
```

## 9. Round lifecycle (multi-pass emitters)

Multi-pass emitters (e.g., `$lkm-explorer`) emit explicit round lifecycle
events. Single-pass paper-extract emitters skip these.

`round_open` payload:

```json
{
  "decision": "round_open",
  "payload": {
    "round_id": "round_0001",
    "frontier_in": [{"label": "gcn_root", "lkm_id": "gcn_root"}],
    "frontier_visited_so_far": [{"label": "gcn_old", "lkm_id": "gcn_old"}]
  },
  "graph_delta": {"nodes_added": [], "edges_added": [], "nodes_removed": [], "edges_removed": []}
}
```

`round_close` payload:

```json
{
  "decision": "round_close",
  "payload": {
    "round_id": "round_0001",
    "decisions_summary": {
      "accepted_claim": 2,
      "accepted_support": 1,
      "hypothesis_only": 1,
      "dismissed": 3
    },
    "next_frontier": [{"label": "gcn_new", "lkm_id": "gcn_new"}],
    "exhausted": false
  },
  "graph_delta": {"nodes_added": [], "edges_added": [], "nodes_removed": [], "edges_removed": []}
}
```

`stage_transition` payload:

```json
{
  "decision": "stage_transition",
  "payload": {"from": "cold_start", "to": "mapping"},
  "graph_delta": {"nodes_added": [], "edges_added": [], "nodes_removed": [], "edges_removed": []}
}
```

Cold start also emits `package_initialized`,
`user_selection_checkpoint_opened`, and `user_selection_checkpoint_closed`
events so the replay UI can show the package creation and any
human-root-selection pause.

## 10. Candidate-considered events (multi-pass emitters)

Before a final candidate decision in support or open-question/conflict
handling, emit one `candidate_considered` event for each candidate that
enters scope comparison:

```json
{
  "decision": "candidate_considered",
  "frontier_claim": {"label": "gcn_target", "lkm_id": "gcn_target"},
  "payload": {
    "frontier_claim": {"label": "gcn_target", "lkm_id": "gcn_target"},
    "candidate_lkm_id": "gcn_candidate",
    "source_query_event_id": "...__support__12",
    "scope_tuple": {
      "system_material": "2D HEG",
      "quantity_effect": "effective mass",
      "asserted_value_sign_direction": "m*/m above unity",
      "method_model_measurement": "QMC extrapolation",
      "role": "computation",
      "conditions_regime": "low density",
      "source": "paper:123 / gcn_candidate"
    },
    "scope_diff": {
      "system_material": "same",
      "method_model_measurement": "different finite-size correction"
    },
    "evidence_status": "chain-backed",
    "preliminary_verdict": "plausible_support"
  },
  "graph_delta": {"nodes_added": [], "edges_added": [], "nodes_removed": [], "edges_removed": []}
}
```

`preliminary_verdict` values are short stable tokens: `plausible_support`,
`plausible_conflict`, `likely_duplicate`, `scope_mismatch`,
`needs_evidence`, `dismiss_likely`.

## 11. Structured rationale fields

Graph-growth events may include these top-level fields whenever
applicable:

- `scope_tuple` — system_material, quantity_effect,
  asserted_value_sign_direction, method_model_measurement, role,
  conditions_regime, source.
- `scope_diff` — pairwise scope-comparison summary.
- `open_problem` — discriminating question for contradiction handling.
- `rejection_reason` — short rationale for `dismissed` / `_not_found`.
- `warrant_prior` — the `prior=` value emitted on the corresponding
  `deduction` / `support` / `contradiction` operator.

Use these fields for frontend rendering. Keep longer prose in markdown
audit files, but do not make the frontend parse markdown to recover the
reason for a candidate verdict.

## 12. Inquiry events

Every `gaia inquiry hypothesis add` call emits a paired `hypothesis_added`
event; every `gaia inquiry obligation add` call emits a paired
`obligation_added` event:

```json
{
  "decision": "hypothesis_added",
  "payload": {
    "inquiry_kind": "hypothesis",
    "text": "What finite-size extrapolation discriminates the two claims?",
    "scope": "package::operator_or_claim_label",
    "cli_command": "gaia inquiry hypothesis add \"...\" --scope package::label"
  },
  "graph_delta": {
    "nodes_added": [
      {"id": "inquiry:hypothesis:package::label:001", "kind": "claim", "label": "Open problem: ...", "content_excerpt": "..."}
    ],
    "edges_added": [
      {"from": "inquiry:hypothesis:package::label:001", "to": "label", "kind": "inquiry"}
    ],
    "nodes_removed": [],
    "edges_removed": []
  }
}
```

## 13. Quality-gate logging

After package source changes, append a `quality_gate_result` event with
the commands run and pass/fail status:

```json
{
  "decision": "quality_gate_result",
  "quality_gate": {
    "status": "failed",
    "commands": [
      {"command": "gaia compile .", "status": "passed"},
      {"command": "gaia check --hole .", "status": "failed", "summary": "2 missing priors"}
    ]
  },
  "graph_delta": {"nodes_added": [], "edges_added": [], "nodes_removed": [], "edges_removed": []}
}
```

If a failure causes a repair pass, the repair pass gets its own later
event with `decision="repair"` and `supersedes_event_id` when it corrects
an earlier event.

## 14. `audit_files` and `notes` fields

- **`audit_files`**: an array of paths pointing to the human-readable
  audit rows that explain the structured event in prose. Always include
  `mapping_audit.md` so the audit row remains reachable from any
  structured event.
- **`notes`**: an optional short rationale (≤ 200 chars) on any event.
  Typical uses:
  - On `accepted_claim`: which logic-graph edge first surfaced this
    conclusion (`"Phase 1 c2 → c4 edge"`), or the analytical phase that
    discovered a weak point (`"Phase 3 weak-point gating; pattern: formal"`).
  - On `accepted_deduction`: per-highlight / per-gap prior adjustments
    behind the warrant (`"baseline 0.95; +0.04 H2; -0.05 flagged-gap; net 0.94"`).
  - On `prior_added`: the calibration band the prior was placed in
    (`"heuristic-extrapolative band 0.40–0.60"`).
  Anything longer belongs in `mapping_audit.md`.

## 15. Frontier replay

The log must be sufficient to answer:

1. Which package was initialized and when?
2. Which stages were entered and left? (multi-pass)
3. Which root-selection checkpoint opened and which root closed it? (multi-pass)
4. Which root was selected and when? (multi-pass)
5. For each round, which frontier entered and which frontier left? (multi-pass)
6. For each frontier claim, which support-channel queries were run? (LKM)
7. For each frontier claim, which open-question/conflict queries were run? (LKM)
8. Which raw payload files came from each query or evidence call? (LKM, via `retrieval_log.jsonl`)
9. Which candidates were considered, admitted, dismissed, or left as search leads?
10. Which Gaia nodes and edges were added or removed by each decision?
11. Which inquiry hypotheses/obligations were added?
12. Which quality gates ran after each growth round and what happened?

Single-pass paper-extract emitters answer (1), (9, scoped to
accept-only), (10), (11, when the opt-in is active), and (12) only.

## 16. `mapping_audit.md` table conventions

`mapping_audit.md` is a flat human-readable decision log paired with
`graph_growth_log.jsonl`. The JSONL is the structured replay index; the
markdown carries detailed scientific rationale that doesn't fit in
structured fields.

Standard sections (use the ones that apply to your emitter):

```markdown
# Mapping audit log — <package name>

[For paper-extract emitters: source paper line]
Source paper: <reference_key> ("<paper title>")

## Phase summary                              [paper-extract only]

| phase | counts |
|---|---|
| Phase 1 conclusions | <n> |
| Phase 1 logic-graph edges | <n> |
| Phase 2 reasoning steps (total) | <n> |
| Phase 3 weak points | <n> |
| Phase 3 highlights | <n> |
| Phase 1 motivation block | yes / no |
| Phase 1 open-question block | yes / no |

## Conclusions                                [paper-extract only]

| label | conclusion_id | title | upstreams | weak_points | deduction_prior | review_prior | notes |
|---|---|---|---|---|---|---|---|
| <key>_c1_<suffix> | 1 | ... | (none) | wp_static_screening | 0.95 | 0.78 | ... |

## Weak points                                [paper-extract only]

| label | conclusion_id | also_threatens | weak_types | prior | p1 | p2 | weakness_reason | failure_mode |
|---|---|---|---|---|---|---|---|---|
| <key>_c1_wp_<suffix> | 1 | (none) | model | 0.65 | 0.7 | 0.85 | ... | ... |

## Highlights                                 [paper-extract only]

| highlight_id | conclusion_id | strength_types | credit | notes |
|---|---|---|---|---|
| H1 | 1 | computational, statistical | ... | influenced deduction prior (0.95 → 0.97) |

## Factors → deductions                       [LKM-driven only]

| factor_id | source_paper | premises | conclusion | dsl_kind |
|---|---|---|---|---|
| gfac_9d88a6f8 | paper:814... | gcn_2386d1b6, gcn_9f7a3e33 | gcn_66ac13c8 | deduction |

## Equivalences

| pair | a | b | decision | dsl_action |
|---|---|---|---|---|
| gcn_73c88cf / gcn_66ac13c8 | gcn_73c88cf | gcn_66ac13c8 | same paper (arXiv→PRB) | merged; no equivalence() |

## Contradictions

| pair | open_problem | decision | relation_type | dsl_action |
|---|---|---|---|---|
| (none in this run) | | | | |

## Dismissed                                  [LKM-driven only]

| pair | origin | rationale |
|---|---|---|
| (none in this run) | | |

## Motivation (paper-level)                   [paper-extract only]

<Phase 1 motivation text, copied verbatim>

## Open questions (paper-level)               [paper-extract only]

<Phase 1 open-question text, copied verbatim>

## Metadata gaps and rationale

- <e.g. "DOI not present in input — left absent in references.json">
- <e.g. "Phase 1 detected only 1 atomic conclusion; secondary claim filtered as non-novel">
```

### Section subset notes

- **`Conclusions`**, **`Weak points`**, **`Highlights`**, **`Phase summary`**,
  **`Motivation (paper-level)`**, **`Open questions (paper-level)`** are
  **paper-extract only**.
- **`Factors → deductions`** and **`Dismissed`** are **LKM-driven only**.
- **`Equivalences`**, **`Contradictions`**, and **`Metadata gaps and
  rationale`** apply to both.

The audit log is the reviewer's first stop after `gaia infer .` returns
surprising beliefs.

## 17. Mandatory rules summary

- `graph_delta` is required on every event (empty arrays are valid).
- One `accepted_deduction` event per `deduction(...)` call, with edges
  expanded one per premise → conclusion pair (§5a).
- `gaia_actions[].symbol` is `null` for `deduction(...)` (anonymous
  strategy); not missing data.
- `audit_files` must point to `mapping_audit.md`.
- Append-only; corrections via later events with `supersedes_event_id`.
- Logical-order `seq` for single-pass emitters (§7); wall-clock-order
  coincides with logical order for multi-pass emitters.

The detailed scientific rationale (full `weakness_reason`, `failure_mode`,
`credit`, narrative prose) lives in `mapping_audit.md`. The JSONL is the
ordered structured index that lets a frontend replay the workflow without
parsing markdown.
