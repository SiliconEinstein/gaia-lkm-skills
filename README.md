# gaia-lkm-skills

LKM-side agent skills for building Gaia knowledge packages from LKM evidence chains.

The repo ships a family of atomic skills plus one orchestrator that sequences them. The end-to-end goal is an **iterative LKM ↔ Gaia loop**: from a user prompt, an agent grows a single `<domain>-gaia/` knowledge package across turns — building it cold, extending it, resolving contradictions, purging duplication, and visualising it — all on the same on-disk artifact.

## Entry point

`skills/orchestrator/SKILL.md` is the single front door. Any agent handling an LKM-related prompt routes through it first. The orchestrator picks a turn shape, sequences atomic siblings, gates the user-selection checkpoint, and preserves the audit trail across turns.

## Skill family

Five atomic skills + one orchestrator. Full contracts live in each skill's `SKILL.md`; one-line purpose each:

- **`skills/orchestrator/`** — universal entry point. Sequences the five atomic peers into the iterative LKM↔gaia loop. Four turn shapes: cold-start build, extend, traverse and purge duplication, visualize. Contradiction handling is built into Turns 1 and 2 via `$lkm-to-gaia`'s mandatory step 4 (NEVER SKIP) inside the obligation-driven loop, not a separate user-driven turn.
- **`skills/lkm-api/`** — Bohrium LKM HTTP client (match / evidence / variables verbs; `accessKey` auth; raw JSON pass-through).
- **`skills/evidence-subgraph/`** — build / audit / render an evidence graph from LKM chain payloads (factor diamonds, three-class edge taxonomy, chain-bounded discipline).
- **`skills/lkm-to-gaia/`** — convert LKM evidence-chain payloads into a Gaia DSL knowledge package (`<name>-gaia/` batch mode; Python-fragment incremental mode for `plan.gaia.py` hosts).
- **`skills/gaia-render/`** — render a Gaia knowledge package or `plan.gaia.py` as a viewable artifact (graphviz / mermaid / static image), with BP-propagated beliefs as node shading.
- **`skills/scholarly-synthesis/`** — *future-work, atomic surface only*: write a domain-vocabulary scholarly synthesis from an audited evidence graph + bibliographic metadata.

## The single growing artifact: `<domain>-gaia/`

All four primary turn shapes operate on the **same on-disk package**. Layout (per `skills/lkm-to-gaia/references/package-skeleton.md`):

```
<domain>-gaia/
├── pyproject.toml
├── references.json                 ← CSL-JSON, built from data.papers
├── src/<import>/                   ← Gaia DSL source
│   ├── paper_<key>.py              ← one module per paper
│   ├── cross_paper.py              ← support / contradiction / equivalence
│   ├── priors.py                   ← leaf priors with justification
│   └── __init__.py                 ← re-exports + selected roots
├── artifacts/lkm-discovery/        ← audit trail, orchestrator-managed
│   ├── input/                      ← raw LKM JSON
│   ├── candidates.md               ← user-selection short-list
│   ├── contradictions.md           ← discovery flag — pairs that can't both be true
│   ├── equivalences.md             ← discovery flag — pairs that may assert the same prop
│   ├── merge_audit.md              ← every merge / equivalence / dismissal verdict
│   ├── merge_decisions.todo        ← unresolved cases for user review
│   └── dismissed/                  ← rejected upstream conclusions
└── .gaia/                          ← produced by `gaia compile` + `gaia infer`
    ├── ir.json
    ├── beliefs.json
    └── inquiry/                    ← obligation list, review state
```

**Audit-trail continuity is the loop's load-bearing invariant.** On every turn after cold-start, the orchestrator reads prior verdicts from `artifacts/lkm-discovery/` and open obligations from `.gaia/inquiry/` before issuing new LKM queries — successive prompts grow the same package without losing prior decisions.

## Turn shapes (one paragraph each — full recipes in `skills/orchestrator/SKILL.md`)

1. **Cold-start build** — broad-topic discovery via `$lkm-api`, chain-backed candidate filter, discovery flag pass (contradictions + equivalences), mandatory user-selection checkpoint, then `$lkm-to-gaia` batch formalization to convergence (`gaia compile && gaia check --hole && gaia infer` all green). The 8-step obligation-driven loop runs inside `$lkm-to-gaia`, with step 4 (hunt contradictions — MANDATORY, NEVER SKIP) screening every new claim.
2. **Extend** — load prior audit trail, query LKM with the sub-topic as obligation seed, append to the existing input set, refresh discovery flags as a delta, re-formalize while preserving prior verdicts. Step 4 (hunt contradictions — MANDATORY, NEVER SKIP) runs again on every new claim and against every previously-formalized claim it now neighbours; this audit-trail-continuity re-batch is how contradiction state evolves across turns.
3. **Traverse and purge duplication** — `gaia inquiry review --strict` plus a semantic pass over paraphrased near-duplicates, per-pair decision (auto-merge / keep-both-with-equivalence / surface-to-todo), apply via `$lkm-to-gaia` incremental, log every decision, re-propagate.
4. **Visualize** — pre-state check on `.gaia/`, `$gaia-render` to Graphviz / Mermaid / raster with BP belief shading, captioned with package + IR hash + inference timestamp.

Contradiction handling is **not** a separate turn shape: it is built into Turns 1 and 2 as `$lkm-to-gaia`'s step 4 (NEVER SKIP). Real contradictions become `contradiction(...)` primitives plus obligations, apparent ones land in `artifacts/lkm-discovery/dismissed/` with reason, under-determined ones keep an open obligation for a future turn.

## Optional: incremental mode + `gaia-discovery` host

`$lkm-to-gaia --mode incremental` supports a host-loop integration where the agent runs as a worker against a long-lived `plan.gaia.py` managed by an external host (typically `gaia-discovery`). The host owns `priors.py`, `references.json`, and the `existingAnchors` map; the agent emits a Python source fragment + `imports.json` side-channel.

Supported but **not the primary path**. The canonical artifact is `<domain>-gaia/` (batch mode).

## How an agent uses this repo

1. Clone the repo.
2. Read `skills/orchestrator/SKILL.md` first; follow its `$lkm-api`, `$evidence-subgraph`, `$lkm-to-gaia`, `$gaia-render`, `$scholarly-synthesis` references on demand.
3. Each `skills/<name>/SKILL.md` is the contract for that skill. Per-skill `references/` directories carry on-demand supporting material.
4. Skills are plain Markdown directories — runtime-agnostic. Any host that supports a "skill" or "rule" surface can register them by pointing at `skills/`.

## Design boundary

The skills are intentionally field-neutral. LKM is a retrieval / evidence-chain backend, not a discipline-specific ontology. The graph, formalization, and synthesis skills work for physics, chemistry, materials, biology, ML, climate, astrophysics, etc. — any domain where propositions, premises, contexts, and source evidence must be audited.

## Contributing

See `AGENTS.md` for the collaboration contract and skill authoring conventions.
