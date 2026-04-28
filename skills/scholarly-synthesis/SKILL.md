---
name: scholarly-synthesis
description: Write a domain-vocabulary scholarly synthesis centered on one chain-backed quantitative claim about a system or setting (any field — physics, chemistry, materials, biology, ML, climate, astrophysics, etc.). The rendered evidence graph from `$evidence-subgraph` is **Figure 1 of the body**, placed immediately after the abstract. Section structure traces the closure chain from observational / experimental anchors → theoretical or computational inputs → derivation / inversion / fitting → cross-method comparison → open problems. Heavy on equations, units, and named author–year references resolved via the `$lkm-api` `data.papers` metadata block. When source-paper figures or data tables are appropriate to quote, the agent does so on a best-effort basis with `Adapted from <author–year>` attribution; when such material is not recoverable from the chain payload, the agent surfaces the missing-material list to the user instead of fabricating. Banned-phrase audit (no LKM/system vocabulary in main narrative). **Mandatory inputs:** an audited evidence graph, the audit table, the `data.papers` metadata, and the contradictions/equivalences flag files from the orchestrator. If the graph is not provided, stop and require the user to generate one first via `$evidence-subgraph`.
---

# Scholarly Synthesis

## Principle

The synthesis answers exactly one question: **how is this result closed?**

Not "is this system / model / phenomenon X conventional?", not "what is the general theory of the field?" — only: given the observational / experimental anchors and the theoretical / computational inputs, what derivation produces the target result, what assumptions does that derivation hide, what theory–theory or method–method tensions does it surface, and where do open theory–experiment / model–observation gaps remain?

The graph and audit table from `$evidence-subgraph` are **mandatory scaffolding**. The synthesis's subject is the **scientific / scholarly claim itself**, in the field's normal vocabulary — not the graph, not the retrieval pipeline.

## Mandatory inputs

This skill **requires** the following inputs to be supplied (typically by the orchestrator `$evidence-graph-synthesis`, or the user directly):

1. **Audited evidence graph** — DOT or Mermaid `flowchart` source plus a rendered raster (PNG / PDF / SVG) from `$evidence-subgraph`. The rendered raster is what gets embedded as Figure 1 of the body.
2. **Audit table** — per-edge bridge sentences with chain-payload anchors (premise / factor / step references into the LKM JSON).
3. **`data.papers` metadata** (from `$lkm-api`) — the authoritative paper-id → bibliographic-metadata map; the references list is built from this.
4. **Discovery flag files** from the orchestrator: `contradictions.md` and `equivalences.md`. Both must exist (each may be empty — in that case it carries the single line `(no pairs detected in this run)` for full-discovery runs, or `(discovery skipped — narrow target supplied; no pairs scanned)` when the orchestrator skipped discovery). These shape Section 5 (cross-method comparison) and Section 6 (open problems). They are unrelated to `missing-material.md`, which this skill produces itself when source-paper figures or tables cannot be reproduced verbatim.

If the **graph is not provided**, stop and instruct the user to first run `$evidence-subgraph` (via `$evidence-graph-synthesis` or directly) on their chosen root claim. Do not attempt to write a synthesis from raw chain JSON without the audited graph — the graph is what disciplines the synthesis's structure and prevents drift into ungrounded prose.

If the **discovery flag files are not provided**, stop and request them from the orchestrator. Empty files are acceptable and expected for narrow-target inputs that skipped discovery — the orchestrator should still produce them, marked empty.

## Source-paper figures and tables (best-effort)

A literature synthesis benefits from reproducing or adapting figures and data tables from the source papers — that is convention in the field. This skill follows the convention on a **best-effort** basis, bounded by what the chain payload actually carries.

**When the chain payload describes a figure / table.** When premise `content`, claim content, or `factors[i].steps[j].reasoning` quotes or paraphrases a specific figure caption, table row, or numerical breakdown from a source paper, the synthesis may quote that text verbatim with attribution `Adapted from <author–year>`. The "adapted from" tag is mandatory whenever the wording originates from a paper that is not the user-selected root.

**When the chain payload does not carry the figure / table itself.** The chain payload is propositional content — it does not include rendered figure images, image-format tables, or non-textual artifacts. The skill must **not fabricate** a figure or invented numerical table. Instead, the skill records the gap in a **`missing-material.md`** file in the run folder, one row per gap:

```
| section | citation in synthesis | what was referenced | source paper (DOI) | why not reproduced |
```

`missing-material.md` is surfaced to the user in the final hand-off so the user can manually fetch the figure / table from the DOI for camera-ready preparation.

**Citation discipline for adapted material.** Every "Adapted from" attribution names a paper that already appears in the references list (built from `data.papers`). Do not introduce a new paper in an "Adapted from" line that is not in the references — that bypasses the citation-completeness check.

## Topic-agnosticism

This skill is installed by users across many fields. Domain-specific terms in the produced synthesis come from the LKM chain payload (premise / factor / step / claim content) and the user-selected claim, plus bibliographic context from `data.papers` — **not** from the skill text. The closure-chain abstraction generalizes:

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

**Locale-mirrored ban list.** When the synthesis is written in a language other than English, mirror the ban list to that language before running the banned-phrase grep. Canonical mirrors:

- *Simplified Chinese:* `证据图`, `子图`, `依赖图`, `证据链`, `链内`, `链支持`, `前提`, `因子`, `声明 id`, `上游支撑`, `上游结论`, `上游声明`, `第 0 层 / 第 1 层 / 第 2 层` (in graph-tier sense), `审计表` / `核查表`, `审计轨迹`, `检索包`, `检索系统`, `LKM`, `大知识模型`, `gcn_*`, `gfac_*`, `paper:<id>`, `来源包 id`, and the graph's own section titles such as `证据链与上下文`.
- *Other locales:* mirror each English term to the equivalent native term before grepping. Document the locale-specific list once in the synthesis's `notes.md` so future runs in the same locale can re-use it.

**Word allow-list.** The English word "chain" is acceptable in physics / domain phrases such as "closure chain", "reaction chain", "supply chain", "Markov chain" — these refer to the substantive scientific concept, not to the graph data structure. The corresponding allow-list in Chinese: `闭合链`, `推理链`, `反应链`, `供应链`, `马尔可夫链` — explicitly permitted in the main narrative. Same logic for "tier" when it refers to a real-world hierarchy in the domain (e.g. "tier-1 evidence" in clinical research) and not to the graph's tier-0/1/2 vocabulary. Use judgement; the test is whether a domain reader who has never heard of the graph would parse the word in its physical / scholarly sense.

External papers are cited by **author–year**, resolved through the `data.papers` metadata block (`en_title`, `authors`, `publication_date`, `publication_name`, `doi`). System identifiers (`gcn_*`, `gfac_*`, `paper:<id>`) may appear only in the optional provenance appendix.

**The rendered evidence graph itself is exempt from the ban,** because its node labels are domain-language phrases (the graph skill mandates human-readable labels). The graph is **Figure 1 of the body**, with a domain-language caption that does not contain banned phrases (no "evidence graph", no "subgraph", no "证据图", etc. in the caption text — call it "closure-chain map of <topic>" or similar). The audit table, by contrast, still belongs only in the optional provenance appendix or in `notes.md` — it carries chain-payload anchors and would trip the banned-phrase grep if placed in the body.

## Default section structure

Generalizable to any chain-backed quantitative root. Adapt the closure-chain expression in section 1 to the domain.

1. **Title.** Names the system / setting, the quantitative result, and the framing question. Localize to the user's prompt language.

2. **Abstract.** ≤ 250 English-word equivalents. For CJK-language syntheses, the analogous bound is ≈ 350 Chinese / Japanese characters; for other languages, scale by typical word density. Cover: the system / setting, the observational signals or experimental anchors that motivate the question, the theoretical / computational task (the chain to close), the central inversion / fitting result, what it resolves, and what it leaves open. End with keywords.

3. **Figure 1 — the closure-chain map.** Embed the rendered evidence graph (from `$evidence-subgraph`) immediately after the abstract, **before** Section 1. Caption in domain language. Two well-formed examples:

   - English: *"Figure 1. Closure-chain map of <topic>: how the experimental anchors and the theoretical / computational inputs combine to fix <target quantity>. Edge legend on the figure."*
   - 中文: *「图 1. 〈课题〉闭合链图：实验锚点与理论/计算输入如何共同确定〈目标量〉。边的图例见图内。」*

   Do **not** caption it as "evidence graph" / "subgraph" / "证据图" / etc. — those are banned in the main narrative. Do **not** restate the three edge classes ("chain support", "background", "verification support" / "链式支撑", "背景", "核验支撑") inside the body caption — the rendered graph already carries that legend, and repeating those names in body prose risks tripping the banned-phrase grep. Section 1 references the figure (e.g. *"as summarised in Figure 1"*) when introducing the closure chain.

4. **Section 1 — Introduction: the closure chain.**
   State the problem in domain language. Write the closure chain as an explicit schematic — for example:

   `(theoretical / computational inputs) → (intermediate quantities) → (observables or benchmarks) ↔ (target parameter)`

   In a specific domain, instantiate the schematic with the actual symbols, e.g. for a strong-coupling Eliashberg-style problem `α²F(ω) → λ, ω_log → Tc, Δ(0) ↔ μ*`; for a binding-affinity problem `(force field + sampling protocol) → (free-energy estimator output) → (assay K_d) ↔ (binding pose conformation)`; etc. Explain why the framing question is *not* "is this case conventional / typical" but "given these inputs, does this number close the chain consistently".

5. **Section 2 — Observational / experimental constraints.**
   Quote the anchoring measurements with units and uncertainties. State explicitly which observation disciplines which theoretical / computational input. This is the section that prevents the rest of the synthesis from drifting into pure model-talk.

6. **Section 3 — Theoretical / computational inputs.**
   Method (computational technique, fit family, simulation protocol); what was computed or simulated (intermediate quantities); model prunings (which symmetries assumed, which sub-effects dropped); validity conditions (where the chosen method is expected to be reliable). Quote computed numbers from the calculation / simulation paper(s) by author–year. State which simplifications matter for the rest of the chain.

7. **Section 4 — Inversion / fitting.**
   The equation, optimization, or procedure that fixes the target result. Quote it explicitly. Derive or describe the resulting value. Make a clean separation between *measured* / *computed* / *fitted* / *assumed* — a reader should be able to colour each input by category and see what the conclusion really rests on.

8. **Section 5 — Cross-method or cross-formalism comparison.**
   Where applicable: analytical formulas vs numerical solvers, mean-field vs many-body, perturbative vs non-perturbative, model-A vs model-B, in-distribution vs out-of-distribution, simulation-with-X vs simulation-without-X. Quote the discrepancy with units. Explain its origin (truncation conventions, neglected sub-effects, dataset shifts). When verification edges in the graph **partially disconfirm** the root, narrate that tension explicitly here. Pull from the **equivalence pairs** in `equivalences.md` (passed in by the orchestrator) whose lineage is `independent experimental`, `independent theoretical / computational`, or `cross-paradigm confirmation` — those strengthen the cross-method narrative. Pairs classified `same paper, different version` (arXiv preprint vs journal version) must not be cited as independent confirmation; pairs classified `unclassified` should be flagged as "two reports of the same value whose independence has not been established" rather than treated as confirmation.

9. **Section 6 — Open problems and what would discriminate.**
   Assumptions that carry the conclusion (symmetry assumptions, single-channel reductions, harmonic / linearity assumptions, fixed priors, etc.); theory–experiment / model–observation gaps still uncovered; theory–theory or method–method tensions; **specific** experiments / measurements / calculations that would discriminate the surviving alternatives. Avoid generic gestures — name the measurement and the threshold. **Pull contradiction pairs from `contradictions.md`** (the orchestrator's discovery-flag pass): each contradiction pair in scope of the user-selected topic is a candidate open question — narrate why the two sides disagree (different methods, different sample preparations, different priors) and what measurement / calculation would resolve it. Cite both sides by author–year. Pairs whose lineage is `unclassified` in the equivalences file are also candidates for this section, framed as "two reports of the same value whose independence has not been established."

10. **References.** Author–year, fully bibliographic. **Build entries from the `data.papers` metadata block** supplied with the inputs: `en_title` for English titles (or `zh_title` if the synthesis is Chinese and a Chinese title is preferred); `authors` (split on `|` and reformat); `publication_date`; `publication_name`; `doi`. The references list is part of the **main narrative** for ban-list purposes — no `paper:<id>` strings, no LKM identifiers, no internal claim ids. Append a short closing line such as: *"For further information about each cited result, refer to the original paper via the DOI listed above."*

11. **Optional methodology / provenance appendix.** The only place where the audit table or system identifiers (`gcn_*`, `gfac_*`, `paper:<id>`) may appear. The rendered graph itself is **not** appendix material — it has been promoted to Figure 1 of the body. Caption any appendix tables plainly: this material summarises how the literature was organised during preparation; it is **not** the scientific content of the synthesis.

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

Before declaring the synthesis complete:

1. **Mandatory-inputs check.** Confirm graph (source + rendered raster) + audit table + `data.papers` + `contradictions.md` + `equivalences.md` were all supplied. If any is missing, STOP and request it. Empty flag files are acceptable.
2. **Figure 1 placement.** The rendered evidence graph appears as Figure 1 of the body, immediately after the abstract and before Section 1. Caption is in domain language and contains zero banned phrases.
3. **Banned-phrase grep.** Run a regex grep for the ban list (English + locale mirror) against the main-narrative source (excluding the appendix and the embedded graph file itself, which is binary). Zero hits required. The allow-list above clarifies legitimate uses of words like "chain" / "tier" in the domain sense.
4. **Best-effort numerical-anchor check.** For every number in the synthesis, try to locate it in the chain payload (premise `content`, factor steps, claim content) or — for numbers attributed to a different paper — in that paper's `data.papers` entry plus the chain payload of the root. The check is **soft**: chain payloads are sometimes incomplete, and a number may legitimately not be locatable inside the JSON we have. When a number cannot be confirmed, do not delete it — note `anchor not locatable in chain payload` next to the audit-table row that supplied it. A number that the chain payload **contradicts**, however, is a real error and must be fixed.
5. **Citation completeness.** Every author–year mention in the body has a matching reference entry built from `data.papers`, and vice versa. Every "Adapted from <author–year>" attribution names a paper already in the references list.
6. **Discovery-flag integration.** Section 6 (open problems) cites contradiction pairs from `contradictions.md` where they fall within the topic of the user-selected root. Section 5 (cross-method) cites equivalence pairs from `equivalences.md` whose lineage is `independent experimental`, `independent theoretical / computational`, or `cross-paradigm confirmation`. If either file is non-empty and the corresponding section makes no use of it, document the omission in the run's `notes.md` (e.g. *"4 contradiction pairs out of scope for this root, see file"*).
7. **Missing-material list.** `missing-material.md` is up-to-date: every "Adapted from" reference whose figure / table could not be reproduced has a row pointing to the source paper's DOI.
8. **Equation-number consistency.** No undefined `\eqref{...}`, no duplicated labels.

## What this skill is NOT

- Not a broad literature-survey writer. For thematic / cross-paper syntheses on a topic, run discovery via `$evidence-graph-synthesis` and pick a single chain-backed root — this skill writes one closure-chain article at a time.
- Not a graph-renderer. The graph comes from `$evidence-subgraph`; this skill embeds the rendered raster as Figure 1 and consumes the audit table for verification.
- Not a figure-generator. Figures and data tables adapted from source papers may be quoted with attribution when the chain payload supplies the text; image-format figures cannot be reproduced and are surfaced as missing-material gaps for the user to fill in.
- Not for purely qualitative claims. A claim with no numeric or formula-level anchor has no closure step to write about; this skill does not apply.
