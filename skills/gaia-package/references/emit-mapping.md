# Emit Mapping — Analytical Objects → Gaia DSL

This document covers the **mapping policy** — what each analytical object
becomes in the emitted Gaia DSL, and the metadata that travels with it.
Gaia syntax is governed by the installed Gaia library/CLI; verify package
files with `gaia compile` and `gaia check --hole .` after emission.

The contract is unified across upstreams: claims, deductions, supports,
contradictions, equivalences, and questions are emitted the same way
regardless of whether the upstream is LKM evidence chains, single-paper
analysis, or any future ingestion route. Upstream-specific extensions (e.g.
LKM frontier expansion, paper-decomposition phases) live in the consumer
skill's contract, not here.

## 0. Metadata schema and ecosystem alignment

Gaia's `claim(...)` primitive accepts arbitrary `**metadata` kwargs and
stores them in the `Knowledge.metadata` dict — it does **not** validate
kwarg names. This contract pins the kwargs that travel on every claim, plus
the upstream-specific extensions used to distinguish provenance.

### Shared metadata kwargs

| kwarg                | type   | meaning                                                                |
|----------------------|--------|------------------------------------------------------------------------|
| `source_paper`       | string | reference key matching `references.json` (e.g., `"Liu2015"`, or `"paper:xxx"` for LKM paper ids) |
| `provenance_source`  | string | enum (see §0a) — labels the upstream that produced this claim          |
| `refs`               | tuple  | structured location pointers — see §1a                                 |

### LKM-extracted-claim kwargs

Used by `$lkm-explorer` (and any future LKM-driven emitter). Not emitted
by paper-extract.

| kwarg              | type            | meaning                                                                |
|--------------------|-----------------|------------------------------------------------------------------------|
| `lkm_id`           | string          | the original `gcn_*` id this claim was minted from                     |
| `lkm_ids`          | list of string  | plural form when premises were merged (`["gcn_a", "gcn_b"]`)           |
| `lkm_original`     | string          | the original LKM text body, preserved when the claim body was rewritten for self-containment |
| `todo`             | string          | `"revisit when LKM corpus populates this premise"` (placeholder premise) |
| `content_missing`  | bool            | `true` when an empty-content chain-internal premise had to be placeholdered |

### Paper-extracted-claim kwargs

Used by paper-extract emitters (e.g., the upcoming `$formalize`). Extensions,
not conflicts; the LKM consumer simply sees additional dictionary entries on
`Knowledge.metadata` and ignores them. Each is valid on both
`claim_kind="conclusion"` and `claim_kind="weak_point"` unless noted.

| kwarg          | type            | applies to             | meaning                                                              |
|----------------|-----------------|------------------------|----------------------------------------------------------------------|
| `claim_kind`   | string          | both                   | `"conclusion"` (paper root) or `"weak_point"` (paper leaf premise)   |
| `weak_types`   | tuple of str    | `weak_point` only      | 1–3 of nine argument-pattern keys (see §2)                           |
| `p1`           | float in [0,1]  | `weak_point` only      | reviewer sufficiency: `P(conclusion | weak_point true)`              |
| `p2`           | float in [0,1]  | `weak_point` only      | reviewer necessity: `P(conclusion false | weak_point false)`         |
| `review_prior` | float in [0,0.9]| `conclusion` only      | per-conclusion synthesis prior — the reviewer's *posterior* judgment of conclusion credibility, integrating weak points and highlights. **Distinct from** the `deduction(..., prior=X)` warrant on the deduction targeting this conclusion (which is warrant strength, not posterior). Capped at 0.9 (Cromwell). |

These extensions are stable and additive. A consumer that does not understand
them will silently see them as extra metadata. A consumer that understands
them (paper-extract audit tooling, paper-aware renderers) can use them to
distinguish weak-point leaves, render `p1`/`p2` calibration tables, and
color claims by provenance source.

### 0a. `provenance_source` enum

Open ecosystem enum. Allowed values:

- **`"lkm"`** — produced by an LKM-driven emitter from a chain-backed LKM
  claim (`total_chains > 0`).
- **`"lkm_no_chain"`** — produced by an LKM-driven emitter from an LKM
  source claim with `total_chains = 0` (post-cold-start leaf/source claim).
- **`"paper_extract"`** — produced by a paper-extract emitter from direct
  paper-Markdown analysis.

Tooling that filters by source can rely on this enum to distinguish
provenance routes. New values are reserved for future emitters; consumers
should treat unknown values as opaque.

## 1. Claims → `claim(...)`

Every emitted claim becomes one `claim(...)` call with mandatory metadata:

```python
<label> = claim(
    r"<self-contained scientific statement>",   # use r"..." when body contains LaTeX
    # claim_kind only for paper-extract:
    # claim_kind="conclusion" | "weak_point",
    source_paper="<reference_key_or_paper_id>",
    provenance_source="lkm" | "lkm_no_chain" | "paper_extract",
    # provenance-specific extras:
    # lkm_id="gcn_xxx",                         # LKM single-source
    # lkm_ids=["gcn_a", "gcn_b"],               # LKM merged premises
    # review_prior=0.78,                        # paper-extract conclusion only
    # weak_types=("model",),                    # paper-extract weak point only
    # p1=0.7, p2=0.85,                          # paper-extract weak point only
    refs=(                                      # optional, see §1a
        {"type": "figure", "id": "Fig. 3"},
        {"type": "equation", "id": "Eq. (5)"},
        {"type": "citation", "key": "Smith2020"},
    ),
)
```

### Self-containment rule

The string body must be a self-contained scientific proposition. A reader
who has never seen the upstream source must, from the body alone, be able
to identify the system, method, quantity, and regime. If the upstream
phrasing omits critical context (system, method, quantity, conditions),
rewrite it with information from the surrounding evidence — the chain
text, the paper section, the figure caption — **as you write the claim**,
not after the fact.

For LKM-extracted claims, save the original LKM text in `lkm_original`
metadata when you rewrite. For paper-extracted claims, the audit text from
the analytical phases (`weakness_reason`, `failure_mode`, narrative
prose) is **not** part of the claim body — it goes into `mapping_audit.md`.

### No `prior` kwarg on `claim(...)`

LKM's `score` is match relevance, not a Bayesian prior. The Gaia `claim`
primitive does not accept `prior=`. Leaf priors live in `priors.py`.

After `gaia compile`, run `gaia check --hole` to surface leaves that need
priors, then fill them in `priors.py` (see §6).

For LKM-driven emitters: do not lower a prior solely because
`total_chains=0`. Set priors from claim content, provenance clarity, method
specificity, and scientific judgment.

### Empty-content premises vs search leads (LKM)

- **Chain-internal empty-content premises** may get a placeholder body string
  + `todo="revisit when LKM corpus populates this premise"` + `content_missing=true`
  metadata when needed to preserve a factor-derived `deduction(...)`. Log
  `content_missing=true` in `mapping_audit.md`. Do not invent content.
- **Search/match results outside an accepted chain** that lack content or
  provenance are **search leads**, not placeholder claims. They stay in
  audit/search notes; they do **not** enter executable DSL.

### 1a. The `refs` metadata field

`refs` is the structured location-pointer metadata for any `claim(...)`. It
is an immutable tuple (or `None` / absent when nothing applies) of dicts.
**Only three `type` values are allowed**:

| `type`     | What it points to                              | Required key        |
|------------|------------------------------------------------|---------------------|
| `figure`   | A figure or table inside the paper             | `id` (e.g. `"Fig. 3"`, `"Table I"`) |
| `equation` | An equation referenced by number               | `id` (e.g. `"Eq. (5)"`) |
| `citation` | An external bibliographic reference            | `key` (matching `references.json`) |

Any other `type` is **forbidden**. In particular: section, appendix,
theorem, lemma, paragraph, and footnote pointers are not legitimate `refs`
entries and must not appear anywhere in the package — neither in `refs`,
nor in any prose body. If a claim's content is rooted in a section or
appendix, the content has to be inlined into the body itself; the location
is recorded in `mapping_audit.md` only, not in `refs`.

`refs` is metadata; it does **not** absolve the body of self-containment.
The body must still inline what the figure shows, what the equation states,
and what the cited result claims. `refs` is a structured pointer for audit
and rendering, not a substitute for substance.

### Label rules

`<label>` must be a valid **Gaia QID**: `[a-z_][a-z0-9_]*` — lowercase
letters, digits, and underscores only. No uppercase, no hyphens, no dots,
no diacritics.

Suggested patterns:

| Origin                            | Pattern                              | Example                            |
|-----------------------------------|--------------------------------------|------------------------------------|
| LKM-extracted claim               | `gcn_<short_hash>` or semantic       | `gcn_66ac13c8`                     |
| LKM semantic claim                | `gcn_xxx_<semantic>`                 | `gcn_dmc_low_density_mass`         |
| Paper conclusion                  | `<key>_c<id>_<semantic_suffix>`      | `liu2015_c1_fibonacci_emergence`   |
| Paper weak point                  | `<key>_c<id>_wp_<semantic_suffix>`   | `liu2015_c1_wp_static_screening`   |
| Paper motivation                  | `<key>_problem` (fixed suffix)       | `liu2015_problem`                  |
| Paper open question (opt-in)      | `<key>_open_question_<n>`            | `liu2015_open_question_1`          |
| Cross-paper contradiction         | `<side_a>_vs_<side_b>[_<regime>]`    | `dmc_vs_gw_mass_enhancement`       |

The semantic suffix should be 1–4 tokens, taken from the conclusion's or
weak point's title rather than its full body, so labels stay short. Strip
diacritics. Use a stable suffix per finding; do not rely solely on
ephemeral audit ids (e.g., `P1`, `P2` from a phase-3 review).

### `__all__` rules

- Define `__all__` **only** in `__init__.py`, not in submodules.
- Multi-paper packages export the **selected root claims**, deduped.
- Single-paper packages export every conclusion `claim(...)`, plus the
  motivation `question(...)` (`<key>_problem`), plus any opt-in
  open-question `question(...)` nodes.
- Weak-point claims are imported internally for use in deductions and
  priors but are **not** re-exported.

## 2. Weak points (paper-extract only) → `claim(...)` + `priors.py`

Paper-extract emitters surface weak points — load-bearing uncertainties a
conclusion's derivation rests on. Each weak point produces one
`claim(...)` call **and** one `priors.py` entry:

```python
# in paper_<key>.py
<weak_label> = claim(
    r"<self-contained scientific statement of the weak-point claim>",
    claim_kind="weak_point",
    source_paper="<reference_key>",
    provenance_source="paper_extract",
    weak_types=("<primary>", "<secondary>"),     # 1–3 of the 9 patterns
    p1=<float>,
    p2=<float>,
    refs=(
        {"type": "figure", "id": "Fig. 4"},
        {"type": "equation", "id": "Eq. (12)"},
    ),
)
```

```python
# in priors.py
PRIORS = {
    <weak_label>: (<prior>, "<one-line justification + TODO:review>"),
    ...
}
```

### `weak_types` enum (9 argument patterns)

Allowed keys for `weak_types`:

- **`measurement`** — empirical measurement uncertainty (calibration,
  resolution, systematic error).
- **`causal`** — causal-inference assumption (confounding, mechanism,
  directionality).
- **`model`** — model-assumption uncertainty (idealization, approximation,
  parameter choice).
- **`statistical`** — statistical-inference uncertainty (sample size,
  null-hypothesis framing, multiple comparisons).
- **`generalization`** — extrapolation beyond the studied regime.
- **`comparative`** — choice of baseline / comparison group.
- **`formal`** — formal-derivation gap (skipped step, asserted lemma).
- **`computational`** — numerical artifact (convergence, finite-size,
  precision).
- **`external`** — dependence on external work whose validity is open.

Carry 1–3 keys per weak point; the first is the dominant pattern. No
invented keys — if no listed pattern fits, escalate to a contract update
rather than expanding the enum locally.

### 2a. Weak point ↔ one conclusion (strict)

Every weak point is bound to **exactly one** conclusion — the conclusion
whose derivation it threatens. The weak-point label is
`<key>_c<id>_wp_<suffix>` where `<id>` is **the** target conclusion's id;
the leaf claim appears as a premise in **only that conclusion's**
`deduction(...)` and nowhere else.

If a single scientific uncertainty appears to threaten multiple
conclusions, do not flatten it across deductions:

- **Cross-conclusion propagation goes through the logic graph.** If C2's
  weak point W1 also undermines C4 because C4 derives from C2, the doubt
  reaches C4 by `W1 → C2 → C4` through the deduction chain. No duplication
  of W1 is needed; BP handles the propagation correctly.
- **For independent conclusions sharing a foundational assumption**
  (no logic-graph edge connects them), bind the weak point to the
  conclusion whose failure mode is most catastrophic; tie-break by smaller
  id. Record the BP-invisible effect on the other conclusions in
  `mapping_audit.md` (`also_threatens` column on the weak-point row).
- **No copy-pasting of the body.** Splitting one uncertainty into N
  near-duplicate weak-point claims with the same body but different
  conclusion ids creates BP-independent leaves whose priors should be
  perfectly correlated — BP cannot represent that correlation, so the
  conclusion beliefs would be biased. Keep one weak-point claim per
  finding.

### `p1` and `p2` semantics

Paper-extract reviewer calibration:

- **`p1`** (sufficiency): `P(conclusion | weak_point true)`. If the weak
  point holds, how confident is the reviewer in the conclusion?
- **`p2`** (necessity): `P(conclusion false | weak_point false)`. If the
  weak point fails, how confident is the reviewer in the conclusion's
  failure?

Stored as metadata; BP does not consume them, but reviewers do.

### `review_prior` semantics

Paper-extract per-conclusion synthesis prior. Distinct from the
`deduction(..., prior=X)` warrant:

- **`review_prior`** (on the conclusion `claim(...)` metadata) is the
  reviewer's **posterior** judgment of conclusion credibility, integrating
  weak points and highlights.
- **`deduction(..., prior=X)`** is the **warrant strength** of the
  inference itself — given the premises, how reliably the chain propagates
  belief to the conclusion. See §3.

Capped at 0.9 (Cromwell).

## 3. Deductions → `deduction(...)`

Reasoning chains, factor-backed inferences, and per-conclusion derivations
all become `deduction(...)` calls (positional-first Gaia strategy style):

```python
deduction(
    [<premise_label_1>, <premise_label_2>, ...],
    <conclusion_label>,
    reason=r"""
1. <step 1 prose>.
2. <step 2 prose>.
...
""".strip(),
    prior=0.95,
)
```

### Always `deduction`, regardless of operator subtype

Always emit `deduction`, regardless of whether the upstream argument is
experimental, theoretical, or computational, and regardless of the LKM
factor's `subtype`. The rhetorical mode is captured by the prose in
`reason=`, not by the operator kind.

### Premises list

- For LKM-driven emitters: the premises list is the LKM factor's
  `evidence_chains[].factors[]` premise ids, mapped to their Gaia labels.
- For paper-extract emitters: the premises list is the **union** of
  **direct** upstream conclusions (only conclusions connected by a logic-graph
  edge that ends at this conclusion; transitive ancestors are *not* listed)
  and weak-point claims scoped to this conclusion. A weak point appears in
  **only one** deduction's premises (see §2a).

Multiple `deduction(...)` calls may share the same conclusion label.

### `reason=` formatting

- For LKM-driven emitters: when `steps[]` contains `reasoning`, format as
  numbered markdown — one numbered item per `steps[].reasoning`,
  preserving step order and figure/table references from the original.
  When `steps[]` is missing, use the explicit fallback:
  `reason="LKM factor <gfac_id> links premises <ids> to conclusion <id>; step-level reasoning was not returned by the API."`
  Log `steps_missing=true` for that factor in `mapping_audit.md`.
- For paper-extract emitters: format the full reasoning chain as numbered
  Markdown, preserving topological order. Every symbol introduced in
  `reason=` must already be defined inside the prose; no `Eq. (X)` or
  `Section II` pointers (the analytical phase already enforces this).

### Citation form in `reason=` (and any claim body)

External citations inside `reason=` and inside any `claim(...)` body use
the `[@key]` form, where `key` matches an entry in `references.json`.
Numeric paper-style citations like `[33]`, `[Smith20]`, or `Ref. 5` are
**not** allowed in prose — convert at write time.

If a `references.json` key cannot be derived (incomplete bibliography),
record the gap in `mapping_audit.md` and emit `@unknown_<n>` (bare, **no
brackets**) as a placeholder for the reviewer to resolve. The bracketed
`[@key]` form is Gaia's *strict* reference syntax and `gaia compile`
rejects unresolvable strict refs; the bare `@key` form is opportunistic
and compiles even if the key has no `references.json` entry.

### Warrant calibration

`prior=X` on a `deduction(...)` is the **warrant strength** of the
inference — given the premises, how reliably the chain propagates belief
to the conclusion. It is **not** the reviewer's overall judgment of how
likely the conclusion is to hold (that is `review_prior`, stored as
metadata on the conclusion `claim(...)` — see §0).

**Default: 0.95.** Adjust by these rules:

- **+0.02 to +0.04** when a highlight specifically underwrites a step
  in this chain (independent cross-validation, formal proof of an
  otherwise-assumed step). Cap at **0.99**.
- **−0.05 to −0.10** for each explicit logical gap that had to be
  flagged ("the authors assert without derivation that ..."). Floor at
  **0.80**.
- When a chain has both highlights and gaps, apply both adjustments
  additively from the 0.95 baseline; record each adjustment with its
  rationale in `mapping_audit.md`.

For LKM-driven emitters, the default `prior=0.95` is for backward
compatibility (Gaia #494 makes `deduction` rigid with default 0.999;
remove the explicit `0.95` once that is widely adopted).

## 4. Supports → `support([...], target, prior=...)`

Used when the agent identifies upstream evidence that directly supports a
target claim outside the deduction chain backbone. A single target claim
may have **multiple** accepted upstream supports:

```python
support([U_1], target, reason="<what U_1 says and why it supports target>", prior=<float>)
support([U_2], target, reason="<what U_2 says and why it supports target>", prior=<float>)
```

When several upstream claims only support the target jointly, use one
joint support:

```python
support([U_1, U_2], target, reason="<joint support rationale>", prior=<float>)
```

`support([a], b, prior=p)` is directional: `a` supports `b`. Higher `p`
means the support warrant is stronger; `p` close to 1 means `a` nearly
determines `b`.

### Warrant prior bands

- **Strong** (same topic, directly implies) → 0.85–0.95
- **Moderate** (related, partially overlaps) → 0.70–0.85
- **Weak / lateral** → 0.50–0.65

For cross-scope supports (different geometry, material, temperature,
extraction method, approximation, or mass definition), use weak priors
close to neutral (`0.50–0.58`) unless the upstream claim text directly
implies the target. Record the scope differences in `mapping_audit.md`
so BP does not silently treat lateral context as strong independent
evidence.

### Support reason discipline

A `support(...)` reason may explain why claim A supports claim B; it must
**not** introduce a new factual proposition that should instead be mapped
as its own grounded `claim(...)`. Both endpoints must already be grounded
Gaia claims.

The support relation itself may be a reviewer/agent scientific judgment
rather than an upstream-source factor (e.g., not an LKM `gfac_*`), but
the endpoints are non-negotiable.

Upstream-specific search/admission rules (LKM frontier search effort,
shared-factor extraction, no-chain support candidate handling) live in
the consumer skill's contract, not here.

## 5. Contradictions → `contradiction(A, B, ...)`

Accepted scientific contradictions use the direct operator. Name the
operator after the two sides so graph views and review output make the
conflict visible without opening metadata:

```python
<side_a>_vs_<side_b>[_<quantity_or_regime>] = contradiction(
    A,
    B,
    prior=0.95,
    reason="<why these claims are adjudicably conflicting> | open_problem: <specific discriminating question>",
)
```

### Label rules

- Prefer `<side_a>_vs_<side_b>` with short semantic side names, e.g.
  `dmc_vs_gw_mass_enhancement`.
- Add a quantity/regime suffix when needed to disambiguate, e.g.
  `low_density_dmc_vs_gw_mass_enhancement`.
- Keep the label a valid Gaia/Python identifier: lowercase letters,
  digits, and underscores only.
- Do not name the node `scientific_inconsistency_*`, `paradox_*`, or a
  generic `contradiction_*`; the operator kind already supplies the
  relation semantics, while the label should identify the two
  conflicting sides.

### Operator prior

The contradiction operator prior is the **warrant strength that this pair
should be treated as an adjudicable scientific contradiction**, not a
prior on either claim being true. Use:

- **0.95** for clear accepted contradictions.
- **0.85–0.92** when the pair is accepted but the scope match or
  discriminating question is less crisp.

Do not lower the operator prior merely because the candidate came from
different methods; method/method conflicts are often the point of the
contradiction.

### Audit taxonomy

In `mapping_audit.md` rows, record the taxonomy explicitly:

```text
decision: accepted_contradiction
relation_type: scientific_inconsistency
```

`scientific_inconsistency` is the audit/taxonomy class for accepted
contradictions. It is **not** the Gaia node label. Avoid `paradox` as a
formal relation type; it may be used only in synthesis prose when
appropriate for the field.

The **promotion criteria** (when a tension becomes an accepted
contradiction vs an audit-only hypothesis) and the open-question-first
discovery workflow are upstream-specific (e.g., `$lkm-explorer` runs an
explicit open-question/conflict channel during frontier expansion). Those
rules live in the consumer skill's contract.

## 6. Equivalences → `equivalence(...)`

When two claims represent the same scientific proposition under different
upstream sources (same paper preprint vs published version, parallel
chains converging on identical content), emit:

```python
equivalence(A, B, reason="<why these are the same claim>", prior=<float>)
```

Equivalences belong in `cross_paper.py` for multi-paper packages.
Single-paper packages typically have no equivalences (no cross-paper
relations to record).

When two claims are merged before DSL emission (same paper, identical
scientific content, e.g. arXiv → PRB), record the merge in
`mapping_audit.md` with `dsl_action: merged; no equivalence()` and emit
**no** `equivalence(...)` operator. Equivalence is for distinct nodes
that the agent judges semantically identical; merging is for nodes that
should not exist as two nodes in the first place.

## 7. Motivations and open questions → `question(...)`

Used by paper-extract emitters to surface paper-level pre-state and
unresolved issues. Emitted as Gaia `question(...)` nodes:

```python
<key>_problem = question(
    r"<self-contained motivation text — pre-paper problem state>",
    source_paper="<reference_key>",
    provenance_source="paper_extract",
)
```

Rules:

- **Motivation block** is emitted **by default** as `<key>_problem` (one
  per paper). Aligned with the canonical XML→LKM ingestion path, where
  `<problem>` from `select_conclusion.xml` becomes a
  `LocalVariableNode(type="question")`.
- **Label format `<key>_problem`** (single fixed suffix; one motivation
  block per paper).
- The motivation body is itself a self-contained scientific narrative —
  apply the same self-containment rules as for `claim(...)` bodies.
- `<key>_problem` is exported in `__init__.py`'s `__all__`.
- No `prior` kwarg on `question(...)`; questions do not carry
  probabilities in Gaia.
- **Open questions** (paper-level post-paper unresolved issues) remain
  audit-only **unless** the user explicitly asks to emit them. If
  emitted, format is `<key>_open_question_<n> = question(...)` and
  these labels also enter `__all__`. Pipeline B does not extract open
  questions, so this is a paper-extract-specific extension.

LKM-driven emitters do not normally emit motivation `question(...)`
nodes — LKM has no analogous paper-level pre-state object.

## 8. Leaf priors → `priors.py`

Claims that are **leaves** (not the conclusion of any strategy) and were
surfaced by `gaia check --hole` get entries in `priors.py`:

```python
PRIORS = {
    <label>: (<float>, "<heuristic tag + context + TODO:review>"),
    ...
}
```

The float is the agent's direct judgment: **what is the probability this
claim is correct?**

- **Cap: 0.9** — no claim is absolutely certain, no matter how
  well-established.
- **Floor: 0.001** (Cromwell).
- **No heuristic buckets** — read the claim and estimate.
- Every justification text **ends with `TODO:review`** so a downstream
  reviewer can grep for unfinalized priors.

For paper-extract weak points, sourcing comes from the analytical phase's
`prior_probability` plus the reviewer's per-failure-mode calibration. If a
highlight preempts a failure mode, the justification text can note
"highlight H_x preempts failure mode" so a reviewer sees the offset; the
numeric prior need not change.

## 9. Module placement

- Each canonical claim → module of the **first paper** it appears in
  (paper id alphabetical tie-break for LKM; the source paper for
  paper-extract).
- Each LKM `gfac_*` factor → module of `factor.source_package`.
- Cross-paper operators → `cross_paper.py`.
- For single-paper packages: no `cross_paper.py`; everything lives in
  `paper_<key>.py` plus `priors.py`.
- `__init__.py` re-exports via `from .paper_<key> import *` and (when
  present) `from .cross_paper import *`.

## 10. `data.papers` / paper bibliography → `references.json`

Every source paper (and every external citation reused inside the
package) becomes a CSL-JSON record. Key format: `<FirstAuthorSurname><Year>`,
deduped by suffix letters (`Liu2015`, `Liu2015a`). Authors field is a list
of `{"family", "given"}` objects; multi-source LKM ingestion may parse
pipe-separated `"Surname Given | ..."` strings best-effort. Cite from prose
with `[@<key>]`.

For paper-extract emitters, parse the bibliography section of the source
Markdown for first-author surname + year. Include only fields actually
present; do not invent DOIs, journals, or years. Record gaps in
`mapping_audit.md`. If a key cannot be derived (truncated bibliography,
"et al." with no year), emit the citation as `@unknown_<n>` (bare, **no
brackets**) and add a row to `mapping_audit.md` under "Metadata gaps and
rationale".

The `source_paper` kwarg on every claim must be the literal key string
used in `references.json` (without the `[@...]` wrapper).

## 11. What this contract does NOT cover

- Upstream-specific search workflows (LKM frontier expansion, paper
  decomposition phases) — owned by the consumer skill.
- Upstream-specific admission criteria (chain-backed vs no-chain LKM,
  open-question promotion thresholds) — owned by the consumer skill.
- Upstream-specific audit files (`retrieval_log.jsonl`, `merge_audit.md`,
  `merge_decisions.todo`, `dismissed/`) — owned by the consumer skill.
- BP interpretation, weakness analysis, rendering — handled by the
  caller after `gaia infer`.
- Multi-paper merges of single-paper packages — out of scope.
- The Gaia DSL grammar itself — governed by the installed Gaia library.
