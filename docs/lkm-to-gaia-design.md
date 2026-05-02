# `lkm-to-gaia` skill — design note

Status: design v1 (2026-05-02). v0 had a boundary error between `$gaia-lang` and
`gaia-discovery v0.x`; v1 corrects it. This note is the prose record of the
decisions that shape `skills/lkm-to-gaia/`. The canonical machine-checkable
contracts live in the `SKILL.md` and the four reference files under
`skills/lkm-to-gaia/references/`.

## Purpose

Convert the artefacts produced by `$evidence-subgraph` (the run-folder per the
[`evidence-graph-run/2.0`](../skills/evidence-subgraph/references/run-folder-output-contract.md)
contract) directly into Gaia DSL — either:

- a fresh, standalone Gaia knowledge package (mode `batch`), or
- a fragment that merges into an existing `plan.gaia.py` (mode `incremental`).

Both modes emit **`$gaia-lang`-conformant source** — the language consumed by
`gaia compile`. This is the single voice. `gaia-discovery v0.x` is a downstream
exploration framework; if its `plan.gaia.py` consumer wants to add the discovery-
specific Beta `[a, b]` priors and `metadata.prior_justification` annotations to
imported claims, that bridge lives in the `gaia-discovery` `/lkm-evidence`
wrapper, not here.

## The `$gaia-lang` vs `gaia-discovery` boundary

This is where v0 of the design got it wrong, so it's worth being explicit. The
two surfaces look similar but have **different signatures** for the same
construct:

| Construct | `$gaia-lang` (what `gaia compile` consumes) | `gaia-discovery v0.x` (the exploration framework's `claim()` hard constraint) |
|---|---|---|
| `claim()` signature | `claim(content, *, title=None, background=None, parameters=None, provenance=None, **metadata)` — **no `prior` kwarg** | `claim(content, prior=[a, b], metadata={"prior_justification": "..."}, ...)` — Beta priors inline, justification mandatory |
| Leaf priors | `priors.py`: `PRIORS = {leaf_claim: (0.9, "Justification.")}` — **float, not Beta** | inline on every `claim(...)` call as Beta `[a, b]` |
| Strategy / operator warrant prior | `prior: float`, e.g. `support([...], conclusion, reason="...", prior=0.85)`, Cromwell `[1e-3, 0.999]` | (gaia-discovery follows gaia-lang here) |
| Strategy call style | positional-first: `deduction([p1, p2], conclusion, reason="...", prior=0.85)` | (gaia-discovery follows gaia-lang here) |
| Submodule `__all__` | "**Do NOT define `__all__` in submodules**"; only in `__init__.py` | (gaia-discovery follows gaia-lang here) |
| `noisy_and` | deprecated; canonical replacement is `support()` | (lkm-to-gaia overrides — see Decision 1 below) |

This skill chooses **gaia-lang as the single source of truth.** Both modes emit
gaia-lang shape. The `gaia-discovery` wrapper, when it ships, can post-process
the emitted fragment to add Beta-on-claim annotations if it wants to satisfy the
discovery framework's claim hard constraint — but the skill does not bake them
in.

## Where Beta `[a, b]` lives in this skill

Beta is still the internal currency of `prior_heuristic.mjs` — the "20 mass
units" intuition is useful for the auto-seeding heuristic (an experimental
observation is `[18, 2]` not `0.90` because `[18, 2]` also encodes evidence
weight). When the heuristic output flows to `dsl_emit.mjs`, it is collapsed to
the float mean `a / (a + b)` for emission. The Beta survives in:

- `imports.json` (incremental mode sidecar) — the original Beta + justification
  are written out so the gaia-discovery wrapper can re-inflate.
- `merge_audit.md` and `mapping_audit.md` — auditing logs preserve the original
  shape for reviewer reading.
- `priors.py` justification text — the heuristic tag and TODO marker carry the
  Beta shape mention so the reviewer can spot it.

## Design decisions (corrected)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Strategy default for every `gfac_*` factor | `deduction([p1, p2, ...], conclusion)` with no warrant prior | Explicit user choice. Overrides `$gaia-lang`'s `noisy_and → support` deprecation guidance: we treat the LKM-corpus vetting as a strict-correctness stamp, even though the gaia-lang "key test" (premises true ⇒ conclusion necessarily true?) would mark most empirical chains as `support`. The reviewer pass + `gaia infer` results catch any cases where this overstates certainty. |
| 2 | Scope per invocation | multi-root single package | Cross-root `equivalence` / `contradiction` / `induction` operators land in one `cross_paper.py`. |
| 3 | First deliverable | SKILL.md + 3 small primitive scripts | Mapping rules stay in markdown; mechanical correctness lives in tested primitives. |
| 4 | Output of `batch` mode | a `<name>-gaia/` directory ready for `gaia compile` | Mirrors `gaia init` output. |
| 5 | Output of `incremental` mode | a `$gaia-lang`-clean Python source fragment + `imports.json` sidecar | The host wrapper (gaia-discovery `/lkm-evidence`, when shipped) is responsible for any Beta-on-claim re-inflation it needs. |
| 6 | Shared-premise extraction | hybrid: auto-merge exact text + lineage `same paper, different version`; surface ambiguous semantic-equivalents as `merge_decisions.todo`; keep independent confirmations distinct + linked via `equivalence(...)` | Avoids BP double-counting (the user's stated concern) without erasing independent-confirmation information. |
| 7 | Cross-validation `confirm` polarity | narrow exception to "always deduction" → `support` + `support` + `induction(support_1, support_2, law)` | gaia-lang's canonical "two independent observations confirm one law" idiom. Built on `support`, not `deduction`. |
| 8 | Cross-validation `partial_disconfirm` polarity | `contradiction(a, b, ...)` + `# TODO:HUMAN-REVIEW` comment | Genuinely ambiguous; surface for judgement. |
| 9 | **Priors are floats in emitted source** (revised from v0) | `priors.py` carries `(float, justification)` per `$gaia-cli` §6; strategy / operator priors are `float` in `(1e-3, 0.999)`; `claim()` carries no `prior` kwarg | Aligns with `$gaia-lang` strict signature. v0 erroneously emitted Beta `[a, b]` inline on `claim()` (a gaia-discovery convention) and on warrants (no convention; just wrong). |
| 10 | References | auto-built CSL-JSON from `data.papers`, key `<firstAuthor><year>` deduped by suffix letters | Single source of truth. |
| 11 | DSL grammar documentation | **defer to `$gaia-lang`** — do not restate primitives, signatures, kwargs/positional rules, label grammar, Cromwell bounds, or import block here | Avoids silent drift when `$gaia-lang` evolves. The skill documents only what is unique to it: the LKM-artefact-to-DSL mapping policy and the share-extract algorithm. |

## Two-mode contract (one-line summary)

- `batch`: read run-folders → emit a complete `<name>-gaia/` directory.
- `incremental`: read run-folders + an existing `plan.gaia.py` path → emit a
  Python source fragment to append, plus `imports.json` describing what was
  added (and the original Beta priors so the host can re-inflate).

Both modes share the same primitives in `scripts/`. The mode flag changes only
the sink; everything upstream (load, dedup, emit) is identical.

## Out of scope (this delivery)

- The `gaia-discovery` `/lkm-evidence` slash-skill wrapper. Deferred. With the
  v1 boundary call (gaia-lang only on emit), the wrapper grows a Beta-inflation
  pass that reads `imports.json` and rewrites the imported `claim(...)` calls in
  `plan.gaia.py` to add `prior=[a, b]` and `metadata.prior_justification`. That
  pass is the wrapper's responsibility.
- A `--auto-dispatch` / `--no-dispatch` flag for marking imported deductions
  with `metadata.action`. Wrapper-level.
- Re-running `gaia infer` or interpreting BP results.
- Cosine / Jaccard similarity branch of the share-extract procedure (still on
  the doc; not yet wired in code).

## Why these decisions are not encoded as code in this delivery

The mapping rules (decisions 1, 6, 7, 8) are policy that we expect to refine as
real packages emerge. They live in markdown — `SKILL.md` and
`references/mapping-contract.md` — exactly where the existing four skills put
their policy. The primitives encode only the mechanics that are easy to get
subtly wrong by hand:

- `$gaia-lang` syntax (positional-first strategies, kwargs-only operators with
  paired `reason` + `prior: float`)
- Cromwell-bounded float priors
- Label uniqueness (the QID grammar `[a-z_][a-z0-9_]*`, with Python + DSL
  reserved-word avoidance)
- Schema validation against `evidence-graph-run/2.0`
- RFC 6901 pointer resolution

This split keeps the cost of changing policy low (edit markdown, no test churn)
while keeping the cost of mechanical bugs near zero (typed primitives, fixture
tests).
