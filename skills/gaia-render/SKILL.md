---
name: gaia-render
description: Render a Gaia knowledge package (`<domain>-gaia/`) or a `plan.gaia.py` host file as a viewable graph artifact (Graphviz DOT, Mermaid, or static raster) of its claim / strategy / equivalence / contradiction structure, with BP-propagated beliefs surfaced as node shading or labels. Atomic single-responsibility: this skill consumes already-compiled Gaia outputs (`.gaia/ir.json`, `.gaia/beliefs.json`) and emits visualization. It does not discover claims, build evidence graphs, edit DSL source, run inference, or rewrite reasoning prose.
---

# Gaia Render

## Purpose

Turn a compiled Gaia knowledge graph into a viewable visualization — Graphviz DOT, Mermaid, or a static raster (PNG/SVG/PDF). The visualization shows the claim / strategy (deduction, support, equivalence, contradiction) topology of the package and surfaces BP-propagated beliefs as node shading, label suffixes, or both.

This is a sibling to `$gaia-render-obsidian` (in the upstream `gaia-lang` skill family), which produces a richly written Obsidian wiki (Markdown vault) of the same package. That skill is the canonical *narrative* renderer; this skill is the *graph-shape* renderer. Both consume the same compiled artifacts.

## Inputs (two shapes)

This skill renders against **already-compiled** Gaia output. Whatever produced the source — a batch package or a discovery-loop host file — by the time `gaia-render` runs, the contract is the same `.gaia/` artifact directory.

### Shape 1 — `<domain>-gaia/` package (batch mode, from `$lkm-to-gaia` batch)

Standard Gaia package layout:

```
<domain>-gaia/
├── pyproject.toml
├── src/<import>/
│   ├── __init__.py
│   ├── paper_<key>.py
│   ├── cross_paper.py
│   └── priors.py
├── references.json
├── artifacts/lkm-discovery/        # raw LKM JSON + flag files (provenance)
└── .gaia/                          # produced by `gaia compile` + `gaia infer`
    ├── ir.json
    ├── ir_hash
    ├── beliefs.json                # only after `gaia infer`
    └── compile_metadata.json
```

**Pre-render contract:** the caller (or the agent driving this skill) must have run `gaia compile .` and, if belief shading is desired, `gaia infer .`. This skill does not invoke either.

### Shape 2 — `plan.gaia.py` (gaia-discovery host file)

A single-file Gaia DSL Python script edited iteratively by the gaia-discovery loop (`$lkm-to-gaia` incremental mode appends fragments to it). It is also `gaia compile`-able:

```
<host-workdir>/
├── plan.gaia.py                    # the DSL source
├── priors.py                       # leaf priors (host-managed)
├── references.json                 # host-managed
└── .gaia/                          # produced by `gaia compile` + `gaia infer`
    ├── ir.json
    ├── beliefs.json
    └── ...
```

**Pre-render contract:** same as Shape 1. The host (or the agent) must have compiled and (optionally) inferred. Once `.gaia/ir.json` (+ `beliefs.json`) is present, this skill treats Shape 1 and Shape 2 identically — the visualization input is the IR + beliefs, not the DSL source.

### What this skill reads

- `.gaia/ir.json` — node and edge structure of the compiled graph (claims, strategies, operators).
- `.gaia/beliefs.json` — per-node beliefs after BP. **Optional**; if absent, render unshaded.
- `priors.py` — leaf priors, for label annotation when useful.
- `references.json` — bibliographic keys, for citing on operator-edge labels when useful.

This skill does **not** read the raw DSL source (`paper_*.py`, `cross_paper.py`, `plan.gaia.py`). The IR is the renderer's contract — that's what `gaia compile` is for.

## Outputs

Three target formats, picked by the caller per use:

| Target | When to use | How produced |
|---|---|---|
| Graphviz DOT (`graph.dot` + `graph.png` / `graph.svg`) | Large packages, dense reasoning chains, publication figures. `neato`/`sfdp` layout for clusters; `dot` layout for strict topo flow. | Agent emits DOT source from IR; `dot -Tpng` (or `-Tsvg`/`-Tpdf`) renders. |
| Mermaid (`graph.mmd`) | Embedding in Obsidian / GitHub README / Markdown reports. Renders inline in Markdown viewers. | Agent emits Mermaid `flowchart` source from IR. Reuse `gaia render --target docs` if it produces a usable Mermaid block (`gaia/cli/commands/_simplified_mermaid.py` already implements simplified-Mermaid selection). |
| Static raster (`graph.png` / `graph.svg`) | Slide decks, social posts, single-image handoffs. | Pipe DOT or Mermaid through `dot` / `mmdc` to PNG/SVG. |

### BP belief surfacing

When `beliefs.json` is present, every claim node gets one of:

- **Node shading** — fill colour interpolated on belief: high-belief nodes solid, low-belief nodes faint. A 3- or 5-band scheme (e.g. `>0.9` solid green, `0.7–0.9` light green, `0.5–0.7` neutral, `0.3–0.5` light red, `<0.3` solid red) keeps the figure legible at a glance.
- **Label suffix** — append the belief value to the node label, e.g. `cross_term_suppressed (b=0.50)`. Combine with shading for readers who can't rely on colour.

Conclusion claims (in the package's `__all__`) get a star marker (`★`) on the label, matching `$gaia-render-obsidian`'s convention.

Operator nodes (deduction, support, equivalence, contradiction) are rendered with distinct shapes (e.g. diamonds for joint-support deductions, double-arrows for support, dashed bidirectional for equivalence, red lightning for contradiction) — pick a consistent visual vocabulary; document it in the figure caption.

### `contradiction()` reason annotations

`$lkm-to-gaia` §4 (hunt open problems) emits `contradiction(A, B, ..., reason="<why A and B are in tension> | new_question: <investigable open problem>")` and pairs each one with a `gaia inquiry hypothesis add "<open question>" --scope <namespace>::<op_label>` registration. The renderer should split the `reason` string on `|` and surface the `new_question:` part as an edge label / hover tooltip / dedicated callout on the contradiction edge (and, when emitting Mermaid, as a comment-style annotation node attached to the contradiction operator). Open problems thus become visible at a glance — a reader scanning the figure can immediately see *what the graph does not yet resolve*, not just *where the conflicts sit*. Document the annotation convention in the figure caption alongside the operator-shape vocabulary.

## Workflow

### 1. Verify pre-state

Confirm `.gaia/ir.json` exists. If `beliefs.json` is missing, decide whether to proceed unshaded or to ask the caller to run `gaia infer` first.

```bash
test -f .gaia/ir.json   || echo "Missing .gaia/ir.json — run gaia compile ." >&2
test -f .gaia/beliefs.json || echo "Note: no beliefs.json; rendering without shading." >&2
```

### 2. Pick the target

- Mermaid → emit `flowchart TD` (or `LR`) source. The upstream `_simplified_mermaid.py` already implements informativeness-based node selection; for small graphs (< ~30 claims) emit everything, for larger graphs apply selection.
- Graphviz → emit DOT with `digraph G { ... }`, edge attributes for operator type, node attributes for claim vs operator-node shape and belief shading.
- Static raster → produce DOT or Mermaid first, then shell out to `dot -Tpng graph.dot -o graph.png` or `mmdc -i graph.mmd -o graph.png`.

### 3. Walk the IR

Parse `.gaia/ir.json`:

- Each `variable` (claim) → one node. Label = the claim's label (not its content text); for the figure, content text is too long. Apply belief shading + label suffix.
- Each `factor` / `operator` → one operator node (or fold into edges, depending on chosen visual vocabulary). Connect premises → operator → conclusion.
- Each `equivalence` / `contradiction` → distinguished edge style (no separate node) or a small operator node with the two endpoints — pick whichever is more legible for the package's density.

### 4. Emit the source

Write the DOT or Mermaid file. For Graphviz, set `graph [layout=neato, overlap=false, splines=true]` for clustered packages, or `layout=dot` for strict topo-down flow. For Mermaid, `flowchart TD` for vertical reading order, `LR` for wide screens.

### 5. Rasterize (optional)

```bash
dot -Tpng graph.dot -o graph.png
dot -Tsvg graph.dot -o graph.svg
# OR
mmdc -i graph.mmd -o graph.png
```

### 6. Caption the figure

Always emit a one-paragraph caption with the figure: which package, IR hash (from `.gaia/ir_hash`), inference status (`infer` run? when?), shading scheme, operator-shape vocabulary. The caption makes the figure auditable.

## Relationship to upstream `$gaia-render-obsidian`

`$gaia-render-obsidian` (in the gaia-lang skill family at `gaia/skills/render-obsidian/`) is the canonical *narrative* renderer: it produces a full Obsidian wiki (Markdown vault) with per-claim pages, sectioned chapters, and rewritten prose. Its output is **text-heavy** (faithful reproduction, all derivations, all numerical values) and assumes a reader who wants to *read* the package end-to-end.

This skill (`gaia-render`) is the *graph-shape* renderer: a single visualization that shows the *topology* of the same package — what depends on what, where the belief mass concentrates, where contradictions sit. Its output is **figure-only** and assumes a reader who wants to *see* the structure at a glance.

The two skills are complementary, not redundant. A typical workflow uses both: the wiki for reading, the visualization for orienting. Both consume the same `.gaia/ir.json` + `.gaia/beliefs.json`; neither reads DSL source directly.

## What this skill is NOT

Single responsibility: **compiled Gaia output → graph visualization**. Everything else is a sibling skill or downstream consumer.

- **Not a discovery skill.** Discovery is `$orchestrator` + `$lkm-api`. This skill consumes already-compiled IR.
- **Not a builder.** It does not write Gaia DSL — `$lkm-to-gaia` does. It does not edit `plan.gaia.py` — the gaia-discovery host loop does.
- **Not a runner.** It does not invoke `gaia compile` or `gaia infer`. The caller is responsible for the pre-state.
- **Not the wiki renderer.** Narrative Markdown reproduction is `$gaia-render-obsidian`'s job. This skill emits a single graph artifact, not a vault.
- **Not a reviewer.** It does not interpret beliefs, identify weak points, or write critical assessment — `$gaia-render-obsidian`'s "Weak Points" section and the review skill cover that.
- **Not a Gaia DSL teacher.** For *what* the IR nodes mean (claim vs strategy vs operator), read `$gaia-lang` directly.

## Known limits

- **Very large graphs (>~100 claims).** A single-figure render becomes unreadable. Apply node selection (see `_simplified_mermaid.py`'s informativeness scoring), or split by section / by paper, and emit one figure per cluster.
- **CJK labels.** When claim labels contain Chinese / Japanese / Korean characters, ensure the chosen renderer has a CJK-safe font configured (Graphviz: `fontname="Noto Sans CJK SC"`; Mermaid: relies on the viewer's font stack).
- **Operator overlap.** Joint-support diamonds with many premises crowd the figure. For high-fanout operators, consider rendering premises as a labelled list on the diamond rather than separate edges.
- **No layout-optimization pass yet.** The skill emits raw DOT / Mermaid; for publication figures, a manual layout pass (or a follow-up skill) may be needed.
