# LKM-Explorer-Specific Contract

> Generic Gaia knowledge package emission rules — claim/deduction body
> discipline, package layout, audit log schema — are owned by
> [`$gaia-package`](../../gaia-package/). This file covers ONLY rules specific
> to contradiction-driven LKM exploration: the LKM evidence-status vocabulary,
> no-chain source-claim handling, root-claim frontier supports, the
> open-question-first contradiction policy, and the timeline emission
> requirement for LKM-driven package work.

## 0. Evidence-status vocabulary

- **Chain-backed claim**: LKM returned claim content and `GET /claims/{id}/evidence` has `total_chains > 0`. Emit `claim(...)` plus factor-derived `deduction(...)` when factors are present.
- **LKM source claim**: LKM returned claim content and provenance, but `total_chains = 0`. After cold start, emit it as a leaf/source `claim(...)`; do not invent premises or deductions.
- **Search lead**: insufficient content or provenance for a self-contained claim outside an accepted chain-backed factor. Keep only in audit/search notes.

`total_chains > 0` is required for cold-start root selection. It is not a global admissibility rule for post-cold-start frontier expansion or conflict-channel candidates.

## 1. LKM-specific claim handling

Generic `claim(...)` body rules — label discipline, self-contained check, no
`prior` kwarg, metadata kwarg taxonomy — are in
[`$gaia-package/references/emit-mapping.md`](../../gaia-package/references/emit-mapping.md).
The rules below are LKM-specific.

- **No-chain LKM source claims.** If `total_chains = 0`, use
  `provenance_source="lkm_no_chain"`, preserve `lkm_id`, `lkm_original`, and
  `source_paper` when available, and log the no-chain status in the audit
  trail. Do not create `deduction(...)` without factors.
- **Prior policy for no-chain candidates.** Do not lower a prior solely because
  `total_chains=0`. Set priors from claim content, provenance clarity,
  method/scope specificity, and scientific judgment.
- **Chain-internal empty-content premises.** When an LKM evidence chain
  references a premise whose `content` is empty, a placeholder string plus
  `todo="revisit when LKM corpus populates this premise"` in metadata may be
  used to preserve a factor-derived `deduction(...)`. Log
  `content_missing=true` in `mapping_audit.md`. Do not invent content.
- **Empty or under-provenanced match/search results outside an accepted
  chain** are **search leads**, not placeholder claims. Record them in audit
  files only.

## 3. Root-claim frontier supports

During root-claim frontier expansion, the agent searches LKM for content that
can directly support each frontier claim. A single target claim may have
**multiple** accepted upstream supports. Use the real Gaia DSL strategy:

```python
support([U_1], target, reason="<what U_1 says and why it supports target>", prior=<float>)
support([U_2], target, reason="<what U_2 says and why it supports target>", prior=<float>)
```

When several upstream claims only support the target jointly, use one joint
support:

```python
support([U_1, U_2], target, reason="<joint support rationale>", prior=<float>)
```

`support([a], b, prior=p)` is directional: `a` supports `b`. In Gaia, support is
soft deduction over a directed implication. Higher `p` means the support warrant
is stronger; `p` close to 1 means `a` nearly determines `b`.

Search effort for each frontier target:
- Run at least 2 distinct support-channel LKM match queries.
- Use `top_k=10` for each query.
- Preserve raw match/evidence payloads.
- If no candidate satisfies the support standard, record the queries and
  rejection rationales as `support_not_found`; do not invent support.

Warrant prior for each support:
- Strong (same topic, directly implies) -> 0.85-0.95
- Moderate (related, partially overlaps) -> 0.70-0.85
- Weak/lateral -> 0.50-0.65

The support relation itself may be a reviewer/agent scientific judgment rather
than an LKM `gfac_*` factor, but both endpoints must already be LKM-grounded
Gaia claims.

> Support reason discipline (no smuggling; on-the-fly premise claims are normal):
> see [`$gaia-package/references/emit-mapping.md`](../../gaia-package/references/emit-mapping.md) §4.

For cross-scope supports (different geometry, material, temperature, extraction
method, approximation, or mass definition), use weak priors close to neutral
(`0.50-0.58`) unless the LKM-grounded claim text directly implies the target.
Record the scope differences in `mapping_audit.md` or `merge_audit.md` so BP
does not silently treat lateral context as strong independent evidence.

Support candidates may be chain-backed or no-chain LKM source claims after cold
start. Chain-backed candidates may add their own `claim(...)` nodes and
factor-derived `deduction(...)` strategies. No-chain candidates may enter only
as leaf/source `claim(...)` nodes with clear content and provenance.

### 3a. Shared-factor extraction (>=2 supports converging on same target)

When >=2 upstream supports converge on the same target claim P, check whether the upstream claims share a common factor (same method, model assumption, dataset, physical approximation). If they do, BP would incorrectly treat them as independent evidence. Extract the shared factor as a new claim and route supports through it:

```
Before:  U1 --support-->  P
         U2 --support-->  P      <- double counting

After:   U1 --support-->  shared_factor  <--support-- U2
                                 |
                              support
                                 |
                                 v
                                 P
```

Judge the shared factor's prior normally (cap 0.9).

## 4. Open-question-first contradiction handling

This section is the canonical policy for contradiction handling in the local
LKM-explorer workflow.

The workflow prioritizes open questions during discovery and mapping. When two
source claims `A` and `B` appear to be in tension, first record the scientific
open problem they raise. The open problem belongs in
`artifacts/lkm-discovery/contradictions.md`, `mapping_audit.md`, and, when it
may drive later work, `.gaia/inquiry/` as a hypothesis.

During root-claim frontier expansion, run an open-question/conflict channel for every
frontier claim. Minimum effort is 5 distinct LKM match queries with `top_k=10`.
Prioritize theory-vs-experiment or experiment-vs-theory candidates first: if the
frontier claim is theoretical/computational, look first for experimental
observations or measurements that disagree with or qualify it; if the frontier
claim is experimental, look first for theoretical/computational results that
disagree with or reinterpret it. Then search same-system different-method,
boundary-condition, approximation/regime, and adjacent hypothesis candidates.
If no candidate satisfies the hypothesis or contradiction standard, record the
queries and rejection rationales as `conflict_not_found`.

At the final contradiction scan, promote a candidate to executable Gaia DSL when
it is a scientifically meaningful, adjudicable conflict: the pair concerns the
same scientific object/question closely enough that resolving the open problem
would confirm, falsify, or materially qualify at least one side of `A`/`B`.
This admission standard is intentionally broader than strict logical identity
of scope. Differences in method, finite-size treatment, extrapolation protocol,
approximation domain, or benchmark regime do not by themselves block promotion
when the field-facing question is genuinely the same.

Accepted scientific contradictions use the direct operator. Name the operator
after the two sides so graph views and review output make the conflict visible
without opening metadata:

```python
<side_a>_vs_<side_b>[_<quantity_or_regime>] = contradiction(
    A,
    B,
    prior=0.95,
    reason="<why these claims are adjudicably conflicting> | open_problem: <specific discriminating question>",
)
```

Label rules:
- Prefer `<side_a>_vs_<side_b>` with short semantic side names, e.g.
  `dmc_vs_gw_mass_enhancement`.
- Add a quantity/regime suffix when needed to disambiguate, e.g.
  `low_density_dmc_vs_gw_mass_enhancement`.
- Keep the label a valid Gaia/Python identifier: lowercase letters, digits, and
  underscores only.
- Do not name the node `scientific_inconsistency_*`, `paradox_*`, or a generic
  `contradiction_*`; the operator kind already supplies the relation semantics,
  while the label should identify the two conflicting sides.

The contradiction operator prior is the warrant strength that this pair should
be treated as an adjudicable scientific contradiction, not a prior on either
claim being true. Use `0.95` for clear accepted contradictions. Use `0.85-0.92`
only when the pair is accepted but the scope match or discriminating question is
less crisp. Do not lower the operator prior merely because the candidate came
from different methods; method/method conflicts are often the point of the
contradiction.

In audit rows, record the taxonomy explicitly:

```text
decision: accepted_contradiction
relation_type: scientific_inconsistency
```

`scientific_inconsistency` is the audit/taxonomy class for accepted
contradictions under this workflow. It is not the Gaia node label. Avoid
`paradox` as a formal relation type; it may be used only in synthesis prose when
appropriate for the field.

### Promotion signals

Promote a candidate to `contradiction(A, B)` when one or more of these apply:

- The claims assert opposite values, signs, orderings, trends, or qualitative
  conclusions about the same system/material, quantity/effect, or scientific
  mechanism.
- The claims use different methods or approximations but are commonly read as
  answering the same field-facing question.
- The disagreement can be tested by a concrete calculation, measurement,
  benchmark, extrapolation, or reanalysis.
- Resolving that test would make at least one claim, interpretation, or
  unqualified conclusion untenable or materially qualified.

For example, the low-density 2D homogeneous-electron-gas effective-mass tension
where treatments can put `m*/m` on opposite sides of unity is admissible as an
accepted contradiction: the open problem is whether the sign and magnitude of
the mass renormalization survive matched treatment of correlation,
finite-size/extrapolation, and approximation regime.

### Hypothesis-only tensions

Keep a candidate as audit/hypothesis-only when the pair is interesting but not
yet promotable:

- the open problem is still vague or not discriminating,
- the scope relation is unknown because content/provenance is insufficient,
- the claims address adjacent but not adjudicably conflicting questions,
- the candidate is a model-applicability gap, coverage gap, or benchmark
  omission without a concrete test,
- the candidate is a false alarm, duplicate wording, or unsupported search lead.

For hypothesis-only rows, record why the pair is scientifically interesting,
the best current open problem, why no `contradiction(...)` operator was emitted,
and what query or evidence would be needed to promote it later.

## 8. Timeline replay logs (LKM-explorer requirement)

For LKM-explorer package work, every emitted claim, deduction, support,
contradiction, equivalence, merge, dismissal, inquiry update, and no-op search
verdict must be indexed in `graph_growth_log.jsonl` per the canonical v1
schema in
[`$gaia-package/references/audit-log.md`](../../gaia-package/references/audit-log.md),
with links back to the LKM retrieval events and raw input files that grounded
the decision. Each growth event must include a structured `graph_delta` block
containing added/removed nodes and edges, so a frontend can replay the starmap
without parsing Python source.

In addition, this skill emits an LKM-specific `retrieval_log.jsonl` whose
schema is documented in
[`references/timeline-log-contract.md`](timeline-log-contract.md). It records
every package-scoped `$lkm-api` call (`match`, `evidence`, `variables`) and is
linked from each graph-growth event via `retrieval_event_ids`.

These requirements are package replay/audit requirements, not Gaia DSL syntax.
They do not apply to the raw `$lkm-api` skill or sibling graph/synthesis skills.

## 9. What this contract does NOT cover

- Generic claim/deduction/support/contradiction/equivalence emission rules,
  the metadata-kwarg taxonomy (`provenance_source`, `claim_kind`, `weak_types`,
  `p1`/`p2`/`review_prior`, `refs` whitelist), label discipline, and module
  placement — all owned by
  [`$gaia-package/references/emit-mapping.md`](../../gaia-package/references/emit-mapping.md).
- Package layout and templates (`pyproject.toml`, `__init__.py`,
  `paper_<key>.py`, `cross_paper.py`, `priors.py`, `references.json`) — owned
  by
  [`$gaia-package/references/package-shape.md`](../../gaia-package/references/package-shape.md).
- The `graph_growth_log.jsonl` v1 schema (event identity, decision
  vocabulary, `graph_delta` block, append-only / `supersedes_event_id`) —
  owned by
  [`$gaia-package/references/audit-log.md`](../../gaia-package/references/audit-log.md).
- The full `priors.py` shape — follow current package examples and verify with
  `gaia check --hole`.
- The shape of `pyproject.toml` — follow current package examples and verify
  with `gaia compile`.
- BP interpretation and weakness analysis — handled by caller/user review after
  `gaia infer`.
- Render-time choices — use `gaia render` or package-specific render commands
  after compilation/inference.
- The Gaia DSL grammar — governed by the installed Gaia library.
