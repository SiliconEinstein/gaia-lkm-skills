# Mapping Contract — Paper → Gaia DSL Output

> This document defines what each piece of paper analysis becomes in the
> emitted Gaia DSL. Gaia syntax and package shape are governed by the installed
> Gaia library/CLI; verify package files with `gaia compile` and
> `gaia check --hole .` after emission.

## 0a. Metadata schema and ecosystem alignment

`paper-to-gaia` packages live in the same ecosystem as `lkm-to-gaia`
packages and are consumed by the same `gaia compile` / `gaia infer` /
`gaia check --hole` toolchain. Gaia's `claim(...)` primitive
([`Gaia/gaia/lang/dsl/knowledge.py`](https://example.invalid))
accepts arbitrary `**metadata` kwargs and stores them in the
`Knowledge.metadata` dict — it does **not** validate kwarg names. Both
this skill and `lkm-to-gaia` rely on this and add their own metadata
fields. The shared and skill-specific fields are:

### Shared (both `paper-to-gaia` and `lkm-to-gaia`)

| kwarg                | type   | meaning                                                                |
|----------------------|--------|------------------------------------------------------------------------|
| `source_paper`       | string | reference key matching `references.json` (e.g., `"Liu2015"`)           |
| `provenance_source`  | string | enum (see below) — labels the upstream that produced this claim         |
| `refs`               | tuple  | structured location pointers — see §1a                                  |

`provenance_source` is treated as an open ecosystem enum. Allowed values:

- `"lkm"` — produced by lkm-to-gaia from a chain-backed LKM claim.
- `"lkm_no_chain"` — produced by lkm-to-gaia from an LKM source claim with
  `total_chains = 0`.
- `"paper_extract"` — produced by `paper-to-gaia` from direct paper-Markdown
  analysis (this skill).

Tooling that filters by source can rely on this enum to distinguish
provenance routes.

### `paper-to-gaia`-specific extensions

`paper-to-gaia` adds metadata fields that `lkm-to-gaia` does not use; they
are extensions, not conflicts (Gaia's flat `metadata` dict accepts both
silently). All are valid on both `claim_kind="conclusion"` and
`claim_kind="weak_point"` unless noted.

| kwarg          | type            | applies to             | meaning                                                              |
|----------------|-----------------|------------------------|----------------------------------------------------------------------|
| `claim_kind`   | string          | both                   | `"conclusion"` (Phase 1 root) or `"weak_point"` (Phase 3 leaf premise) |
| `weak_types`   | tuple of str    | `weak_point` only      | 1–3 of the nine argument-pattern keys (see Phase 3)                  |
| `p1`           | float in [0,1]  | `weak_point` only      | reviewer sufficiency: `P(conclusion | weak_point true)`              |
| `p2`           | float in [0,1]  | `weak_point` only      | reviewer necessity: `P(conclusion false | weak_point false)`         |
| `review_prior` | float in [0,0.9]| `conclusion` only      | Phase 3 per-conclusion synthesis prior — the reviewer's *posterior* judgment of conclusion credibility, integrating weak points and highlights. **Distinct from** the `deduction(..., prior=X)` warrant on the deduction targeting this conclusion (which is a warrant strength, not a posterior). Capped at 0.9 (Cromwell). |

These extensions are stable and additive. A consumer that does not
understand them (e.g., a tool written for `lkm-to-gaia` only) will simply
see additional dictionary entries on `Knowledge.metadata` and may ignore
them safely. A consumer that *does* understand them (e.g., the
paper-to-gaia audit tooling) can use them to distinguish weak-point
leaves, render `p1`/`p2` calibration tables, and color claims by
provenance source.

### `lkm-to-gaia`-specific kwargs (for reference; not emitted here)

`lkm-to-gaia` uses `lkm_id` / `lkm_ids`, `lkm_original`, `todo`, and
`content_missing`. `paper-to-gaia` does not emit these because there is
no LKM upstream to link back to.

## 0. Source Vocabulary

Phases 1–3 produce these analytical objects, all held in the agent's working
notes. None of them are written as standalone files before Phase 4.

- **Conclusion** — a paper's atomic, author-asserted new contribution
  (Phase 1). Becomes a `claim(..., claim_kind="conclusion")`.
- **Logic graph edge** — a directed dependency between two conclusions
  (Phase 1). The downstream conclusion's `deduction(...)` lists the upstream
  conclusion as a premise.
- **Reasoning step** — a single textual move in a conclusion's derivation
  (Phase 2). Reasoning steps are **not** claims; their concatenated text
  populates the `reason=` field of the conclusion's `deduction(...)`.
- **Weak point** (also called a *premise* in step 3 vocabulary) — a
  load-bearing uncertainty the conclusion's derivation rests on (Phase 3).
  Becomes a `claim(..., claim_kind="weak_point")` plus an entry in
  `priors.py`.
- **Highlight** — a load-bearing strength of the derivation (Phase 3). Audit
  log only; does **not** enter executable DSL. May influence the
  `deduction(...)` `prior=` warrant when the reviewer judges the reasoning
  unusually well-supported.
- **Motivation / Open question** — paper-level pre-state and unresolved
  issues (Phase 1). Audit log only by default; emit Gaia `question(...)` only
  if the user has explicitly asked for it.

## 1. Conclusions → `claim(...)`

Every Phase 1 conclusion produces one `claim(...)` call:

```python
<label> = claim(
    r"<self-contained scientific statement of the conclusion>",   # use r"..." when the body contains LaTeX
    claim_kind="conclusion",
    source_paper="<reference_key>",
    provenance_source="paper_extract",
    review_prior=0.78,                    # Phase 3 conclusion-synthesis prior; capped at 0.9
    refs=(                                # optional, see §1a
        {"type": "figure", "id": "Fig. 3"},
        {"type": "equation", "id": "Eq. (5)"},
        {"type": "citation", "key": "Smith2020"},
    ),
)
```

Rules:

- `<label>` is a valid Gaia QID — `[a-z_][a-z0-9_]*`. Mint it from the paper
  reference key plus the Phase 1 conclusion id and a short semantic suffix,
  e.g. `liu2015_c1_fibonacci_anyon_emergence`. Lowercase, digits, underscores
  only; no hyphens, no uppercase.
- The string body is a self-contained scientific proposition. Apply the
  step-4 self-containment rules **as you write it**, not after the fact. A
  reader who has never seen the paper must, from the body alone, be able to
  identify the model/system/dataset, the regime, the symbols, and the claim.
- No `prior` kwarg on `claim(...)`. If the conclusion is isolated (no
  upstream conclusions and no weak points → no `deduction(...)` targets it)
  it becomes a leaf; its prior goes in `priors.py`, sourced from the Phase 3
  per-conclusion `prior_probability`.
- `refs=` is the only legitimate place for paper-rooted location pointers;
  see §1a.
- Every conclusion is exported in `__init__.py`'s `__all__`.

### 1a. The `refs` metadata field

`refs` is the structured location-pointer metadata for any `claim(...)`. It
is an immutable tuple (or `None` / absent when nothing applies) of dicts.
**Only three `type` values are allowed**, mirroring the original step-3
`<ref type="...">` whitelist:

| `type`     | What it points to                              | Required key        |
|------------|------------------------------------------------|---------------------|
| `figure`   | A figure or table inside the paper             | `id` (e.g. `"Fig. 3"`, `"Table I"`) |
| `equation` | An equation referenced by number               | `id` (e.g. `"Eq. (5)"`) |
| `citation` | An external bibliographic reference            | `key` (matching `references.json`) |

Any other `type` is forbidden. In particular, **section, appendix, theorem,
lemma, paragraph, and footnote pointers are not legitimate `refs` entries
and must not appear anywhere in the package** — neither in `refs`, nor in
any prose body. If a claim's content is rooted in a section or appendix, the
content has to be inlined into the body itself; the location is recorded in
`mapping_audit.md` only, not in `refs`.

`refs` is metadata; it does **not** absolve the body of self-containment.
The body must still inline what the figure shows, what the equation states,
and what the cited result claims. `refs` is a structured pointer for audit
and rendering, not a substitute for substance.

## 2. Weak Points → `claim(...)` + `priors.py`

Every Phase 3 weak point produces one `claim(...)` call **and** one
`priors.py` entry:

```python
# in paper_<key>.py (or wherever the conclusion module lives)
<weak_label> = claim(
    r"<self-contained scientific statement of the weak-point claim>",   # use r"..." when the body contains LaTeX
    claim_kind="weak_point",
    source_paper="<reference_key>",
    provenance_source="paper_extract",
    weak_types=("<primary_pattern>", "<secondary_pattern>"),  # 1–3 of the 9 patterns
    p1=<float>,
    p2=<float>,
    refs=(                                             # optional, see §1a
        {"type": "figure", "id": "Fig. 4"},
        {"type": "equation", "id": "Eq. (12)"},
    ),
)
```

```python
# in priors.py
PRIORS = {
    <weak_label>: (<prior_probability>, "<one-line justification + TODO:review>"),
    ...
}
```

Rules:

- The weak-point body follows the same self-containment rule as a
  conclusion. The audit text from Phase 3 (`weakness_reason`,
  `failure_mode`) is **not** part of the claim body — it goes into
  `mapping_audit.md`.
- `weak_types` carries 1–3 keys from the nine argument patterns:
  `measurement`, `causal`, `model`, `statistical`, `generalization`,
  `comparative`, `formal`, `computational`, `external`. The first key is
  the dominant pattern. No invented keys.
- `p1` (sufficiency) and `p2` (necessity) come straight from Phase 3's
  reviewer calibration. Stored as metadata; BP does not consume them, but
  reviewers do.
- The `priors.py` value is `(prior_probability, justification)`. Cap the
  prior at 0.9 — no claim is absolutely certain. Lower bound 0.001
  (Cromwell). The justification ends with `TODO:review` so a downstream
  reviewer can grep for unfinalized priors.
- Each weak-point label is also a valid Gaia QID, e.g.
  `liu2015_c1_wp_static_screening`. Use a stable suffix per finding; do not
  rely solely on the Phase 3 P-id (`P1`, `P2`) since those are ephemeral
  audit ids.

### 2a. Weak point ↔ one conclusion (strict)

Every weak point is bound to **exactly one** conclusion — the conclusion
whose derivation it threatens, exactly as the source review schema
(`<premise conclusion_id="...">`) prescribes. The weak-point label is
`<key>_c<id>_wp_<suffix>` where `<id>` is **the** target conclusion's id;
the leaf claim appears as a premise in **only that conclusion's**
`deduction(...)` and nowhere else.

If a single scientific uncertainty appears to threaten multiple
conclusions, do not flatten it across deductions:

- **Cross-conclusion propagation goes through the logic graph.** If C2's
  weak point W1 also undermines C4 because C4 derives from C2, the doubt
  reaches C4 by `W1 → C2 → C4` through the deduction chain (C2 appears as
  a premise in C4's deduction). No duplication of W1 is needed; BP handles
  the propagation correctly.
- **For independent conclusions sharing a foundational assumption**
  (no logic-graph edge connects them), bind the weak point to the
  conclusion whose failure mode is most catastrophic; tie-break by smaller
  id. Record the BP-invisible effect on the other conclusions in
  `mapping_audit.md` (`also_threatens` column on the weak-point row, audit
  text under "Metadata gaps and rationale" if needed). Do not add the weak
  point to the other conclusions' deductions; doing so would double-count
  the same uncertainty as if it were independent evidence.
- **No copy-pasting of the body.** Splitting one uncertainty into N
  near-duplicate weak-point claims with the same body but different
  conclusion ids creates BP-independent leaves whose priors should be
  perfectly correlated — BP cannot represent that correlation, so the
  conclusion beliefs would be biased. Keep one weak-point claim per
  finding.

## 3. Reasoning Chain → `deduction(...)`

For each conclusion that has at least one upstream conclusion **or** at least
one weak point, emit exactly one `deduction(...)`:

```python
deduction(
    [<upstream_conclusion_label_1>, ..., <weak_point_label_1>, <weak_point_label_2>, ...],
    <conclusion_label>,
    reason=r"""
1. <Phase 2 step 1 text>.
2. <Phase 2 step 2 text>.
3. ...
""".strip(),
    prior=0.95,
)
```

Rules:

- The premises list is the **union** of **direct** upstream conclusions
  (from Phase 1's logic graph — only conclusions connected by an edge that
  ends at this conclusion; transitive ancestors are *not* listed) and
  weak-point claims scoped to this conclusion. A weak point appears in
  **only one** deduction's premises — the deduction of the conclusion it
  threatens (see §2a). Cross-conclusion uncertainty propagates through the
  upstream-conclusion premises, not by re-attaching the weak point or by
  flattening transitive ancestors.
- `reason=` is the conclusion's full Phase 2 reasoning chain, formatted as a
  numbered Markdown list. Preserve the topological order of steps. Every
  symbol introduced in `reason=` must already be defined inside the prose;
  no `Eq. (X)` or `Section II` pointers (Phase 2 already enforces this).
- External citations inside `reason=` (and inside any `claim(...)` body) use
  the `[@key]` form, where `key` matches an entry in `references.json`.
  Numeric paper-style citations like `[33]`, `[Smith20]`, or `Ref. 5` are
  **not** allowed in prose — convert at write time. If a `references.json`
  key cannot be derived (incomplete bibliography), record the gap in
  `mapping_audit.md` and emit `@unknown_<n>` (bare, **no brackets**) as a
  placeholder for the reviewer to resolve. The bracketed `[@key]` form is
  Gaia's *strict* reference syntax and `gaia compile` rejects unresolvable
  strict refs; the bare `@key` form is opportunistic and compiles even if
  the key has no `references.json` entry.
- **Prior is warrant strength, not posterior.** The `prior=X` on a
  `deduction(...)` is the **warrant strength of the inference itself** —
  given the premises, how reliably the chain propagates belief to the
  conclusion. It is **not** the reviewer's overall judgment of how likely
  the conclusion is to hold (that is `review_prior`, stored as metadata
  on the conclusion `claim(...)` — see §1a). Pipeline B (XML→LKM)
  effectively defaults all warrants to 0.95 because no
  `conditional_probability` attribute is present in step-3 output;
  paper-to-gaia is more granular by letting the agent calibrate the
  warrant per chain.
- **Warrant calibration.** Default 0.95. Adjust by these rules:
  - **+0.02 to +0.04** when a Phase 3 highlight specifically underwrites
    a step in this chain (independent cross-validation, formal proof of
    an otherwise-assumed step). Cap at 0.99.
  - **−0.05 to −0.10** for each explicit logical gap Phase 2 had to flag
    ("the authors assert without derivation that ..."). Floor at 0.80.
  - When a chain has both highlights and gaps, apply both adjustments
    additively from the 0.95 baseline; record each adjustment with its
    rationale in `mapping_audit.md`.
- Always `deduction`, regardless of whether the paper's argument is
  experimental, theoretical, or computational — the rhetorical mode is
  captured by the prose in `reason=`, not by the operator kind.
- A conclusion with **no** upstream conclusions and **no** weak points has
  no `deduction(...)`; it is a leaf claim and its prior goes in `priors.py`
  using the Phase 3 per-conclusion `prior_probability`.

## 4. Highlights → Audit Only

A Phase 3 highlight does **not** become a Gaia DSL node. It is recorded in
`mapping_audit.md` and may inform two emission decisions:

- The `deduction(...)` `prior=` for the conclusion the highlight underwrites
  (raise toward 0.99 when the highlight specifically addresses a derivation
  step that would otherwise be doubtful).
- The justification text in `priors.py` for any weak-point claim whose
  `failure_mode` is preempted by the highlight's `credit` text. The numeric
  prior need not change; the justification can note "highlight H_x preempts
  failure mode" so a reviewer sees the offset.

A `support(...)` operator is **not** the right encoding for a highlight: a
highlight is a quality property of the derivation, not a separate piece of
upstream evidence with its own claim text.

## 5. Motivations and Open Questions → `question(...)`

Phase 1 surfaces a paper-level motivation block and (optionally) a paper-level
open-question block. To stay aligned with the canonical XML→LKM ingestion
path (which maps `<problem>` from `select_conclusion.xml` to a
`LocalVariableNode(type="question")`), paper-to-gaia emits the motivation as
a Gaia `question(...)` node by default:

```python
<key>_problem = question(
    r"<self-contained motivation text — pre-paper problem state>",
    source_paper="<reference_key>",
    provenance_source="paper_extract",
)
```

Rules:

- Label format `<key>_problem` (single fixed suffix; there is one motivation
  block per paper).
- The motivation body is itself a self-contained scientific narrative —
  apply the same self-containment rules as for `claim(...)` bodies.
- `<key>_problem` is exported in `__init__.py`'s `__all__` (matching pipeline
  B, where the problem variable is `visibility="public"`).
- No `prior` kwarg on `question(...)`; questions do not carry probabilities
  in Gaia.
- Open questions (Phase 1's open-question block, the post-paper unresolved
  issues) remain audit-only **unless** the user explicitly asks to emit
  them. If emitted, format is `<key>_open_question_<n> = question(...)` and
  these labels also enter `__all__`. Pipeline B does not extract open
  questions, so this is a paper-to-gaia-specific extension.

## 6. Paper Metadata and External Citations → `references.json`

Extract the paper's bibliographic metadata and emit one CSL-JSON record. Key
format: `<firstAuthorSurname><year>` (e.g., `Liu2015`); collide-handle by
appending lowercase suffixes (`Liu2015a`, `Liu2015b`).

The paper itself cites prior work numerically (`[1]`, `[2]`, `Ref. 5`, etc.).
When external citations are reused inside this package (in claim bodies, in
`deduction(...)` `reason=` prose, in `refs={"type": "citation", ...}`
metadata), they must be converted to `[@key]` / `key` form using the same
key convention as above:

- For each cited work the agent retains in the package, parse the
  bibliography section of the paper Markdown for first-author surname plus
  year, and use `<Surname><Year>` as the key.
- Add a CSL-JSON record under that key to `references.json` whenever the
  paper Markdown carries enough metadata. Include only the fields actually
  present in the paper; do not invent DOIs or journal names.
- If the paper Markdown does not list the cited work clearly enough to mint
  a key (truncated bibliography, "et al." with no year), emit the citation
  as `@unknown_<n>` (bare, **no brackets**; bracketed form fails
  `gaia compile`) and add a row to `mapping_audit.md` under "Metadata
  gaps and rationale" listing the original numeric label and what the
  reviewer would need to resolve.

```json
{
  "Liu2015": {
    "type": "article-journal",
    "title": "...",
    "DOI": "10.1103/...",
    "container-title": "Physical Review B",
    "issued": {"date-parts": [[2015]]},
    "author": [
      {"family": "Liu", "given": "Zhao"},
      ...
    ]
  }
}
```

The `source_paper` kwarg on every claim must be the literal key string used in
`references.json` (without the `[@...]` wrapper). Cite from prose with
`[@Liu2015]` if needed.

## 7. Module Placement

Single-paper packages have a single source-paper module. The layout is:

- `src/<import_name>/paper_<key>.py` — every `claim(...)`, `deduction(...)`,
  and (if requested) `question(...)` for this paper.
- `src/<import_name>/priors.py` — leaf-claim priors (weak points + any
  isolated conclusions).
- `src/<import_name>/__init__.py` — `from .paper_<key> import *` and an
  `__all__` listing every conclusion label.

`cross_paper.py` is omitted for single-paper packages — there is no
cross-paper relation to record. If the user later merges this package into a
multi-paper package, the merge step adds it.

## 8. Label Naming Discipline

Labels must be valid Python identifiers and stable enough that audit
references survive minor edits:

- `<paper_key>_c<conclusion_id>_<short_semantic_suffix>` for conclusions.
- `<paper_key>_c<conclusion_id>_wp_<short_semantic_suffix>` for weak points
  (the suffix derived from the weak point's title or body).
- All lowercase, underscores only, ASCII. Strip diacritics.
- The semantic suffix should be 1–4 tokens, taken from the conclusion's or
  weak point's title rather than its full body, so labels stay short.

## 9. What This Contract Does NOT Cover

- The full shape of `pyproject.toml` — see `package-skeleton.md` and verify
  with `gaia compile`.
- BP interpretation, weakness analysis, or rendering — handled by the caller
  after `gaia infer`.
- Multi-paper merges — out of scope.
- The Gaia DSL grammar itself — governed by the installed Gaia library.
