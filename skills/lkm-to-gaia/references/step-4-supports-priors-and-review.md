# Step 4 — Supports, Priors, Obligations, And Duplicate Controls

Load this file only after Step 3 is complete. This step prevents unsupported
leaves, double counting, and untracked weak premises.

## Upstream Support

For premises or claims that need corroboration, search LKM for upstream
conclusions relevant to the target claim. A single target may have multiple
upstream supports; each gets its own directional `support(...)`:

```python
support([U_1], P, reason="<what U_1 says and why it supports P>", prior=<float>)
support([U_2], P, reason="<what U_2 says and why it supports P>", prior=<float>)
```

`support([a], b, prior=p)` means `a` supports `b`; high `p` means `a` nearly
determines `b`.

Warrant prior ranges:

- Strong, same topic and directly implies: 0.85–0.95.
- Moderate, related and partially overlaps: 0.70–0.85.
- Weak or lateral: 0.50–0.65.

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
`merge_audit.md`.

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

## Inquiry Obligations

Mark unreliable reasoning chains or weak premises:

```bash
gaia inquiry obligation add <claim_or_strategy_qid> -c "<concern>"
```

Use `gaia inquiry obligation list` as the exploration TODO list. Do not
mechanically pick the lowest-belief claim; obligations carry intentional
exploration choices, while beliefs are diagnostics.

Register open-question hypotheses from Step 3 with:

```bash
gaia inquiry hypothesis add "<open question>" --scope <namespace>::<label>
```

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
- Shared-factor and duplicate risks have audit decisions.
- Leaf-prior candidates are ready for `priors.py`.
- Inquiry obligations/hypotheses are registered or queued.
- Mark Step 4 complete, mark Step 5 in progress, then load
  `step-5-emit-and-handoff.md`.
