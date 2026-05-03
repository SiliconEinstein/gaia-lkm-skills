---
name: evidence-subgraph
description: Build, audit, and render a methodological-decomposition evidence graph rooted on a chain-backed quantitative claim of the form "<system or setting> has <quantity> = <value>" or "<computation / measurement> yields <observable>". The graph is the anatomy of how that single result is closed inside one paper's reasoning — observational / experimental constraints, theoretical or computational inputs, intermediate computed quantities, derivation / inversion / fitting steps, parameter and approximation choices, and external-paper / setting context. Multiple labelled joint-support factor diamonds, three-class edge taxonomy (chain support / background / verification support — render in the user's locale, e.g. 链式支撑 / 背景 / 核验支撑 in Chinese), auto-layout (Graphviz neato/sfdp or Mermaid flowchart with linkStyle for per-edge classes — Mermaid mindmap is NOT acceptable), CJK-safe fonts and labels. Domain-agnostic: physics, chemistry, materials, biology, ML, climate, astrophysics, etc. Inputs come from `$lkm-api` (chain payload + `data.papers` metadata). The graph is strictly chain-bounded — only LKM-returned premises and their explicit content are admitted as nodes; no synthetic bridging from external sources. Hand off to `$scholarly-synthesis` for the prose.
---

# Evidence Subgraph

## Principle

The graph shows the **anatomy of one quantitative result**, not a literature genealogy. The root is a specific result — typically `<system> has <quantity> = <value>` or `<computation / measurement> yields <observable>`. The graph traces the reasoning pipeline that produces that result inside the root paper:

`(observational / experimental anchors) + (theoretical / computational inputs) + (parameter / approximation choices) → (intermediate quantities) → (derivation / inversion / fitting) → (root result)`.

External papers do **not** become "tier-1 upstream conclusions" — they appear as named **context** nodes (named by the formula, dataset, method, or theorem they contributed *as named in the LKM premise content*; *not* by paper id) attached to whichever reasoning step uses them. The backbone is the root paper's own reasoning chain returned by LKM `evidence`. The graph is strictly chain-bounded: every node and edge must trace to content that LKM returned. Do not mint synthetic intermediate nodes to bridge gaps in the chain payload — gaps are recorded as audit-table observations, not papered over.

The same paradigm applies across domains:

- **Computational science** — `(electronic structure / force field / simulation inputs) → (intermediate observables) → (derivation) → (parameter value or predicted observable)`.
- **Experimental science** — `(measurement protocol + calibration + sample preparation) → (raw signal) → (analysis / inversion) → (extracted parameter)`.
- **ML / AI** — `(architecture + dataset + hyperparameters) → (training curves / intermediate metrics) → (eval protocol) → (benchmark score / scaling exponent)`.
- **Modeling-driven fields** (climate, astrophysics, epidemiology) — `(forcings / initial conditions + model resolution + parameterizations) → (simulated observables) → (comparison / inversion) → (sensitivity parameter)`.

The skill text below is domain-agnostic. Every domain-specific term in the produced graph comes from the LKM chain payload (premise / factor / step content and `data.papers` metadata), not from the skill.

## Default root

A chain-backed claim returned by `$lkm-api` whose conclusion text names a system / setting and a quantitative result. The orchestrator (`$evidence-graph-synthesis`) provides the user-selected root id; this skill does not perform discovery itself.

If invoked with a chain-less claim id (`total_chains == 0`), stop and return the failure to the orchestrator. Do not invent premises.

## Mandatory output contract

Every successful invocation of this skill must leave a conforming run-folder on disk. The directory layout, structured `evidence_graph.json` schema, the verbatim `raw/` payloads, the source-pointer convention (RFC 6901 JSON Pointer), and the pre-success self-check are specified canonically in `references/run-folder-output-contract.md`. Read it before producing any output, and run the contract's §8 self-check before declaring the task complete. Failing any check in §8 is a hard failure.

**Discovery-flag inputs (loose-md contract).** The orchestrator (`$evidence-graph-synthesis`) emits its discovery flags as loose Markdown files into the run folder, not JSON: `contradictions.md`, `equivalences.md`, and `candidates.md` (the user-selection short-list). This skill consumes those loose-md files when they are needed (notably `equivalences.md` for the no-duplicate-nodes rule in §2). Deeper classification of those candidate pairs — lineage, hypothesized cause, independence basis, cross-validation vs dismissal — is **not** done here; it is deferred to `$lkm-to-gaia`'s Gaia formalization stage. Earlier drafts of this skill referenced a four-file JSON discovery contract and a companion classification reference; that contract has been retired — the cross-validation / dismissal semantics now live in the Gaia formalization, and the upstream flags are loose-md.

## Workflow

### 0. Gate: chain-backed root

The `$lkm-api evidence` payload for the root must have `total_chains > 0`. Synthetic premises only with explicit user waiver. If the root id does not satisfy the gate, return to `$lkm-api` for re-discovery — do not proceed.

The chain payload itself is the **single source of truth** for every node and audit anchor in this skill: claim `content`, factor `subtype`, premise `id` and `content`, optional `steps[].reasoning`, and the `data.papers` metadata block. No external paper text is admitted as a node.

### 1. Factor diamonds (one per `gfac_*`)

Each `gfac_*` factor in the root's evidence chains becomes a labelled diamond (`shape=diamond` in DOT, or analogous in Mermaid). The label is two short lines:

- top line: the factor operator name in the user's locale (`共同支撑` for Chinese / `joint support` for English / etc.). If the LKM payload exposes a `subtype` (e.g. `noisy_and`, `noisy_or`), include it parenthetically: `共同支撑 (noisy_and)` / `joint support (noisy_and)`.
- bottom line: a concrete tag derived from the factor's premises — e.g. *"inversion step"*, *"first-principles input"*, *"dataset + protocol"*, *"thermodynamic coverage"*. The exact wording comes from reading the premise contents and naming the cluster they form.

If the chain has **multiple** `gfac_*` nodes, render multiple factor diamonds — **do not collapse them into one**. Multiple factors carve the reasoning into distinguishable clusters (e.g. one for the input computation, another for the inversion step, another for cross-observable coverage).

If the chain has **exactly one** `gfac_*` node, render exactly one diamond. Use the bottom-line tag to summarise the cumulative semantic of all premises (e.g. *"inversion-step closure"*, *"computation + fitting"*) — do not leave the bottom line empty or generic.

### 2. Native premises → typed reasoning nodes

The primary text source for each premise is `factors[].premises[].content` in the parent chain payload. Some chain payloads also expose `steps[].reasoning` — that field is **optional**. Do not require `steps`; do not fail when it is absent.

For each native premise (chain-internal id; `total_chains == 0` standalone but full content recoverable from the parent chain), classify the premise content into one of four reasoning-node types:

- **method-setting** — *what* method / protocol / model is used and *how* it is configured. Examples: "simulation method + convergence parameters", "fit model + assumed prior", "measurement protocol + calibration".
- **intermediate result** — a computed, simulated, or measured quantity that becomes input to the next step. Examples: "computed coupling = 1.33", "fitted gap ratio = 5.0", "training loss at step N", "measured rate constant = …".
- **parameter choice** — an explicitly chosen scalar / categorical setting, with its value. Examples: "isotropy assumption true", "cutoff ω_c = 3 Ω_max", "mini-batch size = 64", "fixed prior σ = 0.1".
- **derivation step** — an equation, inversion, or fitting procedure that determines a downstream quantity. Examples: "Δ_{m=1}(μ*, T_c) = 0 ⇒ μ* fixed", "argmax over θ", "linear regression on log-log axes".

Render each as a labelled box (filled, locale-safe font). Label is two short lines: first line = tag (the role this node plays in the chain), second line = numerical / equation / symbol anchor lifted verbatim from the premise `content` (or, when present, `steps[].reasoning`).

**Empty-content premises (temporary).** Some premises currently come back from `$lkm-api` with only an `id` populated and an empty `content` — this is a temporary corpus state and the LKM is being progressively populated. Render as gray dashed nodes with the placeholder label "未展开前提 / unexpanded premise" only when the user explicitly asks for full premise coverage; the default is to omit. The audit table must mark them `content unavailable (temporary)` so a future pipeline run (when content is populated) can revisit them.

**No synthetic bridging.** The graph is strictly chain-bounded. If an intermediate quantity is implied but not present in any premise / step / claim content returned by LKM, do **not** mint a node for it — record the gap in the audit table as `gap: <description>` and move on. Inventing nodes silently switches the graph from chain-backed to synthetic.

**No duplicate nodes for equivalent premises.** When two premises (or a premise and a verification-support claim) assert the **same proposition** — same equation, same numerical value, same formal statement, just from different parts of the chain or different source packages — render them as a **single node**. List the two source packages in parentheses on a second label line, or as a side note in the audit table; do not draw two near-identical boxes. This rule applies whether the equivalence comes from within the root chain itself or is flagged in the orchestrator's `equivalences.md`. Because the upstream flag is a recall-oriented candidate list (no lineage classification yet), the merge decision here is a judgement call on the premise text; when in doubt, keep the two as distinct verification-support nodes and let `$lkm-to-gaia`'s formalization stage reconcile them downstream — the independent confirmation is informative for the closure-chain reader and erasing it loses information. Obvious same-paper / same-version restatements (e.g. arXiv preprint and journal version of one paper saying the same thing) should still be merged.

### 3. Background / context nodes

Add a panel-style node (visually distinct from reasoning nodes — different fill colour, `shape=note` in DOT) for each of:

- **external paper / formula / dataset / theorem named inside an LKM premise's `content`** — name it by the formula, dataset, theorem, or method it contributed (e.g. *"AD formula"*, *"Morel–Anderson renormalization"*, *"ImageNet-1k"*, *"GPCR-Bench"*, *"Anderson's theorem"*) — **never** by paper id, and **never** drawn from outside the chain payload. The actual paper bibliography lives in `data.papers` and is consumed by `$scholarly-synthesis` for the references list.
- **parameter-setting / approximation / regularization choice** — e.g. *"real-axis solution, weak damping"*, *"hybrid functional"*, *"early stopping"*.
- **scope-bounding empirical fact** — a fact that bounds where the analysis applies (e.g. *"linear-T resistivity"*, *"validation set held out"*, *"Migdal small parameter ω_ph/E_F ≪ 1"*).

Connect to the reasoning node(s) they justify, scope, or limit using **background** edges. Background nodes never participate in the conjunction structure; they annotate it. Background nodes have **no incoming chain edges**.

### 4. Edge taxonomy (exactly three classes)

| class | render style | when to use |
|-------|--------------|-------------|
| **chain support** (`链式支撑` / `chain support`) | solid line, thick (penwidth 1.8–2.2), neutral colour (e.g. black) | chain conjunction edges: premises → factor diamond, factor diamond → root, and any internal step-to-step backbone explicitly carried by the LKM chain |
| **background** (`背景` / `background`) | dashed line, thin, distinctive colour (e.g. purple) | context: parameter setting, external-paper input, regularization choice, scope-bounding fact |
| **verification support** (`核验支撑` / `verification support`) | dashed line, thin, distinctive colour (e.g. green) | independent calculation, source-of-record number, or cross-method check that confirms (or partially disconfirms) a specific numerical anchor inside a reasoning node — for partial-disconfirm polarity append a parenthetical to the edge label, e.g. `核验支撑（部分不符）` / `verification support (partial disconfirm)` |

The label rendered on the edge is in the user's locale. The taxonomy itself is fixed.

**Do not introduce other classes.** No "literature support", no "tier-2 support", no `upstream_conclusion_support`. External-paper inputs are background; cross-method comparisons (confirming or partially disconfirming) are verification support — note polarity in the audit table's bridge sentence rather than inventing a fourth class.

### 5. Layout, fonts, and labels (CJK-safe)

- **Auto-layout renderer**: Graphviz `neato` / `sfdp` for DOT (preferred for archival), or Mermaid `flowchart` with `linkStyle` for per-edge classes (preferred when no Graphviz install). Do **not** use Mermaid `mindmap` — it has no per-edge styling and cannot encode the three-class taxonomy.
- **Title format**: `<root system / topic> <quantity or theme>: closure-chain map (auto-layout)`. Localize to the user's prompt language (e.g. `<topic>：闭合链图（自动布局）` for Chinese). The "(auto-layout)" tag tells the reader spatial arrangement is non-semantic. Do **not** use phrases that the `$scholarly-synthesis` ban list forbids (e.g. "evidence chain", "证据链与上下文", "subgraph", "证据图") — the rendered graph becomes Figure 1 of the body and any banned phrase in its title will trip the synthesis's banned-phrase grep. "Closure chain" / "闭合链" are explicitly on the synthesis's allow-list.
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

### 6. Audit table

One row per non-trivial edge. **Background and verification-support edges must always be documented in full** (downstream / upstream / class / bridge sentence / chain-payload anchor). For chain-support edges through a `gfac_*` factor (premises → diamond → root), full rows are *recommended but optional*: at minimum, document them once with the factor label as the bridge sentence; preferably, log each premise with its own anchor so the reader can verify the premise text is faithful to the chain payload.

| downstream | upstream | edge class | bridge sentence | chain-payload anchor |
|------------|----------|------------|-----------------|----------------------|

The chain-payload anchor points back into the LKM JSON: a premise id (`gcn_…`), factor id (`gfac_…`), `factors[i].steps[j].reasoning`, or claim content quoted verbatim. For verification-support edges that **partially disconfirm** the downstream node, state the polarity explicitly ("confirms within 5%", "partially disconfirms: independent value differs by 30%"). Without a chain-payload anchor, the row is just paraphrase.

### 7. Cycle check

Run `node skills/evidence-subgraph/scripts/check_dot_cycles.mjs <path-to-graph.dot>` for DOT graphs. The decomposition is a DAG; cycles usually indicate a misclassified background edge — for example, a verification-style fact mis-rendered as background creates a cycle through the inversion step.

### 8. Best-effort numerical-anchor check

Before hand-off, walk every numerical anchor in every reasoning node and try to locate it inside the chain payload — premise `content`, claim content, or `factors[i].steps[j].reasoning`. The check is **soft**: chain payloads are sometimes incomplete, and an anchor may legitimately not be locatable inside the JSON. When you can confirm an anchor, log the chain-payload location in the audit row. When you cannot, mark the row `anchor not locatable in chain payload` and leave the node in place — do not delete the node, do not invent a substitute, and do not fail the run on this alone. A node whose value is contradicted by some other piece of the chain payload, however, is a real error and must be fixed.

## Standalone use (graph only, no synthesis)

This skill is also invocable directly when the user asks for "just build the evidence graph" without a synthesis. In that case:

- the orchestrator (`$evidence-graph-synthesis`) still handles discovery + the user-selection checkpoint upstream of this skill;
- after step 8, return the run-folder path (with the contract artifacts under it) directly to the user, with the relevant `data.papers` metadata appended so the user can refer back to the original sources;
- **do not** invoke `$scholarly-synthesis`.

## Hand-off

Hand off to **`$scholarly-synthesis`** with: the graph source (DOT or Mermaid), a **rendered raster** (PNG / PDF / SVG), the audit table, and the relevant subset of `data.papers`. The rendered raster is what `$scholarly-synthesis` embeds as Figure 1 of the body — this means the rendered graph is consumed by domain readers, not just by other agents. Two consequences for this skill:

1. The graph's **title** (the `label` on the DOT `graph` attribute, or the equivalent on the Mermaid front-matter) must be domain-language and free of `$scholarly-synthesis`'s banned phrases. §5's `<topic>: closure-chain map (auto-layout)` template satisfies this; older drafts that used "evidence chain and context" / "证据链与上下文" must be regenerated, not just recaptioned, because the title is baked into the rendered raster.
2. The rendered raster must visually open in any PDF / Markdown viewer the user has — this is what the CJK-tofu check (§5) prevents from breaking.

The synthesis skill writes the prose; this skill does not.

## What this skill is NOT

- Not a literature-genealogy graph. External papers are background nodes, not tier-1 upstream conclusions.
- Not a thematic survey. Single root, single result, single paper's reasoning anatomy.
- Not a renderer-of-record for purely qualitative conclusions. Qualitative claims (e.g. "X exhibits property Y") without a numeric or formula-level anchor do not have a closure step to decompose; this skill does not apply.
