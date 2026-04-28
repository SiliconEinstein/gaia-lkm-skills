---
name: scholarly-review
description: Write a domain-vocabulary scholarly review centered on one chain-backed quantitative claim about a system or setting (any field — physics, chemistry, materials, biology, ML, climate, astrophysics, etc.). Section structure traces the closure chain from observational / experimental anchors → theoretical or computational inputs → derivation / inversion / fitting → cross-method comparison → open problems. Heavy on equations, units, and named author–year references resolved via the `$lkm-api` `data.papers` metadata block. Banned-phrase audit (no LKM/system vocabulary in main narrative). **Mandatory inputs:** an audited evidence graph (from `$evidence-subgraph`), the audit table, and the `data.papers` metadata. If the graph is not provided, stop and require the user to generate one first via `$evidence-subgraph`.
---

# Scholarly Review

## Principle

The review answers exactly one question: **how is this result closed?**

Not "is this system / model / phenomenon X conventional?", not "what is the general theory of the field?" — only: given the observational / experimental anchors and the theoretical / computational inputs, what derivation produces the target result, what assumptions does that derivation hide, what theory–theory or method–method tensions does it surface, and where do open theory–experiment / model–observation gaps remain?

The graph and audit table from `$evidence-subgraph` are **mandatory scaffolding**. The review's subject is the **scientific / scholarly claim itself**, in the field's normal vocabulary — not the graph, not the retrieval pipeline.

## Mandatory inputs

This skill **requires** the following inputs to be supplied (typically by the orchestrator `$evidence-graph-review`, or the user directly):

1. **Audited evidence graph** — DOT or Mermaid `flowchart` source from `$evidence-subgraph`.
2. **Audit table** — per-edge bridge sentences with chain-payload anchors (premise / factor / step references into the LKM JSON).
3. **`data.papers` metadata** (from `$lkm-api`) — the authoritative paper-id → bibliographic-metadata map; the references list is built from this.

If the **graph is not provided**, stop and instruct the user to first run `$evidence-subgraph` (via `$evidence-graph-review` or directly) on their chosen root claim. Do not attempt to write a review from raw chain JSON without the audited graph — the graph is what disciplines the review's structure and prevents drift into ungrounded prose.

## Topic-agnosticism

This skill is installed by users across many fields. Domain-specific terms in the produced review come from the LKM chain payload (premise / factor / step / claim content) and the user-selected claim, plus bibliographic context from `data.papers` — **not** from the skill text. The closure-chain abstraction generalizes:

- **Computational / first-principles fields** — `(electronic structure / force field / simulation inputs) → (intermediate computed quantities) → (derivation / inversion) → (parameter or predicted observable)`.
- **Experimental / observational fields** — `(measurement protocol + calibration + sample / observation conditions) → (raw signal / dataset) → (analysis / inversion) → (extracted parameter or property)`.
- **ML / AI** — `(architecture + dataset + hyperparameters) → (training and intermediate metrics) → (eval protocol) → (benchmark or scaling result)`.
- **Modeling-driven fields** (climate, astrophysics, epidemiology) — `(forcings / initial conditions + model resolution + parameterizations) → (simulated observables) → (comparison / inversion) → (sensitivity or response parameter)`.

Wherever the section structure below says "theoretical / computational inputs" or "cross-method comparison", read the corresponding noun in your own field.

## Hard style bans (main narrative — title, abstract, body, conclusion, references)

The following are forbidden in the main narrative; allowed only in an explicit "methodology / provenance" appendix.

**English ban list:**

- "evidence graph", "subgraph", "dependency graph", "evidence chain", "chain-internal", "chain-backed"
- "premise", "factor", "claim id", "upstream support", "upstream conclusion", "upstream claim"
- "tier 0 / tier 1 / tier 2" (when referring to graph layers)
- "first layer / second layer" (when referring to graph layers, not physical or model layers)
- "audit table", "audit trail", "retrieval bundle", "retrieval system"
- "LKM", "Large Knowledge Model", "gcn_*", "gfac_*", "paper:<id>", "source package id"
- The graph's own section titles (e.g. "evidence chain and context") — never quoted as a section heading

**Locale-mirrored ban list.** When the review is written in a language other than English, mirror the ban list to that language before running the banned-phrase grep. Canonical mirrors:

- *Simplified Chinese:* `证据图`, `子图`, `依赖图`, `证据链`, `链内`, `链支持`, `前提`, `因子`, `声明 id`, `上游支撑`, `上游结论`, `上游声明`, `第 0 层 / 第 1 层 / 第 2 层` (in graph-tier sense), `审计表` / `核查表`, `审计轨迹`, `检索包`, `检索系统`, `LKM`, `大知识模型`, `gcn_*`, `gfac_*`, `paper:<id>`, `来源包 id`, and the graph's own section titles such as `证据链与上下文`.
- *Other locales:* mirror each English term to the equivalent native term before grepping. Document the locale-specific list once in the review's `notes.md` so future runs in the same locale can re-use it.

**Word allow-list.** The English word "chain" is acceptable in physics / domain phrases such as "closure chain", "reaction chain", "supply chain", "Markov chain" — these refer to the substantive scientific concept, not to the graph data structure. The corresponding allow-list in Chinese: `闭合链`, `推理链`, `反应链`, `供应链`, `马尔可夫链` — explicitly permitted in the main narrative. Same logic for "tier" when it refers to a real-world hierarchy in the domain (e.g. "tier-1 evidence" in clinical research) and not to the graph's tier-0/1/2 vocabulary. Use judgement; the test is whether a domain reader who has never heard of the graph would parse the word in its physical / scholarly sense.

External papers are cited by **author–year**, resolved through the `data.papers` metadata block (`en_title`, `authors`, `publication_date`, `publication_name`, `doi`). System identifiers and graph artifacts may appear only in the optional provenance appendix, with a caption that disclaims them as preparation scaffolding.

## Default section structure

Generalizable to any chain-backed quantitative root. Adapt the closure-chain expression in section 1 to the domain.

1. **Title.** Names the system / setting, the quantitative result, and the framing question. Localize to the user's prompt language.

2. **Abstract.** ≤ 250 English-word equivalents. For CJK-language reviews, the analogous bound is ≈ 350 Chinese / Japanese characters; for other languages, scale by typical word density. Cover: the system / setting, the observational signals or experimental anchors that motivate the question, the theoretical / computational task (the chain to close), the central inversion / fitting result, what it resolves, and what it leaves open. End with keywords.

3. **Section 1 — Introduction: the closure chain.**
   State the problem in domain language. Write the closure chain as an explicit schematic — for example:

   `(theoretical / computational inputs) → (intermediate quantities) → (observables or benchmarks) ↔ (target parameter)`

   In a specific domain, instantiate the schematic with the actual symbols, e.g. for a strong-coupling Eliashberg-style problem `α²F(ω) → λ, ω_log → Tc, Δ(0) ↔ μ*`; for a binding-affinity problem `(force field + sampling protocol) → (free-energy estimator output) → (assay K_d) ↔ (binding pose conformation)`; etc. Explain why the framing question is *not* "is this case conventional / typical" but "given these inputs, does this number close the chain consistently".

4. **Section 2 — Observational / experimental constraints.**
   Quote the anchoring measurements with units and uncertainties. State explicitly which observation disciplines which theoretical / computational input. This is the section that prevents the rest of the review from drifting into pure model-talk.

5. **Section 3 — Theoretical / computational inputs.**
   Method (computational technique, fit family, simulation protocol); what was computed or simulated (intermediate quantities); model prunings (which symmetries assumed, which sub-effects dropped); validity conditions (where the chosen method is expected to be reliable). Quote computed numbers from the calculation / simulation paper(s) by author–year. State which simplifications matter for the rest of the chain.

6. **Section 4 — Inversion / fitting.**
   The equation, optimization, or procedure that fixes the target result. Quote it explicitly. Derive or describe the resulting value. Make a clean separation between *measured* / *computed* / *fitted* / *assumed* — a reader should be able to colour each input by category and see what the conclusion really rests on.

7. **Section 5 — Cross-method or cross-formalism comparison.**
   Where applicable: analytical formulas vs numerical solvers, mean-field vs many-body, perturbative vs non-perturbative, model-A vs model-B, in-distribution vs out-of-distribution, simulation-with-X vs simulation-without-X. Quote the discrepancy with units. Explain its origin (truncation conventions, neglected sub-effects, dataset shifts). When verification edges in the graph **partially disconfirm** the root, narrate that tension explicitly here.

8. **Section 6 — Open problems and what would discriminate.**
   Assumptions that carry the conclusion (symmetry assumptions, single-channel reductions, harmonic / linearity assumptions, fixed priors, etc.); theory–experiment / model–observation gaps still uncovered; theory–theory or method–method tensions; **specific** experiments / measurements / calculations that would discriminate the surviving alternatives. Avoid generic gestures — name the measurement and the threshold.

9. **References.** Author–year, fully bibliographic. **Build entries from the `data.papers` metadata block** supplied with the inputs: `en_title` for English titles (or `zh_title` if the review is Chinese and a Chinese title is preferred); `authors` (split on `|` and reformat); `publication_date`; `publication_name`; `doi`. The references list is part of the **main narrative** for ban-list purposes — no `paper:<id>` strings, no LKM identifiers, no internal claim ids. Append a short closing line such as: *"For further information about each cited result, refer to the original paper via the DOI listed above."*

10. **Optional methodology / provenance appendix.** The only place where the evidence graph image, its caption, the audit table, or any system identifiers may appear. Caption must say plainly: this figure summarises how the literature was organised during preparation; it is **not** the scientific content of the review.

## Style

- **Equations numbered.** `(1)`, `(2)`, … with `\eqref{...}` cross-references in LaTeX, or `(eq. 3)` inline in markdown.
- **Units everywhere.** Don't write "8.4 K" once and "8.4" later. Keep units on every numeric quantity that has them.
- **Significant figures.** Preserve from source; do not round unless the source does so.
- **Voice.** Impersonal or "we"; never refer to the agent, the graph, or the retrieval pipeline.
- **Tone.** A domain researcher who has never heard of the underlying knowledge-base / retrieval system should be able to read the article cover to cover without losing the argument.

## LaTeX defaults

If LaTeX is requested:

- `article` class, 11–12 pt, A4 or letter.
- For Chinese: `xeCJK` package, e.g. `Noto Serif CJK SC`. For other non-Latin scripts: select an analogous fallback font.
- `amsmath`, `amssymb`, `mathtools` for equations; `hyperref` for cross-refs; `graphicx` for figures. Field-specific packages (e.g. `physics`, `chemfig`, `siunitx`) only when the domain calls for them.
- Compile with `latexmk -xelatex -interaction=nonstopmode` (or `pdflatex` if no CJK).
- Inspect the log for missing-glyph warnings, overfull hboxes, undefined references — fix before declaring done.

## Verification before hand-off

Before declaring the review complete:

1. **Mandatory-inputs check.** Confirm graph + audit table + `data.papers` were all supplied. If any is missing, STOP and request it.
2. **Banned-phrase grep.** Run a regex grep for the ban list (English + locale mirror) against the main-narrative source (excluding the appendix). Zero hits required. The allow-list above clarifies legitimate uses of words like "chain" / "tier" in the domain sense.
3. **Best-effort numerical-anchor check.** For every number in the review, try to locate it in the chain payload (premise `content`, factor steps, claim content) or — for numbers attributed to a different paper — in that paper's `data.papers` entry plus the chain payload of the root. The check is **soft**: chain payloads are sometimes incomplete, and a number may legitimately not be locatable inside the JSON we have. When a number cannot be confirmed, do not delete it — note `anchor not locatable in chain payload` next to the audit-table row that supplied it. A number that the chain payload **contradicts**, however, is a real error and must be fixed.
4. **Citation completeness.** Every author–year mention in the body has a matching reference entry built from `data.papers`, and vice versa.
5. **Equation-number consistency.** No undefined `\eqref{...}`, no duplicated labels.

## What this skill is NOT

- Not a literature-survey writer. For thematic / cross-paper reviews on a topic, run discovery via `$evidence-graph-review` and pick a single chain-backed root — this skill writes one closure-chain article at a time.
- Not a graph-renderer. The graph comes from `$evidence-subgraph`; this skill consumes it for the optional appendix only.
- Not for purely qualitative claims. A claim with no numeric or formula-level anchor has no closure step to write about; this skill does not apply.
