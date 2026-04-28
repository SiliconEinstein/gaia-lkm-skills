---
name: evidence-subgraph
description: Build, audit, and render a methodological-decomposition evidence graph rooted on a chain-backed quantitative claim of the form "<system or setting> has <quantity> = <value>" or "<computation / measurement> yields <observable>". The graph is the anatomy of how that single result is closed inside one paper's reasoning — observational / experimental constraints, theoretical or computational inputs, intermediate computed quantities, derivation / inversion / fitting steps, parameter and approximation choices, and external-paper / setting context. Multiple labelled joint-support factor diamonds, three-class edge taxonomy (chain support / background / verification support — render in the user's locale, e.g. 链式支撑 / 背景 / 核验支撑 in Chinese), auto-layout (Graphviz neato/sfdp or Mermaid flowchart with linkStyle for per-edge classes — Mermaid mindmap is NOT acceptable), CJK-safe fonts and labels. Domain-agnostic: physics, chemistry, materials, biology, ML, climate, astrophysics, etc. Inputs come from `$lkm-api` (chain payload + `data.papers` metadata + OCR'd root paper). Hand off to `$scholarly-review` for the prose.
---

# Evidence Subgraph

## Principle

The graph shows the **anatomy of one quantitative result**, not a literature genealogy. The root is a specific result — typically `<system> has <quantity> = <value>` or `<computation / measurement> yields <observable>`. The graph traces the reasoning pipeline that produces that result inside the root paper:

`(observational / experimental anchors) + (theoretical / computational inputs) + (parameter / approximation choices) → (intermediate quantities) → (derivation / inversion / fitting) → (root result)`.

External papers do **not** become "tier-1 upstream conclusions" — they appear as named **context** nodes (named by the formula, dataset, method, or theorem they contributed; *not* by paper id) attached to whichever reasoning step uses them. The backbone is the root paper's own reasoning chain (from LKM `evidence`), enriched with method/parameter/setting context drawn from the OCR'd paper text.

The same paradigm applies across domains:

- **Computational science** — `(electronic structure / force field / simulation inputs) → (intermediate observables) → (derivation) → (parameter value or predicted observable)`.
- **Experimental science** — `(measurement protocol + calibration + sample preparation) → (raw signal) → (analysis / inversion) → (extracted parameter)`.
- **ML / AI** — `(architecture + dataset + hyperparameters) → (training curves / intermediate metrics) → (eval protocol) → (benchmark score / scaling exponent)`.
- **Modeling-driven fields** (climate, astrophysics, epidemiology) — `(forcings / initial conditions + model resolution + parameterizations) → (simulated observables) → (comparison / inversion) → (sensitivity parameter)`.

The skill text below is domain-agnostic. Every domain-specific term in the produced graph comes from the OCR'd root paper, not from the skill.

## Default root

A chain-backed claim returned by `$lkm-api` whose conclusion text names a system / setting and a quantitative result. The orchestrator (`$evidence-graph-review`) provides the user-selected root id; this skill does not perform discovery itself.

If invoked with a chain-less claim id (`total_chains == 0`), stop and return the failure to the orchestrator. Do not invent premises.

## Workflow

### 0. Gate: chain-backed root

The `$lkm-api evidence` payload for the root must have `total_chains > 0`. Synthetic premises only with explicit user waiver. If the root id does not satisfy the gate, return to `$lkm-api` for re-discovery — do not proceed.

### 1. OCR the root paper

The orchestrator should have already run `papers/ocr/batch` on the root paper (resolved via `data.papers[<source_package>]` from the evidence response, falling back to `evidence_chains[].source_package`). If not, run it now via `$lkm-api`. The OCR is the source of truth for:

- numerical anchors (parameter values, equation labels, computed or measured quantities);
- method choices (which simulation method, which fit model, which approximation regime, which reduction);
- external-paper invocations (named formulas, named datasets, named theorems, cited benchmarks);
- the equation or procedure that closes the inversion / fit (the step that fixes the root result).

Cite OCR page or equation anchors in the audit table.

### 2. Factor diamonds (one per `gfac_*`)

Each `gfac_*` factor in the root's evidence chains becomes a labelled diamond (`shape=diamond` in DOT, or analogous in Mermaid). The label is two short lines:

- top line: the factor operator name in the user's locale (`共同支撑` for Chinese / `joint support` for English / etc.). If the LKM payload exposes a `subtype` (e.g. `noisy_and`, `noisy_or`), include it parenthetically: `共同支撑 (noisy_and)` / `joint support (noisy_and)`.
- bottom line: a concrete tag derived from the factor's premises — e.g. *"inversion step"*, *"first-principles input"*, *"dataset + protocol"*, *"thermodynamic coverage"*. The exact wording comes from reading the premise contents and naming the cluster they form.

If the chain has **multiple** `gfac_*` nodes, render multiple factor diamonds — **do not collapse them into one**. Multiple factors carve the reasoning into distinguishable clusters (e.g. one for the input computation, another for the inversion step, another for cross-observable coverage).

If the chain has **exactly one** `gfac_*` node, render exactly one diamond. Use the bottom-line tag to summarise the cumulative semantic of all premises (e.g. *"inversion-step closure"*, *"computation + fitting"*) — do not leave the bottom line empty or generic.

### 3. Native premises → typed reasoning nodes

The primary text source for each premise is `factors[].premises[].content` in the parent chain payload. Some chain payloads also expose `steps[].reasoning` — that field is **optional**. Do not require `steps`; do not fail when it is absent.

For each native premise (chain-internal id; `total_chains == 0` standalone but full content recoverable from the parent chain), classify the premise content into one of four reasoning-node types:

- **method-setting** — *what* method / protocol / model is used and *how* it is configured. Examples: "simulation method + convergence parameters", "fit model + assumed prior", "measurement protocol + calibration".
- **intermediate result** — a computed, simulated, or measured quantity that becomes input to the next step. Examples: "computed coupling = 1.33", "fitted gap ratio = 5.0", "training loss at step N", "measured rate constant = …".
- **parameter choice** — an explicitly chosen scalar / categorical setting, with its value. Examples: "isotropy assumption true", "cutoff ω_c = 3 Ω_max", "mini-batch size = 64", "fixed prior σ = 0.1".
- **derivation step** — an equation, inversion, or fitting procedure that determines a downstream quantity. Examples: "Δ_{m=1}(μ*, T_c) = 0 ⇒ μ* fixed", "argmax over θ", "linear regression on log-log axes".

Render each as a labelled box (filled, locale-safe font). Label is two short lines: first line = tag (the role this node plays in the chain), second line = numerical / equation / symbol anchor (from the OCR).

**Empty-content premises (temporary).** Some premises currently come back from `$lkm-api` with only an `id` populated and an empty `content` — this is a temporary corpus state and the LKM is being progressively populated. Render as gray dashed nodes with the placeholder label "未展开前提 / unexpanded premise" only when the user explicitly asks for full premise coverage; the default is to omit. The audit table must mark them `content unavailable (temporary)` so a future pipeline run (when content is populated) can revisit them.

**OCR-sourced intermediate-result nodes.** The four reasoning-node types may also be populated from the OCR'd paper text, *in addition to* the LKM-listed premises, when an intermediate quantity sits between two premises in the closure chain and would otherwise leave the audit table without a back-bone. Mark such nodes clearly in the audit table's bridge sentence as OCR-sourced (e.g. *"from §V Table II"*); they must still satisfy the page-anchor rule. Do not invent intermediate-result nodes that do not appear verbatim in the OCR.

### 4. Background / context nodes

Add a panel-style node (visually distinct from reasoning nodes — different fill colour, `shape=note` in DOT) for each of:

- **external paper / formula / dataset / theorem invoked in the OCR** — name it by the formula, dataset, theorem, or method it contributed (e.g. *"AD formula"*, *"Morel–Anderson renormalization"*, *"ImageNet-1k"*, *"GPCR-Bench"*, *"Anderson's theorem"*) — **never** by paper id. The actual paper bibliography lives in `data.papers` and is consumed by `$scholarly-review` for the references list.
- **parameter-setting / approximation / regularization choice** — e.g. *"real-axis solution, weak damping"*, *"hybrid functional"*, *"early stopping"*.
- **scope-bounding empirical fact** — a fact that bounds where the analysis applies (e.g. *"linear-T resistivity"*, *"validation set held out"*, *"Migdal small parameter ω_ph/E_F ≪ 1"*).

Connect to the reasoning node(s) they justify, scope, or limit using **background** edges. Background nodes never participate in the conjunction structure; they annotate it. Background nodes have **no incoming chain edges**.

### 5. Edge taxonomy (exactly three classes)

| class | render style | when to use |
|-------|--------------|-------------|
| **chain support** (`链式支撑` / `chain support`) | solid line, thick (penwidth 1.8–2.2), neutral colour (e.g. black) | chain conjunction edges: premises → factor diamond, factor diamond → root, and any internal step-to-step backbone explicitly carried by the LKM chain |
| **background** (`背景` / `background`) | dashed line, thin, distinctive colour (e.g. purple) | context: parameter setting, external-paper input, regularization choice, scope-bounding fact |
| **verification support** (`核验支撑` / `verification support`) | dashed line, thin, distinctive colour (e.g. green) | independent calculation, source-of-record number, or cross-method check that confirms (or partially disconfirms) a specific numerical anchor inside a reasoning node — for partial-disconfirm polarity append a parenthetical to the edge label, e.g. `核验支撑（部分不符）` / `verification support (partial disconfirm)` |

The label rendered on the edge is in the user's locale. The taxonomy itself is fixed.

**Do not introduce other classes.** No "literature support", no "tier-2 support", no `upstream_conclusion_support`. External-paper inputs are background; cross-method comparisons (confirming or partially disconfirming) are verification support — note polarity in the audit table's bridge sentence rather than inventing a fourth class.

### 6. Layout, fonts, and labels (CJK-safe)

- **Auto-layout renderer**: Graphviz `neato` / `sfdp` for DOT (preferred for archival), or Mermaid `flowchart` with `linkStyle` for per-edge classes (preferred when no Graphviz install). Do **not** use Mermaid `mindmap` — it has no per-edge styling and cannot encode the three-class taxonomy.
- **Title format**: `<root system / topic> <quantity or theme>: evidence chain and context (auto-layout)`. Localize to the user's prompt language (e.g. `<topic>：证据链与上下文（自动布局）` for Chinese). The "(auto-layout)" tag tells the reader spatial arrangement is non-semantic.
- **Locale**: labels in the user's prompt language.
- **CJK fonts (avoid Graphviz tofu pit).** Default Graphviz fonts (Helvetica, Times) **omit Chinese / Japanese / Korean glyphs**, producing tofu (`□`) blocks in the rendered PNG/SVG. Set fonts explicitly on `graph`, `node`, and `edge` for any non-Latin script:

  ```dot
  graph [fontname="Noto Sans CJK SC", labelloc="t", label=<...>];
  node  [fontname="Noto Sans CJK SC", style="rounded,filled"];
  edge  [fontname="Noto Sans CJK SC"];
  ```

  - **Linux / CI**: `Noto Sans CJK SC` (Simplified Chinese), `Noto Sans CJK TC` (Traditional Chinese), `Noto Sans CJK JP` (Japanese), `Noto Sans CJK KR` (Korean). For Latin scripts: `Noto Sans` or system default.
  - **macOS local**: `PingFang SC` is acceptable.
  - **Windows local**: `Microsoft YaHei` is acceptable.
  - **Always re-open the rendered PNG/SVG and visually check** — if you see `□` boxes, the font fallback failed silently. Switch to a font you know is installed.
  - For Mermaid `flowchart`, set `themeVariables.fontFamily` and verify in the output that CJK characters are intact.
- **Math and symbols**: inline Unicode (μ*, λ, ∫, ⊗) when the renderer supports it; LaTeX-style `\mu^*` only where the renderer supports it. When using DOT HTML-like labels (`<...>`), prefer Unicode for cross-renderer safety.
- **Brevity**: every node label ≤ 2 lines. First line = tag (role of node). Second line = numerical / equation / symbol anchor.

### 7. Audit table

One row per non-trivial edge. **Background and verification-support edges must always be documented in full** (downstream / upstream / class / bridge sentence / page anchor). For chain-support edges through a `gfac_*` factor (premises → diamond → root), full rows are *recommended but optional*: at minimum, document them once with the factor label as the bridge sentence; preferably, log each premise with its own page anchor so the reader can verify the premise text is faithful to the paper. Err on the side of more rows when the audit table is the user's only window into provenance.

| downstream | upstream | edge class | bridge sentence | source page anchor |
|------------|----------|------------|-----------------|--------------------|

The bridge sentence cites the OCR'd paper page or equation number whenever possible. For verification-support edges that **partially disconfirm** the downstream node, state the polarity explicitly ("confirms within 5%", "partially disconfirms: independent value differs by 30%"). Without a page anchor, the graph is just paraphrase.

### 8. Cycle check

Run `node skills/evidence-subgraph/scripts/check_dot_cycles.mjs <path-to-graph.dot>` for DOT graphs. The decomposition is a DAG; cycles usually indicate a misclassified background edge — for example, a verification-style fact mis-rendered as background creates a cycle through the inversion step.

### 9. Verify against OCR

Before hand-off, walk every numerical anchor in every reasoning node and confirm it appears verbatim (or with explicit unit conversion) in the OCR'd paper text. Missing anchors mean either (a) the agent hallucinated a value or (b) the OCR missed a passage — either way, fix before publishing.

## Standalone use (graph only, no review)

This skill is also invocable directly when the user asks for "just build the evidence graph" without a review. In that case:

- the orchestrator (`$evidence-graph-review`) still handles discovery + the user-selection checkpoint upstream of this skill;
- after step 9, return the graph source + audit table + cycle-check report directly to the user, with the relevant `data.papers` metadata appended so the user can refer back to the original sources;
- **do not** invoke `$scholarly-review`.

## Hand-off

Hand off to **`$scholarly-review`** with: the rendered graph source, the audit table, the OCR markdown, and the relevant subset of `data.papers` (so the review's references list can cite by author–year). The review skill writes the prose; this skill does not.

## What this skill is NOT

- Not a literature-genealogy graph. External papers are background nodes, not tier-1 upstream conclusions.
- Not a thematic survey. Single root, single result, single paper's reasoning anatomy.
- Not a renderer-of-record for purely qualitative conclusions. Qualitative claims (e.g. "X exhibits property Y") without a numeric or formula-level anchor do not have a closure step to decompose; this skill does not apply.
