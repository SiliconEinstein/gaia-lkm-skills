# Mapping contract — LKM evidence → Gaia DSL output

> This document covers the *mapping policy* — what each piece of LKM evidence
> becomes in the emitted DSL. Gaia syntax and package shape are governed by the
> installed Gaia library/CLI and must be verified with local Gaia quality gates.

## 0. Evidence-status vocabulary

- **Chain-backed claim**: LKM returned claim content and `GET /claims/{id}/evidence` has `total_chains > 0`. Emit `claim(...)` plus factor-derived `deduction(...)` when factors are present.
- **LKM source claim**: LKM returned claim content and provenance, but `total_chains = 0`. After cold start, emit it as a leaf/source `claim(...)`; do not invent premises or deductions.
- **Search lead**: insufficient content or provenance for a self-contained claim outside an accepted chain-backed factor. Keep only in audit/search notes.

`total_chains > 0` is required for cold-start root selection. It is not a global admissibility rule for post-cold-start frontier expansion or conflict-channel candidates.

## 1. Claims (`gcn_*`)

Every distinct LKM-returned `gcn_*` id (post shared-premise extraction) becomes one `claim(...)` call when its content/provenance are clear enough:

```python
<label> = claim(
    "<content>",                         # or placeholder if empty
    lkm_id="gcn_xxx",                    # **metadata
    source_paper="paper:xxx",
    provenance_source="lkm",             # or "lkm_no_chain" for total_chains=0 source claims
)
```

Rules:
- `<label>` is mint from the `gcn_*` id and the claim's semantic content. **Must be valid Gaia QID label: `[a-z_][a-z0-9_]*`** — lowercase letters, digits, underscores only. No uppercase, no hyphens, no dots.
- **Self-contained check.** Before writing, verify the claim can be judged true/false independently. If the LKM text omits critical context (system, method, quantity, conditions), rewrite it with information from the evidence chain. Save the original in `lkm_original` metadata.
- **No `prior` kwarg on claims.** LKM's `score` is match relevance, not a Bayesian prior. After `gaia compile`, run `gaia check --hole` to surface leaf claims that need priors, then fill them in `priors.py`.
- **No-chain LKM source claims.** If `total_chains = 0`, use `provenance_source="lkm_no_chain"`, preserve `lkm_id`, `lkm_original`, `source_paper` when available, and log the no-chain status in the audit trail. Do not create `deduction(...)` without factors.
- **Prior policy.** Do not lower a prior solely because `total_chains=0`. Set priors from claim content, provenance clarity, method/scope specificity, and scientific judgment.
- When premises are merged, the kwarg becomes `lkm_ids=["gcn_a", "gcn_b"]` (plural).
- Chain-internal empty-content premises may get a placeholder string + `todo="revisit when LKM corpus populates this premise"` in metadata when needed to preserve a factor-derived `deduction(...)`. Log `content_missing=true` in `mapping_audit.md`. Do not invent content.
- Empty or under-provenanced match/search results outside an accepted chain are **search leads**, not placeholder claims.

### 1a. Leaf priors → `priors.py`

Claims that are **leaves** (not the conclusion of any strategy) and were surfaced by `gaia check --hole` get entries in `priors.py`:

```python
PRIORS = {
    <label>: (<float>, "<heuristic tag + lkm context + TODO:review>"),
    ...
}
```

The float is the agent's direct judgment: **what is the probability this claim is correct?** Capped at 0.9 — no claim is absolutely certain, no matter how well-established. Lower bound: 0.001 (Cromwell). No heuristic buckets — just read the claim and estimate how likely it is to be true. Every justification text ends with `TODO:review`.

## 2. Factors (`gfac_*`)

Every factor in `evidence_chains[].factors[]` → `deduction(...)` (positional-first Gaia strategy style):

```python
deduction(
    [<premise_label_1>, <premise_label_2>, ...],
    <conclusion_label>,
    reason="<concatenated steps[].reasoning from the factor>",
    prior=0.95,
)
```

- When `steps[]` contains `reasoning`, `reason` is the LKM evidence formatted as numbered markdown: one numbered item per `steps[].reasoning`, preserving the step order from the LKM factor. Each step preserves figure/table references from the original.
- When `steps[]` is missing or has no usable `reasoning`, still emit the factor-derived `deduction(...)`, but make the fallback explicit: `reason="LKM factor <gfac_id> links premises <ids> to conclusion <id>; step-level reasoning was not returned by the API."` Log `steps_missing=true` for that factor in `mapping_audit.md`.
- `prior=0.95` — for backward compatibility (Gaia #494 makes deduction rigid with default 0.999; remove once widely adopted).
- **Always `deduction`**, regardless of LKM `subtype`.
- Multiple `deduction(...)` calls may share the same conclusion label.

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
- Strong (same topic, directly implies) → 0.85–0.95
- Moderate (related, partially overlaps) → 0.70–0.85
- Weak/lateral → 0.50–0.65

The support relation itself may be a reviewer/agent scientific judgment rather
than an LKM `gfac_*` factor, but both endpoints must already be LKM-grounded
Gaia claims. A `support(...)` reason may explain why claim A supports claim B;
it must not introduce a new factual proposition that should instead be mapped as
its own LKM-grounded `claim(...)`.

For cross-scope supports (different geometry, material, temperature, extraction
method, approximation, or mass definition), use weak priors close to neutral
(`0.50–0.58`) unless the LKM-grounded claim text directly implies the target.
Record the scope differences in `mapping_audit.md` or `merge_audit.md` so BP
does not silently treat lateral context as strong independent evidence.

Support candidates may be chain-backed or no-chain LKM source claims after cold
start. Chain-backed candidates may add their own `claim(...)` nodes and
factor-derived `deduction(...)` strategies. No-chain candidates may enter only
as leaf/source `claim(...)` nodes with clear content and provenance.

### 3a. Shared-factor extraction (≥2 supports converging on same target)

When ≥2 upstream supports converge on the same target claim P, check whether the upstream claims share a common factor (same method, model assumption, dataset, physical approximation). If they do, BP would incorrectly treat them as independent evidence. Extract the shared factor as a new claim and route supports through it:

```
Before:  U1 ──support──→ P
         U2 ──support──→ P      ← double counting

After:   U1 ──support──→ shared_factor ←──support── U2
                                 │
                              support
                                 │
                                 ▼
                                 P
```

Judge the shared factor's prior normally (cap 0.9).

## 4. Open-question-first contradiction handling

This section is the canonical policy for contradiction handling in the local
LKM->Gaia workflow.

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
claim being true. Use `0.95` for clear accepted contradictions. Use `0.85–0.92`
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

## 5. `data.papers` → `references.json`

Every paper in the union of `data.papers` across all evidence + match files → CSL-JSON record.

Key: `<firstAuthorSurname><year>`, deduped by suffix letters (`An2001`, `An2001a`, …). Authors field is pipe-separated (`Surname Given | ...`); best-effort parse. Cite via `[@<key>]`.

## 6. `__all__` and exported labels

Do NOT define `__all__` in submodules. Use a single `__all__` in `__init__.py`. Export the set of **selected root claims**, deduped.

## 7. Module placement

- Each canonical claim → module of the **first paper** it appears in (paper id alphabetical tie-break).
- Each `gfac_*` factor → module of `factor.source_package`.
- Cross-paper operators → `cross_paper.py`.
- `__init__.py` re-exports via `from .paper_<key> import *` and `from .cross_paper import *`.

## 8. Timeline replay logs

For LKM-to-Gaia package work, every emitted claim, deduction, support,
contradiction, equivalence, merge, dismissal, inquiry update, and no-op search
verdict must be indexed in `graph_growth_log.jsonl`, with links back to the
retrieval events and raw input files that grounded the decision. Each growth
event must include a structured `graph_delta` block containing added/removed
nodes and edges, so a frontend can replay the starmap without parsing Python
source. The exact JSONL schema lives in `timeline-log-contract.md`.

This requirement is a package replay/audit requirement, not Gaia DSL syntax. It
does not apply to the raw `$lkm-api` skill or sibling graph/synthesis skills.

## 9. What this contract does NOT cover

- The full `priors.py` shape — follow current package examples and verify with
  `gaia check --hole`.
- The shape of `pyproject.toml` — follow current package examples and verify
  with `gaia compile`.
- BP interpretation and weakness analysis — handled by caller/user review after
  `gaia infer`.
- Render-time choices — use `gaia render` or package-specific render commands
  after compilation/inference.
- The Gaia DSL grammar — governed by the installed Gaia library.
