# LKM-Explorer SOP

Use this SOP as the **single maintained workflow** when the user asks to build,
extend, audit, or refine a Gaia knowledge package from LKM content. There is no
separate expansion SOP: support search and open-question/conflict search are two
channels inside this SOP.

The package shape referenced below is owned by upstream `SiliconEinstein/Gaia`
(see `docs/for-users/language-reference.md` for DSL primitives and package
layout, `docs/for-users/quick-start.md` for the end-to-end workflow).
LKM-driven exploration and LKM-only mapping rules are owned by
[`$lkm-explorer`](../../lkm-explorer/).

## Primary Path

```text
user request
  -> $orchestrator reads this SOP
  -> $lkm-api retrieves raw match/evidence payloads
  -> cold start: user selects one chain-backed root claim
  -> $lkm-explorer maps accepted payloads to Gaia DSL
  -> Gaia quality gates produce .gaia/ir.json
  -> later rounds expand from the cold-start root frontier
```

`$evidence-subgraph` is not part of this path. It is a separate graph-only branch
for users who explicitly ask for a closure-chain/evidence graph.

## Environment Preflight

Before writing or validating Gaia package source, check that Gaia is available:

```bash
gaia --help
python -c "import gaia"
```

If either check fails, stop before editing package files and ask the user to
install or activate Gaia following <https://github.com/SiliconEinstein/Gaia>.
Do not add a project-local install recipe unless the user explicitly asks.

## Package Layout

The canonical artifact is a single growing `<domain>-gaia/` package,
matching the upstream Mendel/Galileo two-module layout:

```text
<domain>-gaia/
├── pyproject.toml
├── references.json
├── src/<import>/
│   ├── __init__.py
│   └── priors.py
└── .gaia/
    ├── ir.json
    ├── beliefs.json
    └── inquiry/
```

All DSL emissions (`claim` / `derive` / `equal` / `contradict` /
`exclusive` / `observe` / `note` / `question`) go in `__init__.py`. Leaf
priors (`register_prior(...)`) go in `priors.py`. There is no per-paper
`paper_<key>.py` sibling — that pattern is not in the upstream shipping
walkthroughs. All work after cold start operates on this same package
unless the user explicitly asks for a fork or fresh package.

## Stage 1 — Cold Start

Use this stage when no package exists yet or the user asks for a fresh package.

1. Read `$lkm-api/SKILL.md`.
2. Run the Environment Preflight.
3. Run a field-specific LKM match query. Use BM25-like keyword/anchor-phrase
   queries. Raw JSON lives in the agent's scratch for the run; it is not
   committed into the package.
4. Fetch evidence for promising distinct candidates.
5. For cold-start root selection, only offer candidates with `total_chains > 0`.
6. Record no-chain LKM source claims as scratch leads, but do not offer them
   as cold-start roots.
7. When multiple roots are plausible, stop for a mandatory user-selection
   checkpoint. Do not pre-select.
8. After user selection, read `$lkm-explorer/SKILL.md` and run its
   progressive five-step workflow in batch mode.
9. Run the Quality Gates. Record the user-selected root claim as the
   expansion seed; this root claim is the only default starting point for
   later graph growth.

## Stage 2 — Root-Claim Frontier Expansion

Use this stage for all later graph growth, including requests phrased as
"continue expanding", "find supports", "find contradictions", "explore open
questions", or "grow the graph".

### Frontier Rule

Round 0 frontier is the cold-start root claim selected by the user.

After a completed expansion round, the next frontier is every newly admitted,
LKM-grounded **science claim** added in that round. Do not expand generated
helper claims from `derive(...)` (warrant or factor-derived) or
`contradict(...)`, and do not re-expand claims already visited.

Track visited frontier claims in the agent's scratch for the run.

If a round adds no new science claims, stop and report that the current
frontier is exhausted.

### Per-Claim Search Contract

For each frontier claim, extract a scope tuple before searching:

```text
system/material | quantity/effect | asserted value/sign/direction |
method/model/measurement | theory/experiment/computation role |
conditions/regime | source paper/LKM id
```

Run both channels for **every** frontier claim:

- Support channel: at least **2 distinct LKM match queries**, each with
  `top_k=10`.
- Open-question/conflict channel: at least **5 distinct LKM match queries**, each
  with `top_k=10`.

The query count and `top_k=10` are different axes: the former is query
diversity, the latter is candidates returned per query. Do not reduce either
without surfacing the reason in the hand-off report.

### Support Channel

Goal: find LKM-grounded content that can directly support the frontier claim in
real Gaia DSL.

- Fetch evidence for promising support candidates whenever possible.
- Chain-backed candidates may add `claim(...)` nodes and factor-derived
  `derive(...)` strategies.
- Clear no-chain LKM source claims may enter after cold start as leaf/source
  `claim(...)` nodes.
- A support edge may be a scientific-review judgment rather than an LKM
  `gfac_*` factor, but both endpoints must be LKM-grounded Gaia claims.
- Accepted support uses real Gaia DSL (canonical v0.5 form — `derive(...)`
  replaces the legacy `support(...)` strategy; see
  `docs/for-users/language-reference.md` "Notable migration rows"):

```python
derive(target_claim, given=[upstream_claim],
       rationale="<why upstream supports target; warrant-strength intent: strong/moderate/weak>",
       label="<upstream_supports_target>")
```

or, when several upstream claims only support the target jointly:

```python
derive(target_claim, given=[u1, u2],
       rationale="<joint support rationale; warrant-strength intent>",
       label="<u1_u2_supports_target>")
```

The engine `derive(...)` signature accepts only `{given, background,
rationale, label}` — there is no `metadata=` / `warrant_prior` kwarg, so
warrant-strength intent lives in the `rationale=` prose.

Allow multiple accepted support candidates into the same iteration when they
satisfy the mapping contract. If no candidate satisfies the standard,
surface `support_not_found` in the hand-off report with the queries
checked and rejection rationales.

### Open-Question / Conflict Channel

Goal: find LKM-grounded content that raises a scientifically meaningful open
question against or around the frontier claim.

Priority order:

1. Theory-vs-experiment or experiment-vs-theory. If the frontier claim is
   theoretical/computational, first search for experimental observations or
   measurements that disagree with, qualify, or fail to confirm it. If the
   frontier claim is experimental, first search for theoretical/computational
   results that disagree with or reinterpret it.
2. Computation-vs-experiment or measurement-vs-model comparisons not covered by
   the first category.
3. Same-system different-method conflicts.
4. Approximation, boundary-condition, regime, dimensionality, temperature,
   disorder, sample-quality, or protocol conflicts.
5. Broader adjacent tensions that may become useful hypotheses but are not yet
   promotable.

For every plausible candidate pair, write the best discriminating open question
before deciding whether it becomes executable DSL. Useful open questions should
be added to `.gaia/inquiry/` as hypotheses when they may guide later rounds.

Accepted contradictions follow the mapping contract's open-question-first
standard and use direct Gaia DSL:

```python
<side_a>_vs_<side_b>[_<quantity_or_regime>] = contradict(
    A,
    B,
    rationale="<why A and B are adjudicably conflicting> | open_problem: <question>",
    label="<side_a>_vs_<side_b>[_<quantity_or_regime>]",
)
```

The engine `contradict(...)` signature accepts only
`{background, rationale, label}` — no `metadata=` / `warrant_prior` /
`prior=` kwarg. Warrant-strength intent ("clear" vs. "less crisp") lives
in the `rationale=` prose alongside the `open_problem:` clause.

If no candidate satisfies the hypothesis or contradiction standards,
surface `conflict_not_found` in the hand-off report with the queries
checked and rejection rationales.

### Candidate Tracking

Track every candidate pair in the agent's scratch for the run, with:

- frontier claim label and LKM id when available,
- channel: `support` or `open_question_conflict`,
- query text and `top_k`,
- candidate LKM id and evidence status (`chain-backed`, `lkm_no_chain`, or
  `search_lead`),
- scope comparison across system, quantity, method/model, theory/experiment
  role, regime, and conditions,
- proposed Gaia action: `claim`, `derive` (covers both factor-derived
  deductions and warrant supports), `accepted_contradiction`,
  `hypothesis_only`, `dismissed`, or `not_found`,
- rationale and next action.

After candidate classification, run `$lkm-explorer` progressive workflow in
refresh mode for accepted package changes.

## Stage 3 — Duplicate And Prior Maintenance

This is not a separate workflow; it is the maintenance step applied whenever
quality gates or review identify issues.

1. Run `gaia inquiry review --strict .`.
2. Inspect duplicate diagnostics and semantic near-duplicates.
3. Classify each pair:
   - exact duplicate -> merge,
   - same-paper helper restatement -> merge when safe,
   - independent same proposition -> keep both and add `equal(...)`,
   - different scope/material/method/condition -> keep distinct,
   - ambiguous -> default to keep distinct.
4. Fill leaf priors surfaced by `gaia build check --hole .` via
   `gaia author register-prior --file priors.py`.
5. Re-run the Quality Gates.

## Quality Gates

Run before accepting any package state:

```bash
gaia build compile .
gaia build check --brief .
gaia build check --hole .
gaia run infer .
gaia inquiry review --strict .
```

If holes appear, fill them via `gaia author register-prior` and rerun. If
review reports duplicates, unreviewed warrants, or unresolved
obligations/hypotheses, resolve them and rerun.

## Source-Of-Truth Invariants

- Raw LKM JSON and `data.papers` are the source of truth for science-facing
  Gaia claims, factors, provenance, and references.
- Do not use external PDFs, paper text, web summaries, or synthetic bridge
  claims as evidence unless the user explicitly changes the rule.
- For cold-start Gaia packages, the selected root must be chain-backed
  (`total_chains > 0`).
- After cold start, LKM source claims with `total_chains = 0` may enter
  `$lkm-explorer` as leaf/source claims when content and provenance are clear.
- Iterative graph growth after cold start follows root-claim frontier expansion
  from the user-selected root claim. Do not substitute a graph-centrality,
  belief-based, contradiction-side, or arbitrary frontier policy unless the user
  explicitly asks for a different workflow.
- `.gaia/inquiry/` preserves prior obligation/hypothesis decisions across
  rounds.
- Open-question-first contradiction handling is canonical in
  `$lkm-explorer/references/mapping-contract.md` §4.

## Delegation

For complex or separable LKM->Gaia work, use the audited delegation pattern in
`audited-delegation.md`. Delegation must follow this single SOP, force subagents
to load `$lkm-explorer/SKILL.md`, and never removes the orchestrator's
responsibility to audit returned artifacts against the relevant skill contract.
