# Step 4 — Supports, Priors, Obligations, And Duplicate Controls

Load this file only after Step 3 is complete. This step prevents unsupported
leaves, double counting, and untracked weak premises.

## Upstream Support

For obligation-driven expansion, the current obligation target claim receives
a support-channel LKM search. Search for upstream LKM-grounded conclusions
relevant to the target claim. A single target may have multiple upstream
supports; each can get its own directional `support(...)`:

```python
support([U_1], P, reason="<what U_1 says and why it supports P>", prior=<float>)
support([U_2], P, reason="<what U_2 says and why it supports P>", prior=<float>)
```

When several upstream claims only support the target jointly, use a joint
support:

```python
support([U_1, U_2], P, reason="<joint support rationale>", prior=<float>)
```

`support([a], b, prior=p)` means `a` supports `b`; high `p` means `a` nearly
determines `b`. This is true Gaia DSL syntax for the current `gaia.lang`
support strategy.

Minimum support-channel effort per current obligation target claim:

- run at least 2 distinct LKM match queries,
- use `top_k=10` for each query,
- preserve raw match/evidence payloads and append retrieval events to
  `retrieval_log.jsonl`,
- if no candidate satisfies the support standard, record `support_not_found`
  with query and rejection rationales.

Before accepting, dismissing, or marking a support candidate not found, append a
`candidate_considered` event for every candidate that enters scope comparison.
The event must carry `source_query_event_id`, `scope_tuple`, `scope_diff`,
`evidence_status`, and `preliminary_verdict`.

Warrant prior ranges:

- Strong, same topic and directly implies: 0.85–0.95.
- Moderate, related and partially overlaps: 0.70–0.85.
- Weak or lateral: 0.50–0.65.

The `support(...)` edge may be a scientific-review judgment rather than an LKM
factor, but both endpoint claims must already be LKM-grounded.

> Support reason discipline (no smuggling; on-the-fly premise claims are normal):
> see [`$gaia-package/references/emit-mapping.md`](../../gaia-package/references/emit-mapping.md) §4.

For cross-scope supports involving different geometry, material, temperature,
experimental extraction method, approximation, or mass definition, keep the
warrant weak and close to neutral (`0.50–0.58`) unless the LKM-grounded source
claim directly implies the target. Audit the scope differences and explain why
the relation is contextual rather than strong.

If no relevant upstream conclusion is found, do not invent one.

## Shared-Factor Extraction

Run shared-premise extraction before operator emission and again whenever two or
more supports converge on the same premise.

Rules:

1. Auto-merge identical normalized claim text.
2. Auto-merge same paper / different version when DOI, title, or author-year
   metadata show they are the same result.
3. When multiple upstream supports share a common method, model assumption,
   dataset, physical approximation, or other non-independent factor, extract
   that factor as a new claim and route supports through it.
4. Keep distinct supports that are genuinely independent.
5. Surface ambiguous cases to `merge_decisions.todo`; default is keep distinct.

Log every merge, equivalence, keep-distinct, and ambiguous verdict in
`merge_audit.md` and append the corresponding graph-growth event.

## Leaf Priors

After source emission, the caller quality gate runs `gaia check --hole .`.
Claims reported as leaves get entries in `priors.py`:

```python
PRIORS = {
    <label>: (<float>, "<heuristic tag + LKM context + TODO:review>"),
}
```

The float is a direct judgment of correctness, not LKM match score. Cap source
claim priors at 0.90. Do not lower a prior solely because the claim has
`total_chains=0`; judge content, provenance clarity, method/scope specificity,
and scientific plausibility.

Accepted `contradiction(...)` operators from Step 3 carry their own high warrant
prior in source, normally `0.95` as defined in `mapping-contract.md` §4. That
operator prior is not a leaf-claim prior and should not be mirrored into
`priors.py`.
Append a `prior_added` graph-growth event for each prior batch.

## Inquiry Obligations

`gaia inquiry obligation list` is the **canonical next-target queue** for
this workflow. The orchestrator pops one item from it per round to drive
Stage 2 (see `$orchestrator/references/lkm-explorer-sop.md` Stage 2
Obligation Rule). This step is the primary place that feeds the queue.

Mark unreliable reasoning chains or weak premises:

```bash
gaia inquiry obligation add <claim_or_strategy_qid> -c "<concern>"
```

Required occasions for `gaia inquiry obligation add` in this step:

- every reasoning chain whose `reason` body looks under-specified, ambiguous,
  or only partially traced to LKM steps;
- every weak premise (low evidence, scope mismatch, missing method/condition)
  that landed in `priors.py` with a low prior;
- every leaf claim flagged by `gaia check --hole .` that is not trivially
  fillable from existing payloads;
- every unreviewed warrant flagged by `gaia inquiry review --strict .`.

Pick the most interesting unresolved obligation as the next round target.
**Never** mechanically pick the lowest-belief claim, the most graph-central
claim, or any side of an existing contradiction; obligations carry
intentional exploration choices, while beliefs/centrality are diagnostics
only.

Every `gaia inquiry obligation add` call must be paired with an
`obligation_added` graph-growth event containing the CLI command, scope, text,
and `graph_delta`.

Register open-question hypotheses from Step 3 with:

```bash
gaia inquiry hypothesis add "<open question>" --scope <namespace>::<label>
```

If this step registers a hypothesis, pair it with a `hypothesis_added`
graph-growth event. Hypotheses are advisory; only obligations drive next-round
target selection.

## Duplicate Controls

For duplicate cleanup or refreshes, classify suspicious pairs:

- exact duplicate -> merge,
- same-paper helper restatement -> merge into canonical claim when safe,
- independent same proposition -> keep both and add `equivalence(...)`,
- different scope/material/method/condition -> keep distinct and log,
- ambiguous -> keep distinct and add to `merge_decisions.todo`.

Preserve merged-out labels' metadata in the canonical claim via `lkm_ids=[...]`
when possible.

## Step-Completion Gate

Before moving to Step 5:

- Relevant upstream supports have been searched and mapped or explicitly not
  found.
- The current obligation target claim has completed the required
  support-channel search (≥2 distinct LKM match queries, `top_k=10`) or
  recorded `support_not_found`.
- Every support candidate that entered scope comparison has a
  `candidate_considered` event before its final verdict.
- Shared-factor and duplicate risks have audit decisions.
- Leaf-prior candidates are ready for `priors.py`.
- Inquiry obligations/hypotheses are registered or queued. Every weak premise,
  unreliable reasoning chain, low-prior leaf, and unreviewed warrant
  identified in this step has a paired `gaia inquiry obligation add` call.
- Every inquiry CLI call in this step has a paired `hypothesis_added` or
  `obligation_added` event.
- Support, duplicate, merge, and prior decisions have corresponding
  graph-growth events, including `support_not_found` no-op decisions.
- Applicable events fill structured `scope_tuple`, `scope_diff`,
  `rejection_reason`, `warrant_prior`, and `graph_delta`.
- The end-of-round obligation list snapshot (size and top-3 ids by
  agent-judged interest) has been recorded so `round_close.decisions_summary`
  can carry `next_obligations` and `obligation_list_remaining` per the SOP
  Obligation Rule.
- Mark Step 4 complete, mark Step 5 in progress, then load
  `step-5-emit-and-handoff.md`.
