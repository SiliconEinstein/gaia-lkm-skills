# Step 4 — Supports, Priors, Obligations, And Duplicate Controls

Load this file only after Step 3 is complete. This step prevents unsupported
leaves, double counting, and untracked weak premises.

## Upstream Support

For root-claim frontier expansion, every frontier claim receives a
support-channel LKM search. Search for upstream LKM-grounded conclusions
relevant to the target claim. A single target may have multiple upstream
supports; each can get its own directional `derive(...)` (canonical v0.5
replacement for the legacy `support(...)` strategy — see
`docs/for-users/language-reference.md` "Notable migration rows"):

```python
derive(P, given=[U_1], rationale="<what U_1 says and why it supports P>",
       metadata={"warrant_prior": <float>})
derive(P, given=[U_2], rationale="<what U_2 says and why it supports P>",
       metadata={"warrant_prior": <float>})
```

When several upstream claims only support the target jointly, use a joint
derivation:

```python
derive(P, given=[U_1, U_2], rationale="<joint support rationale>",
       metadata={"warrant_prior": <float>})
```

`derive(P, given=[a], metadata={"warrant_prior": p})` means `a` supports
`P`; high `p` means `a` nearly determines `P`. The warrant strength lives
on the `metadata` kwarg in v0.5 rather than as a top-level `prior=` kwarg.

Minimum support-channel effort per frontier claim:

- run at least 2 distinct LKM match queries,
- use `top_k=10` for each query,
- if no candidate satisfies the support standard, surface `support_not_found`
  in the hand-off report with query and rejection rationales.

Warrant prior ranges:

- Strong, same topic and directly implies: 0.85–0.95.
- Moderate, related and partially overlaps: 0.70–0.85.
- Weak or lateral: 0.50–0.65.

The `derive(...)` warrant edge may be a scientific-review judgment rather
than an LKM factor, but both endpoint claims must already be LKM-grounded.

> Warrant rationale discipline (no smuggling; on-the-fly premise claims are
> normal): see upstream `SiliconEinstein/Gaia`
> `docs/for-users/language-reference.md` (`derive` semantics; the legacy
> `support` strategy semantics on the compat surface inform the same
> discipline).

For cross-scope supports involving different geometry, material, temperature,
experimental extraction method, approximation, or mass definition, keep the
warrant weak and close to neutral (`0.50–0.58`) unless the LKM-grounded source
claim directly implies the target. Reflect the scope difference in the
`rationale=` text.

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
5. For ambiguous cases, default to keep distinct.

## Leaf Priors

After source emission, the caller quality gate runs `gaia build check --hole .`.
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

Accepted `contradict(...)` operators from Step 3 carry their own high
`warrant_prior` metadata in source, normally `0.95` as defined in
`mapping-contract.md` §4. That operator warrant is not a leaf-claim prior
and should not be mirrored into `priors.py`.

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
- independent same proposition -> keep both and add `equal(...)`,
- different scope/material/method/condition -> keep distinct,
- ambiguous -> default to keep distinct.

Preserve merged-out labels' `lkm_id` provenance in the canonical claim via
`lkm_ids=[...]` when possible.

## Step-Completion Gate

Before moving to Step 5:

- Relevant upstream supports have been searched and mapped or explicitly not
  found.
- Root-claim frontier claims have completed the required support-channel
  search or surfaced `support_not_found` in the hand-off report.
- Shared-factor and duplicate decisions are resolved.
- Leaf-prior candidates are ready for `priors.py`.
- Inquiry obligations/hypotheses are registered.
- Mark Step 4 complete, mark Step 5 in progress, then load
  `step-5-emit-and-handoff.md`.
