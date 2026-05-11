---
name: paper-to-gaia
description: Convert a single academic paper (Markdown) directly into a standalone Gaia knowledge package. The agent reads the paper itself and performs the four phases — extract conclusions, reconstruct reasoning chains, audit weak points and highlights, and emit the package — all in-context, producing Gaia DSL source files (`claim`, `deduction`, `priors`) instead of XML. Use this skill whenever the user asks to "formalize a paper into Gaia", "produce a Gaia package from this paper", "turn this paper into a knowledge package", or any variant where the upstream is a single paper and the requested output is Gaia DSL or a Gaia knowledge package — even if the user does not explicitly mention Gaia DSL syntax.
---

# Paper-to-Gaia

## Mission

Read a single academic paper in Markdown form, audit it as a scientific reasoning
reviewer would, and emit a standalone Gaia knowledge package that compiles via
`gaia compile` and propagates beliefs via `gaia infer`. The agent running this
skill does the analytical work itself; it does not orchestrate a separate
extraction pipeline and does not produce intermediate XML artifacts.

A paper-to-Gaia package is structurally identical to a package produced by
`lkm-to-gaia`, but its provenance is a single paper rather than LKM evidence
chains. Every `claim(...)` carries `provenance_source="paper_extract"` and
`source_paper="<reference_key>"` so the two provenance routes can coexist if a
package is later refreshed from LKM data.

```
paper.md
  |
  v
$paper-to-gaia
  (standalone Gaia package source for that paper)
```

## Output Mode

This skill operates in **single-paper batch mode** only:

- Input: one paper `.md` file plus a desired package name (or one inferred from
  the paper's first author + year).
- Output: a fresh standalone `<name>-gaia/` package directory.

Refresh / multi-paper batches are out of scope; if the user wants to merge a
paper into an existing multi-paper package, the workflow is to produce the
single-paper package here and then hand it off to a downstream merge step.

## Progressive Workflow

At the start of each `$paper-to-gaia` run, create a session todo list with the
four items below. Mark only Phase 1 as in progress. Do not load later phase
documents until the current phase is complete; each later phase depends on the
working notes produced by the earlier phases.

1. **Extract conclusions, motivation, open questions, and the cross-conclusion
   logic graph** — load
   [`references/phase-1-extract-conclusions.md`](references/phase-1-extract-conclusions.md).
2. **Reconstruct each conclusion's reasoning chain** — load
   [`references/phase-2-build-reasoning-chain.md`](references/phase-2-build-reasoning-chain.md).
3. **Audit weak points and highlights, calibrate probabilities** — load
   [`references/phase-3-review-weak-points.md`](references/phase-3-review-weak-points.md).
4. **Emit the Gaia package and audit log** — load
   [`references/phase-4-emit-package.md`](references/phase-4-emit-package.md).

After each phase, immediately mark the corresponding todo complete, mark the
next one in progress, and only then load the next phase document. Phases 1–3
produce structured working notes (held in the agent's scratch, not on disk).
Phase 4 is the only phase that writes files.

The four-phase split is mental scaffolding, not a contract with the user. The
agent must treat the phases as cumulative — the package emitted in Phase 4 must
reflect the conclusions, reasoning chains, weak points, and highlights surfaced
in Phases 1–3 as a single coherent body of work, not as independent passes.

## Suitability Gate

Before Phase 1 begins, decide whether the paper is amenable to formalization.
Skip with a short note if:

- The paper is a review, survey, or perspective without original results.
- The paper has no identifiable structured contributions (no derivations, no
  measurements, no method introductions).
- The Markdown is corrupted, truncated, or contains only abstract/metadata.

In any of these cases, do not emit a Gaia package. Write a single
`<package_name>.skip.md` next to the input that records the reason in one
paragraph. Do not invent contributions to fill the gap.

## Non-Negotiable Invariants

- **Self-contained `claim(...)` text.** The string body of every `claim(...)`
  must read as a first-class scientific proposition independent of the paper.
  This is the same rule the legacy step 4 prompt enforced — here it is enforced
  at the moment the claim is written, not as a post-hoc rewrite. Setup,
  symbols, regimes, and inlined figure/table content live inside the claim
  string itself; structural pointers ("Eq. (3)", "Fig. 4", "Section II") are
  forbidden inside the claim body.
- **Paper Markdown is the only source of truth.** Do not introduce external
  knowledge, repair missing arguments, or upgrade speculative claims. If a
  symbol is undefined in the paper, leave it undefined and note it in
  `mapping_audit.md`.
- **Two claim kinds only.** A `claim(...)` is either a step-1 root conclusion
  (`claim_kind="conclusion"`, exported in `__all__`) or a step-3 weak point
  used as a leaf premise (`claim_kind="weak_point"`, listed in `priors.py`).
  A reasoning step is not a claim; it is text that lives inside a
  `deduction(...)` `reason=` field.
- **One epistemic question per conclusion.** Each `claim_kind="conclusion"`
  body answers exactly one citable question — what is the new bound /
  relation / procedure / measured value / comparison outcome / causal
  estimate / generalization result / classification / mechanism — not
  several. A paragraph that bundles a procedure, the value it produced,
  and the benchmark it passed is three conclusions, not one. The split is
  field-agnostic; the same discipline applies to a theorem, a clinical
  endpoint, an ML benchmark, a causal estimate, or a physical measurement.
  See `phase-1-extract-conclusions.md` for the split test and common
  under-splitting traps.
- **One deduction per derived conclusion.** Each conclusion that has at least
  one upstream conclusion or one weak point becomes the conclusion of exactly
  one `deduction([premises], conclusion, reason=..., prior=...)`. Premises are
  the union of the conclusion's upstream conclusions (from the cross-conclusion
  logic graph) and its weak-point claims.
- **Highlights are audit-only.** Step-3 highlights characterize *why* a
  conclusion is unusually solid, but they do not enter the executable DSL —
  Gaia's BP semantics already handle credit through priors and deduction
  warrant. Highlights are recorded in `mapping_audit.md` and referenced when
  setting deduction warrant priors.
- **Probability calibration on `priors.py`.** Leaf-claim priors come from
  step-3 calibrations (`prior_probability` for the weak point, capped at 0.9).
  Each justification ends with `TODO:review`. Do not invent priors that
  contradict the reviewer's calibration in your working notes.
- **Provenance metadata is mandatory.** Every `claim(...)` carries
  `source_paper="<key>"` and `provenance_source="paper_extract"`. The
  reference key matches an entry in `references.json`.
- **Every emitted node is audited and logged.** Phase 4 writes
  `mapping_audit.md` rows for every conclusion, deduction, weak-point
  claim, and highlight, **and** appends one structured event per
  emission to `artifacts/paper-extract/graph_growth_log.jsonl` following
  the schema laid out in `package-skeleton.md`, which mirrors the
  lkm-to-gaia ecosystem's `timeline-log-contract.md`. The audit log lets
  a reviewer reconstruct each Gaia node's provenance and reviewer
  judgment; the JSONL log lets a frontend replay the Gaia starmap from
  `t=0` without parsing Python source. (paper-to-gaia uses
  `artifacts/paper-extract/` as the audit-dir name to truthfully reflect
  the upstream — there is no LKM involvement here. The schema content,
  not the directory name, is what makes it ecosystem-compatible: any
  tool that finds `graph_growth_log.jsonl` by glob can read both
  paper-to-gaia and lkm-to-gaia outputs.)

## Responsibility Boundaries

- This skill owns the four analytical passes and the Gaia package emission.
- It does not run `gaia compile` / `gaia infer` itself; the caller runs those
  quality gates after emission. Surfaced compile errors come back as Phase 4
  follow-up obligations, not as a built-in step.
- It does not orchestrate the existing `paper-extract` Python pipeline. The
  Python pipeline is a parallel route from paper to XML; this skill is the
  direct route from paper to Gaia.
- Multi-paper merges, cross-paper contradictions, and downstream rendering are
  separate concerns handled by other tools.

## Reference Files

- [`references/mapping-contract.md`](references/mapping-contract.md) — how each
  paper element maps to a Gaia DSL node, and the rules each emission must
  follow.
- [`references/package-skeleton.md`](references/package-skeleton.md) —
  single-paper package layout, naming conventions, and file templates.
- [`references/phase-1-extract-conclusions.md`](references/phase-1-extract-conclusions.md)
  — conclusions, motivation, open questions, cross-conclusion logic graph.
- [`references/phase-2-build-reasoning-chain.md`](references/phase-2-build-reasoning-chain.md)
  — per-conclusion reasoning reconstruction.
- [`references/phase-3-review-weak-points.md`](references/phase-3-review-weak-points.md)
  — weak-point and highlight audit, with probability calibration.
- [`references/phase-4-emit-package.md`](references/phase-4-emit-package.md) —
  composing Phase 1–3 working notes into Gaia DSL package files.
