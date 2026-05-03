---
name: orchestrator
description: Universal entry point for any LKM-driven request. Sequences the atomic skills in the `gaia-lkm-skills` family — `$lkm-api`, `$evidence-subgraph`, `$lkm-to-gaia`, `$gaia-render`, `$scholarly-synthesis` — into the iterative LKM↔gaia loop that builds and refines a `<domain>-gaia/` knowledge package across turns. Four turn shapes are supported end-to-end on the same package: cold-start build, extend, traverse and purge duplication, visualize. Open-problem / contradiction handling is not a discrete turn — it is built into Turns 1 and 2 via `$lkm-to-gaia`'s mandatory step 4 (hunt open problems — NEVER SKIP) inside the obligation-driven loop. Audit-trail continuity (`artifacts/lkm-discovery/{input/, merge_audit.md, dismissed/}`, `.gaia/inquiry/`) is preserved across turns so successive prompts grow the same package without losing prior verdicts. Includes a mandatory user-selection checkpoint between discovery and the build. Domain-agnostic: physics, chemistry, materials, biology, ML, climate, astrophysics, etc. Any agent handling an LKM-related user prompt should route through this skill first.
---

# Orchestrator (LKM ↔ Gaia loop)

## Role

This is the **single front door** for every LKM-driven request. The orchestrator inspects the user's intent, picks the matching turn shape, and sequences atomic skills to grow a `<domain>-gaia/` knowledge package across turns. It does **not** retrieve, draw, formalize, or write itself — it sequences siblings, gates the user-selection checkpoint, and preserves the audit trail.

The primary loop is **iterative**: the same `<domain>-gaia/` package is built cold, extended on follow-up prompts, traversed for duplication, and visualized — all on the same on-disk package. Open-problem / contradiction handling is **not** a separate user-driven turn shape; it is built into Turns 1 and 2 as `$lkm-to-gaia`'s mandatory step 4 (hunt open problems — NEVER SKIP) inside the obligation-driven loop, so every new claim is screened against the existing graph and against the rest of the same batch as it lands. Every turn writes to predictable audit-trail files so the next turn can pick up where the previous one left off without losing prior verdicts.

## Skill family catalog

The orchestrator sequences five atomic peers. One-line purpose each — full contracts in their own SKILL.md.

- **`$lkm-api`** — Bohrium LKM HTTP API client (match / evidence / variables verbs; `accessKey` auth; raw JSON pass-through).
- **`$evidence-subgraph`** — build / audit / render an evidence graph from LKM chain payloads (factor diamonds, three-class edge taxonomy, chain-bounded discipline).
- **`$lkm-to-gaia`** — convert LKM evidence-chain payloads into a Gaia DSL knowledge package (`<name>-gaia/` batch mode; Python-fragment incremental mode for plan.gaia.py hosts).
- **`$gaia-render`** — render a Gaia knowledge package or `plan.gaia.py` as a viewable artifact (graphviz / mermaid / static image), with BP-propagated beliefs as node shading / labels.
- **`$scholarly-synthesis`** — *future work, atomic surface only*: write a domain-vocabulary scholarly synthesis from an audited evidence graph + bibliographic metadata.

The orchestrator itself is implicit — it's this entry point.

## The `<domain>-gaia/` package — single growing artifact across turns

All four primary turn shapes operate on the **same on-disk package directory**. The package layout (per `$lkm-to-gaia`'s `references/package-skeleton.md`) is:

```
<domain>-gaia/
├── pyproject.toml
├── references.json                          ← CSL-JSON, built from data.papers
├── src/<import>/
│   ├── __init__.py                          ← re-exports + __all__ (selected roots)
│   ├── paper_<key>.py                       ← one module per paper (claims + deductions)
│   ├── cross_paper.py                       ← support / contradiction / equivalence / induction
│   └── priors.py                            ← PRIORS = {leaf_label: (float, "justification.")}
├── artifacts/lkm-discovery/                 ← audit trail (orchestrator-managed)
│   ├── input/                               ← raw LKM JSON: match_NN.json, evidence_<gcn>.json
│   ├── candidates.md                        ← user-selection short-list
│   ├── contradictions.md                    ← discovery flag — pairs that can't both be true
│   ├── equivalences.md                      ← discovery flag — pairs that may assert the same prop
│   ├── merge_audit.md                       ← every merge / equivalence / dismissal verdict
│   ├── merge_decisions.todo                 ← unresolved cases for user review
│   └── dismissed/                           ← rejected upstream conclusions, with reason
└── .gaia/                                   ← produced by `gaia compile` + `gaia infer`
    ├── ir.json
    ├── beliefs.json
    ├── inquiry/                             ← obligation list, hypothesis list, review state
    └── ...
```

**Audit-trail continuity is the invariant that makes the loop work.** On every turn after the cold-start, the orchestrator MUST read `artifacts/lkm-discovery/{merge_audit.md, dismissed/, merge_decisions.todo}` before doing new LKM queries, so prior verdicts are honoured (a pair already merged stays merged; a candidate already dismissed is not re-introduced silently). Same for `.gaia/inquiry/` — open obligations and hypotheses from prior turns drive the next iteration. The full inquiry verb surface used by the loop is `gaia inquiry obligation {add,list,close} --scope <QID>`, `gaia inquiry hypothesis {add,list,remove} --scope <QID>`, plus `focus` / `reject` / `review`; see `lkm-to-gaia/SKILL.md` §4 for usage details.

## Turn shapes

The four primary turn shapes are listed below in the order an agent typically encounters them within a session. Each turn shape lists: prompt example, atomic skills invoked (and order), key inputs / outputs, state writes, and per-turn success criterion.

A fresh agent reading this section should be able to sustain a multi-turn build-and-explore session against a single `<domain>-gaia/` package by matching each user prompt to one of these shapes and following the recipe.

**Open-problem / contradiction handling is not a separate turn shape.** It is built into Turns 1 (cold-start) and 2 (extend) as step 4 (hunt open problems — NEVER SKIP — research-worthy tensions including experiment vs theory, theory vs theory, coverage gaps, quantitative inconsistencies) of `$lkm-to-gaia`'s 8-step obligation-driven loop. Every new claim is screened against the existing graph and against the rest of the same batch as it is formalized; real tensions become `contradiction(...)` primitives (with `reason="... | new_question: ..."`) plus a paired `gaia inquiry hypothesis add "<open question>" --scope <namespace>::<op_label>` registration, apparent ones are logged to `artifacts/lkm-discovery/dismissed/` with reason, and under-determined ones keep their obligation / hypothesis entry until a future Turn-2 batch resolves them through the audit-trail-continuity re-batch mechanism.

### Turn 1 — Cold-start build

**Prompt example.** *"Find research results of unconventional superconductivity in K3C60 from LKM, then decompose into a Gaia graph."*

**Skills invoked, in order:**

1. **`$lkm-api`** — broad-topic discovery. Translate the user's prompt to one or more `POST /claims/match` queries (English typically maximises recall on scientific corpora; preserve the user's terminology and named entities). Vary queries (alternate names of the effect, formula-level vs concept-level synonyms) until the union of top-k results stops yielding new chain-backed candidates. Save raw JSON.
2. **`$lkm-api`** — chain-backed candidate filter. For each distinct candidate (deduped by claim id), `GET /claims/{id}/evidence` with `sort_by=comprehensive`. Keep only `total_chains > 0`.
3. **Discovery flag pass.** Best-effort scan over the full match response (chain-backed and chain-less — the latter still surface open questions). Emit two loose markdown files:
   - `contradictions.md` — pairs that **cannot simultaneously be true**. One row per pair with side-A / side-B brief, why-they-conflict, potential-open-problem flag. Cap at top 10. Empty case: write `(no pairs detected in this run)` so downstream skills detect it unambiguously.
   - `equivalences.md` — pairs that **appear to assert the same proposition**. One row per pair with shared-claim brief, why-might-be-equivalent, potentially-independent flag. Same cap and empty-case rule.

   Discovery only flags; deep classification (lineage, hypothesized cause, independence basis) is deferred to `$lkm-to-gaia`'s formalization stage.
4. **User-selection checkpoint (mandatory).** Present chain-backed candidates as a numbered short-list (3–8 entries; never more than 10), each one line: `[N] <system / setting> | <quantitative claim> | <paper author–year> | <one-line takeaway>`. Stop and ask the user to pick one (or to ask for more, or to refine the topic). Do not pre-select.

   The candidate list is itself a first-class deliverable: write to `candidates.md` so the choice is reproducible. In an autonomous-test harness where the user cannot be reached, stop after writing `candidates.md` and return — do not autonomously pick a root.
5. **`$lkm-api`** — pin chosen root, persist `data.papers`. Once the user picks (claim id supplied), re-fetch `evidence` if more than a few minutes have passed; confirm `total_chains > 0`; identify the root paper id; persist the relevant `data.papers` subset.
6. **`$lkm-to-gaia` (mode `batch`)** — formalize. Hand off raw evidence JSON paths + match JSON path + `contradictions.md` + `equivalences.md` + `candidates.md` + desired package name. The skill emits a `<name>-gaia/` directory with `pyproject.toml`, `src/<import>/{__init__.py, paper_<key>.py, cross_paper.py, priors.py}`, `references.json`, and copies the discovery files into `artifacts/lkm-discovery/{input/, contradictions.md, equivalences.md, candidates.md, merge_audit.md}`.

   Inside `$lkm-to-gaia`, the **8-step obligation-driven loop runs to convergence**: (1) bootstrap → (2) refine self-contained → (3) decompose compound claims → **(4) hunt open problems — MANDATORY, NEVER SKIP, on every new claim — research-worthy tensions including experiment vs theory, theory vs theory, coverage gaps, quantitative inconsistencies — emits `contradiction(A, B, ..., reason="... | new_question: ...")` primitives plus `gaia inquiry hypothesis add "<open question>" --scope <namespace>::<op_label>` for each** → (5) mark suspicions → (6) `gaia compile && gaia infer` → (7) review obligation list → (8) search supports → repeat until obligation list empty, hypothesis list investigated, 0 holes, 0 unreviewed warrants. Step 4 is the only place contradictions enter the package: real conflicts land as `contradiction(...)` primitives plus a paired hypothesis registration, apparent ones are dismissed to `artifacts/lkm-discovery/dismissed/` with reason, and under-determined ones keep an open obligation / hypothesis for a future turn. There is no separate user-driven verdict turn.

**State writes (cumulative, by end of turn):**

- `artifacts/lkm-discovery/input/` — raw LKM JSON (match + evidence per chain-backed candidate).
- `artifacts/lkm-discovery/{candidates.md, contradictions.md, equivalences.md, merge_audit.md, merge_decisions.todo, dismissed/}`.
- `src/<import>/{paper_*.py, cross_paper.py, priors.py, __init__.py}`, `references.json`, `pyproject.toml`.
- `.gaia/{ir.json, beliefs.json, inquiry/}` after `gaia compile && gaia infer`.

**Success criterion.** `cd <name>-gaia/ && gaia compile . && gaia check --hole . && gaia infer .` all pass. Obligation list empty + hypothesis list investigated (or every remaining obligation / hypothesis has an explicit user-deferred reason). `priors.py` covers every leaf flagged by `gaia check --hole`.

### Turn 2 — Extend

**Prompt example.** *"Explore more on phonon-mediated coupling in K3C60 and extend the graph."*

**Skills invoked, in order:**

1. **Read prior audit trail.** Load `artifacts/lkm-discovery/{merge_audit.md, dismissed/, merge_decisions.todo}` and `.gaia/inquiry/` so prior verdicts are honoured. A pair already merged stays merged; a candidate already in `dismissed/` is **not** re-introduced.
2. **`$lkm-api`** — query LKM with the sub-topic as obligation seed. New `POST /claims/match` calls with sub-topic terms; `GET /claims/{id}/evidence` for new chain-backed candidates. Append raw JSON to the existing `artifacts/lkm-discovery/input/` directory (do not overwrite — these are the cumulative input set).
3. **Discovery flag refresh (delta only).** Re-scan; append new pairs to `contradictions.md` / `equivalences.md`. Existing rows from prior turns are preserved.
4. **User-selection checkpoint.** Same rules as Turn 1 — surface new chain-backed candidates, gate on the user. May skip if the user named a specific narrow target in the prompt.
5. **`$lkm-to-gaia` (mode `batch`, refresh)** — re-formalize, **preserving prior verdicts**. New claims are added to `paper_<key>.py` modules (existing modules are extended, not replaced); new cross-paper operators land in `cross_paper.py`. Existing claim labels are reused; existing priors in `priors.py` are kept as-is. Append to `merge_audit.md`; surface new ambiguous merges to `merge_decisions.todo`.

   The 8-step obligation-driven loop runs again, including **step 4 (hunt open problems — MANDATORY, NEVER SKIP — research-worthy tensions including experiment vs theory, theory vs theory, coverage gaps, quantitative inconsistencies — emits `contradiction(A, B, ..., reason="... | new_question: ...")` primitives plus `gaia inquiry hypothesis add` for each)** on every new claim and against every previously-formalized claim it now neighbours. Obligations and hypotheses open from Turn 1 are still in `.gaia/inquiry/` — they remain in scope this turn, and any open `contradiction-resolution` obligation or hypothesis may be discharged here as new evidence lands. This is the audit-trail-continuity re-batch mechanism by which open-problem state evolves across turns; there is no separate verdict turn for the user to invoke.

**State writes (delta from Turn 1):**

- New raw JSON appended under `artifacts/lkm-discovery/input/`.
- New rows in `merge_audit.md`; possibly new entries in `dismissed/` and `merge_decisions.todo`.
- Extended `src/<import>/paper_*.py` modules; extended `cross_paper.py`.
- Refreshed `.gaia/{ir.json, beliefs.json, inquiry/}` after `gaia compile && gaia infer`.

**Success criterion.** Same as Turn 1 (incl. obligation list empty + hypothesis list investigated), plus: prior verdicts (merges, dismissals) are visible in `merge_audit.md` and not silently overturned. `gaia check --hole` does not surface holes for claims that already had priors before this turn.

### Turn 3 — Traverse and purge duplication

**Prompt example.** *"Walk the graph and clean up duplicate claims."*

**Skills invoked, in order:**

1. **`gaia inquiry review --strict`.** Surface `possible_duplicate_claim` diagnostics emitted by Gaia's static checks. Each diagnostic names two or more claim labels suspected of overlap.
2. **Semantic-judgment pass over paraphrased near-duplicates.** Beyond the strict-equality diagnostics, walk the claim graph and identify pairs that the strict checker missed: same proposition stated with different wording, same numerical value with different units (after conversion), same method-result pair from arXiv preprint vs published version of one paper, etc. Use the `data.papers` metadata under `artifacts/lkm-discovery/input/` to detect same-paper-different-version cases.
3. **Per pair, decide:**

   | Case | Action |
   |---|---|
   | Identical text or trivially equal (whitespace / casing only) | Auto-merge into the canonical claim. `lkm_ids=[<old>, <new>]` in `**metadata`. |
   | Same paper, different version (arXiv ↔ published, matched by DOI / author / title) | Auto-merge. Keep the published version's bibliographic record as primary. |
   | Genuinely independent restatement (different paper, different method, converging on same proposition) | **Keep both**, link with `equivalence(A, B, reason="independent agreement: ...", prior=...)`. Independence preserves Bayesian amplification under BP. |
   | Ambiguous (same proposition? or subtly different scope?) | Surface to `merge_decisions.todo` with both candidates and a one-line question for the user. **Default: KEEP** (safe — conflating dependent restatements silently inflates confidence). |

4. **`$lkm-to-gaia` (incremental)** — apply merges and equivalence edges. Update `paper_*.py` and `cross_paper.py`; preserve the merged-out labels' metadata in the canonical claim.
5. **Log every decision** to `merge_audit.md`. One row per decision: `(label_a, label_b, verdict, reason, source-pointers)`.
6. **`gaia compile && gaia infer`.** Re-propagate; verify the duplicate-claim diagnostics are now empty (or only contain entries pointing to `merge_decisions.todo`).

**State writes:**

- New rows in `merge_audit.md`; possibly new entries in `merge_decisions.todo`.
- Updated `src/<import>/{paper_*.py, cross_paper.py}`.
- Refreshed `.gaia/{ir.json, beliefs.json, inquiry/}`.

**Success criterion.** `gaia inquiry review --strict` no longer surfaces auto-mergeable duplicates. Every merge / equivalence / kept-distinct verdict is visible in `merge_audit.md` with reasoning. `merge_decisions.todo` lists only items requiring user judgment.

### Turn 4 — Visualize

**Prompt example.** *"Render the current Gaia graph."*

**Skills invoked, in order:**

1. **Pre-state check.** Confirm `.gaia/ir.json` exists. If `.gaia/beliefs.json` is missing and the user wants belief shading, run `gaia infer .` first (or surface the gap).
2. **`$gaia-render`.** Hand off the `<name>-gaia/` package path + the desired target (Graphviz DOT, Mermaid `flowchart`, or static raster). The skill emits the visualization with BP-propagated beliefs as node shading or label suffixes, conclusion claims marked `★`, and operator nodes (deduction / support / equivalence / contradiction) in distinct shapes.
3. **Caption the figure.** Always emit a one-paragraph caption: which package, IR hash (from `.gaia/ir_hash`), inference status, shading scheme, operator-shape vocabulary. The caption makes the figure auditable.

**State writes:**

- Visualization artifact (e.g. `graph.dot` + `graph.png`, or `graph.mmd`) under the package or a sibling directory chosen by the caller.

**Success criterion.** The rendered visualization is legible (no CJK tofu, operator vocabulary documented, beliefs visible as shading or labels) and reproducible (caption pins IR hash + inference timestamp).

## Sub-shape: narrow target supplied at any turn

If at any turn the user supplies a specific narrow target (system + quantity, or a specific paper / claim id), **skip the broad-discovery step and the user-selection checkpoint**. Go directly to `$lkm-api`'s evidence fetch on the named claim id, verify the chain-backed gate (`total_chains > 0`), and proceed to the formalization or refinement step appropriate for the turn shape.

When discovery is skipped on a cold-start build, the orchestrator still must produce the discovery flag files for downstream consumers — write `contradictions.md` and `equivalences.md` with a single line `(discovery skipped — narrow target supplied; no pairs scanned)` rather than omitting them.

## Sub-shape: graph-only (no Gaia formalization)

If the user explicitly asks for the evidence graph only ("just build the evidence graph, no gaia package", "evidence subgraph only"), invoke `$lkm-api` discovery → user-selection checkpoint → `$evidence-subgraph` → return graph + audit table + `data.papers` to the user. Stop. Do not invoke `$lkm-to-gaia` or `$scholarly-synthesis`.

`$evidence-subgraph` produces the canonical graph artifact (`evidence_graph.json` with RFC 6901 source-pointer convention into the verbatim raw payload under `raw/`), DOT or Mermaid source, a rendered raster, and an audit table. The skill's own §1–§8 describe the factor-diamond / three-class-edge / chain-bounded discipline; the orchestrator does not re-state them here.

**Title-format compliance.** Graph titles emitted by `$evidence-subgraph` follow its §5 convention (e.g. `<topic>: closure-chain map (auto-layout)` / `<topic>：闭合链图（自动布局）`). The historic banned-phrase check (no "evidence chain" / "subgraph" / "证据链与上下文" / "证据图" in the title) was a `$scholarly-synthesis` concern; in the graph-only path it is enforced by `$evidence-subgraph`'s §5. The orchestrator does not re-grep.

## Parallel downstream consumer: `$scholarly-synthesis` (future work)

`$scholarly-synthesis` is a **parallel downstream consumer** of an audited evidence graph, not a step in the iterative LKM↔gaia loop. Its current status is **atomic-surface-only / future work**: the SKILL.md describes the closure-chain article structure, mandatory inputs (graph + audit + `data.papers`), banned-phrase audit, and section template, but the integration polish (cross-method narration from discovery flags, open-problem narration from contradictions, discovery-flag self-audit step, narrative cleanup) is deferred until after the LKM↔gaia loop lands.

When invoked, the skill takes `(graph artifact, audit table, data.papers subset, contradictions.md, equivalences.md, save-folder)` and emits a Markdown or LaTeX article with the rendered graph as Figure 1. It does not participate in the iterative refinement of `<domain>-gaia/`.

The orchestrator routes to it on explicit request — *"write a scholarly synthesis", "produce a literature review article", "draft the closure-chain paper"*. Otherwise, it stays out of the primary loop. Cross-method comparison narration and open-problem narration are flagged as **future-polish concerns**: in the current loop they are either pre-narrated by the agent into `merge_audit.md` (the audit-trail row is the canonical record), or accepted as a known weak spot that `$scholarly-synthesis` will absorb when it lands.

## Optional peripheral path: incremental mode + `plan.gaia.py` host

`$lkm-to-gaia --mode incremental` supports a host-loop integration where the agent runs as a worker against a long-lived `plan.gaia.py` file managed by an external host (typically the upstream `gaia-discovery` slash skill). The host owns `priors.py`, `references.json`, and the `existingAnchors` map; the agent emits a Python source fragment plus an `imports.json` side-channel listing every new label. The host appends the fragment to `plan.gaia.py` between iterations.

This path is supported but **not the primary workflow**. It is the right shape when the user is running the gaia-discovery loop directly (`/lkm-evidence` or similar slash skill) and wants the orchestrator to drop into worker mode. Otherwise, `<domain>-gaia/` (batch mode) is the canonical artifact.

## Reproducibility contract

The orchestrator is "reproducible" when, given the **same loose prompt** at the **same turn shape** against the **same package state**, two independent runs produce:

1. **Steady candidate list.** The same broad-topic match query yields essentially the same set of chain-backed candidates (order may drift; membership should not).
2. **Steady graph for any chosen candidate.** Once the user picks a candidate, the produced `<name>-gaia/` package has the same root, same factor decomposition (modulo wording), same operator topology, same audit-trail entries.
3. **Steady audit trail.** `merge_audit.md` and `dismissed/` carry every verdict that was made; re-running the same turn against the same state produces the same verdicts (or surfaces the same ambiguities to `merge_decisions.todo`).
4. **Steady visualization for a steady IR.** Given the same `.gaia/ir.json` + `.gaia/beliefs.json`, `$gaia-render` emits the same node / edge structure (modulo layout drift, which is by design — `(auto-layout)` in the figure title acknowledges this).

The reproducibility target is *not* byte-equivalence — it is steady **behaviour**.

## Invariants

- **Chain-backed root only.** No synthetic premises without explicit user waiver.
- **User-selected root only** when more than one chain-backed candidate exists at the discovery step. The orchestrator never picks a root autonomously; it surfaces them and waits.
- **Chain payload is the source of truth.** The LKM JSON returned by `$lkm-api` (premise / factor / step / claim content + `data.papers`) is the only admissible source for graph nodes, claim content, audit anchors, and reference entries. No external paper text — no PDFs, no rendered article fetches, no web scrapes — is admitted.
- **Audit-trail continuity.** On every turn after cold-start, the orchestrator reads `artifacts/lkm-discovery/{merge_audit.md, dismissed/, merge_decisions.todo}` before doing new LKM queries. Prior verdicts are honoured; previously dismissed candidates are not silently re-introduced.
- **Single growing package.** Turns 2–4 operate on the same `<domain>-gaia/` directory as Turn 1 — no parallel forks, no fresh clones, unless the user explicitly requests it.
- **Loose-md flag files only.** Discovery emits `contradictions.md` and `equivalences.md` as the two flag files. The historical 4-file JSON discovery contract is **not re-introduced**.
- **Mandatory user-selection checkpoint** between broad discovery and the build (skipped only when the user supplies a narrow target).
- **`$lkm-to-gaia` self-checks (lexical sanity + Python AST parse)** must pass before any turn that emits DSL is declared complete.
- **`gaia compile && gaia check --hole && gaia infer`** must pass before any turn is declared complete (except graph-only and visualize-only turns).

## When to use a different orchestrator

There is none — this is the unified entry point for the `gaia-lkm-skills` family. Tasks that don't fit any of the turn shapes above are out of scope; ask the user to reformulate. Tasks that involve only the API surface (e.g. *"fetch the raw evidence for `gcn_…`"*) can be handed directly to `$lkm-api` without orchestration.
