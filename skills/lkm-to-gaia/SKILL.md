---
name: lkm-to-gaia
description: Convert LKM evidence-chain payloads directly into a Gaia DSL knowledge package. Two modes — `batch` (emit a fresh standalone `<name>-gaia/` package directory ready for `gaia compile`) and `incremental` (emit a Python source fragment to merge into an existing `plan.gaia.py`). Agent reads raw LKM evidence JSON + the orchestrator's `contradictions.md` flag file, performs semantic analysis (shared-premise dedup, upstream support, contradiction promotion from both discovery flags and upstream search findings), and writes Gaia DSL source directly. No intermediate JSON format. Domain-agnostic.
---

# LKM-to-Gaia

> **Prerequisite — read `$gaia-lang` and `$gaia-cli` first.** This skill assumes
> the language reference (Gaia DSL primitives, signatures, kwargs/positional
> conventions, label grammar, Cromwell bounds, citation rules, `__all__` /
> module organization rules) and the CLI reference (`pyproject.toml` shape,
> `priors.py` shape, `gaia compile` / `gaia check` / `gaia infer` workflow).
> Anything about *what Gaia DSL is* lives there. This skill documents only
> what is unique to it: how an agent reads LKM evidence and writes Gaia DSL.

## Role

This is the fifth peer in the `gaia-lkm-skills` family. Where `$scholarly-synthesis` turns LKM evidence into prose, this skill turns the same input into **executable Gaia DSL** — a knowledge package that compiles via `gaia compile`, propagates beliefs via `gaia infer`, and carries LKM provenance into `**metadata` kwargs of every claim.

```
discovery -> $evidence-subgraph (raw LKM evidence JSON)
                                |
                        +-------+-------+
                        v               v
              $scholarly-synthesis   $lkm-to-gaia   <-- THIS SKILL
                  (prose article)    (Gaia package)
```

Routed via [`$evidence-graph-synthesis`](../evidence-graph-synthesis/SKILL.md) when the user asks for a "Gaia package", "Gaia DSL", "knowledge package", or "formalized into Gaia".

## Input (received from orchestrator)

- **Raw LKM evidence JSON** (from `$lkm-api`) for each selected root claim — the `GET /claims/{id}/evidence` response, containing `data.claim`, `data.evidence_chains[].factors[]`, and `data.papers`.
- **Raw LKM match JSON** (from `$lkm-api`) — the `POST /claims/match` response, providing the full candidate set (`data.variables`) and `data.papers` for all candidates.
- **`contradictions.md`** (from the orchestrator's Step 2b) — flag list of contradiction candidates.
- **`candidates.md`** (from the orchestrator's Step 3) — the user's root selection.

These are loose files — **no formal schema, no run-folder contract, no `evidence-graph-run/2.0`**. The agent reads them directly.

## Two-mode contract

### Mode `batch`

**Input:** the files listed above, for one or more selected roots.

**Output:** a fresh standalone `<name>-gaia/` directory ready for `gaia compile`. The agent creates:
- `__init__.py` — re-exports all modules, declares `__all__`
- `paper_<key>.py` — one module per paper, containing its claims + deductions
- `cross_paper.py` — cross-paper operators (equivalence, contradiction, induction)
- `priors.py` — `PRIORS = {leaf_claim: (float, "justification.")}` per `$gaia-cli` §6
- `references.json` — CSL-JSON bibliography built from `data.papers`
- `pyproject.toml` — per `$gaia-cli` §1
- `artifacts/lkm-discovery/` — verbatim copy of input files (raw JSON + `.md` flag files) for provenance

After emit, the agent (or user) runs:

```bash
cd <name>-gaia/
gaia compile .          # produce .gaia/ir.json
gaia check --brief .    # verify structure
gaia check --hole .     # confirm every leaf has a prior in priors.py
gaia infer .            # run BP
```

The skill does NOT run `gaia infer`; that is a follow-up step the caller decides.

### Mode `incremental`

**Input:** same as batch + a path to an existing `plan.gaia.py` + an `existingAnchors` map from the host runtime (typically obtained via `gaia.inquiry.anchor.find_anchors`).

**Output:** a Python source fragment. The agent appends it to `plan.gaia.py` without re-declaring imports and without breaking existing claim definitions. Labels that match `existingAnchors` are reused. `priors.py` and `references.json` are updated by the host, not by this skill.

## Core mapping rules

The agent reads the LKM evidence JSON and writes Gaia DSL, applying these rules:

### 1. Claims

Every distinct `gcn_*` claim (post shared-premise extraction) → one `claim(...)` per `$gaia-lang` §2:

```python
<label> = claim("<content>", prior=<float or None>, lkm_id="gcn_xxx", source_paper="paper:xxx", provenance_source="lkm")
```

- If LKM returns a `score` on this claim (via match results), use it directly as the `prior` kwarg. If not, omit `prior` — leaf priors without LKM scores land in `priors.py`.
- When two claims are merged into one: `lkm_ids=["gcn_a", "gcn_b"]`.
- Empty content → placeholder string + `todo="revisit when LKM populates this premise"` in metadata.

### 2. Factors → Deduction

Every `gfac_*` factor → `deduction([premises], conclusion, reason="<steps text>")` (positional-first per `$gaia-lang` §4). The `reason` is the concatenated `steps[].reasoning` from the factor — this is the LKM's explanation of how the premises jointly support the conclusion. No warrant `prior` — the reasoning text is the evidence, and BP computes the belief strength.

### 3. Upstream support for premises

During formalization, the agent searches LKM for upstream conclusions relevant to each premise. A single premise may have **multiple** upstream conclusions — each gets its own `support(...)` call:

```python
support([U_1], P, reason="...", prior=<float>)
support([U_2], P, reason="...", prior=<float>)
# ... 等
```

`support([a], b, prior=p)` is directional: a 充分支撑 b。p close to 1 → a 几乎充分决定 b。

Warrant prior reflects how strongly the upstream corroborates the premise:
- Strong (same topic, directly implies) → 0.85–0.95
- Moderate (related, partially overlaps) → 0.70–0.85
- Weak/lateral → 0.50–0.65

**No equivalence needed here.** Two upstream claims that both strongly support the same premise naturally converge in BP through their shared conclusion. The agent just writes separate `support()` edges.

### 4. Contradiction

Contradictions come from **two sources**:

**Source A — Orchestrator flag files** (`contradictions.md` from discovery Step 2b). The agent reads each flagged pair and decides:

| Situation | Action |
|---|---|
| Real tension (can't both be true; may be an open problem) | `contradiction(a, b, reason="... | new_question: ...", prior=<float>)` |
| False alarm (boundary conditions differ, etc.) | Dismiss; no DSL emitted |

**Source B — Upstream search.** While searching upstream for a premise P, the agent may find claims (conclusions or otherwise) that **contradict** P — i.e., they can't both be true. These should also be marked:

```python
contradiction(P, <conflicting_claim>, reason="found during upstream search for P: <why they can't both be true>", prior=<float>)
```

Prior reflects how strongly the contradiction holds:
- Direct conflict on the same quantity → 0.90
- Different boundary conditions may explain it → 0.50–0.60
- Unclear → 0.50

### 5. `data.papers` → `references.json`

Every paper in the union of `data.papers` across all evidence + match files → one CSL-JSON record. Key: `<firstAuthorSurname><year>`, deduped by suffix letters (`An2001`, `An2001a`, …). Cite via `[@<key>]` in claim content or strategy reasons.

### 7. Module placement

- Claims go in the module of the **first paper** they appear in (paper id alphabetical tie-break).
- `gfac_*` deductions go in the module of `factor.source_package`.
- Cross-paper operators (`support`, `contradiction`, `induction`) go in `cross_paper.py`.
- `__init__.py` re-exports via `from .paper_<key> import *` and `from .cross_paper import *`, then declares `__all__` (selected root claims only).

## Shared-premise extraction (avoiding double counting)

Runs before any operator emission. The agent reads all claim contents across all loaded evidence JSON files:

1. **Auto-merge** premises with **identical content text** (normalized: trimmed, whitespace-collapsed) → one claim, `lkm_ids=[...]` in `**metadata`.
2. **Auto-merge** same paper, different version (arXiv ↔ published, detected by matching DOI/author/title) → one claim.
3. **Keep distinct** for independent confirmations from different papers — multiple `support()` calls from different sources naturally converge under BP.
4. **Surface** to `merge_decisions.todo` when the agent can't decide whether to merge — default: KEEP (safe).

Output: `merge_audit.md` logs every decision for reproducibility.

## Workflow (batch mode)

1. **Read input.** Load all raw LKM evidence JSON files for the selected roots. Load `contradictions.md` from the orchestrator.
2. **Inventory claims.** Walk `evidence_chains[].factors[]` across all loaded files. Collect every distinct `gcn_*` id — premises, conclusions, and the root claim itself. Record each with its `content`, `source_package`, and role in the chain.
3. **Shared-premise extraction.** Run the procedure above. Resolve every premise to a canonical label. Write `merge_audit.md`.
4. **Plan package shape.** Pick a package name (kebab-case `<topic>-gaia`). Create one `paper_<key>.py` per paper. Cross-paper relations → `cross_paper.py`.
5. **Process contradictions.** Two sources:
   - For each pair in `contradictions.md` from discovery, read both claims' contents. Decide promote vs dismiss.
   - During upstream search for each premise, flag any claims found that can't both be true with the premise → `contradiction(...)`.
6. **Emit DSL.** Write each module:
   - `claim(...)` calls for every canonical claim per `$gaia-lang` §2.
   - `deduction([premises], conclusion)` for every `gfac_*` factor.
   - Cross-paper operators in `cross_paper.py`.
   - `priors.py` for all leaf claims (floats, one per leaf, `TODO:review` marker on every justification).
   - `references.json` from `data.papers`.
   - `pyproject.toml` per `$gaia-cli` §1.
   - Copy all input files into `artifacts/lkm-discovery/`.
8. **Self-check.** Lexical sanity (balanced parens / brackets / braces, `from gaia.lang import` present, every `claim(` has matching close, every `prior=` is a float in `[1e-3, 0.999]`). Run `python3 -c "import ast; ast.parse(open('<file>').read())"` on each `.py` module. Fail loudly if any check fails.

## Workflow (incremental mode)

Same as batch, except:

- **Steps 4, 7** (package skeleton, `pyproject.toml`, `priors.py`, `references.json`) are the host's job.
- Agent consults `existingAnchors` and reuses labels that match existing claims.
- Agent emits a single Python source fragment + a side-channel `imports.json` listing every new label with its LKM id and prior. The host appends the fragment to `plan.gaia.py`.

## Authentication

This skill makes **no network calls**. All retrieval was already done by `$lkm-api` upstream. No `LKM_ACCESS_KEY` is needed.

## Hand-off

Batch mode hands the `<name>-gaia/` directory back to the user. Next step: `cd <name>-gaia/ && gaia compile .`

Incremental mode hands the source fragment back to the host, which appends to `plan.gaia.py`.

## What this skill is NOT

- **Not a discovery skill.** Discovery is `$evidence-graph-synthesis` + `$lkm-api`. This skill consumes raw evidence JSON + flag files.
- **Not a renderer.** `gaia render` + the publish skill handle presentation. This skill stops at `gaia compile`-ready source.
- **Not a reviewer.** Setting reviewed priors, interpreting BP, identifying weak points are the review skill and `gaia.inquiry.run_review`. This skill emits `TODO:review` markers and stops there.
- **Not a Gaia DSL teacher.** For *what* `claim` / `deduction` / `support` / `equivalence` mean and how to write them, read `$gaia-lang` directly.
- **Not a wrapper for the gaia-discovery loop.** The `/lkm-evidence` slash skill is a separate downstream consumer.

## Reference files

- [`references/mapping-contract.md`](references/mapping-contract.md) — detailed mapping rules and module placement conventions
- [`references/package-skeleton.md`](references/package-skeleton.md) — batch-mode output layout + templates (defers to `$gaia-cli` for `pyproject.toml` and `priors.py` shape)
- [`references/incremental-mode-contract.md`](references/incremental-mode-contract.md) — incremental-mode invariants + `imports.json` schema
