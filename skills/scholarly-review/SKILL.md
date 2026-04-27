---
name: scholarly-review
description: Write standalone scholarly reviews, mini-review papers, or LaTeX manuscripts from audited evidence graphs, reasoning chains, paper-extraction outputs, or structured proposition sets. Use when Codex needs to turn claim/premise/context evidence into academic prose, compare theory with experiment or source with source, identify assumptions and open problems, include evidence graphs in articles, or produce Markdown/LaTeX/PDF outputs without relying on retrieval-system jargon.
---

# Scholarly Review

## Principle

**Write a standalone academic article, not a commentary on the evidence graph.** The reader is a domain researcher who has never heard of LKM, the dependency subgraph, retrieval chains, or the audit workflow. The subject of the review is the **scientific/scholarly problem itself** (e.g. ``electron--phonon coupling in single- and bilayer graphene as seen by ARPES''), **not** ``what this subgraph contains.''

The graph and its audit are **scaffolding** that informs what to cover and how sources relate; they are **not** the object of discussion. If the evidence graph appears in the article at all, it belongs at the **end** (methodological figure or appendix), with a caption the reader can ignore without losing the argument.

## Hard style bans in the main narrative

The following terms must **not** appear in title, abstract, introduction, body, or conclusion (they are acceptable only in an explicit ``methodology / provenance'' appendix, and even there should be minimised):

- ``evidence graph'', ``dependency graph'', ``subgraph'', ``evidence chain'', ``chain-internal'', ``chain-backed''
- ``premise'', ``factor'', ``claim id'', ``upstream support'', ``upstream conclusion'', ``upstream claim''
- ``tier 0 / tier 1 / tier 2'', ``first layer / second layer''（指的是图的层级而非物理层数）
- ``audit table'', ``audit trail'', ``retrieval bundle''
- ``LKM'', ``gcn_*'', ``gfac_*'', ``source package id''
- Section titles such as ``与深度图同构的叙述'', ``图中各层在说什么'', ``链内打包的直接支撑''

Instead, talk about what the **sources, experiments, calculations and models** say, using the normal vocabulary of the field.

## Workflow

1. **Frame the scientific question.** State the substantive problem and why it matters in domain language. Do not open with graph provenance.
2. **Reorganise evidence by topic, not by graph tier.** Group claims under physically/scholarly meaningful headings (e.g. ``ARPES self-energy analysis'', ``phonon mode assignment'', ``doping protocols''), regardless of where they sat in the subgraph.
3. **Cite sources, not nodes.** When multiple prior papers converge on a result, cite them as papers. Reserve system identifiers for the provenance appendix if any.
4. **Make the inferential bridge explicit in physics terms.** If earlier results license an intermediate conclusion, explain **why** (shared observable, shared limit, shared assumption), not that an edge exists in a graph.
5. **Discuss tensions as a scientist would.** Compare measurements, models, assumptions; quote numbers and units; call out what is measured vs computed vs fitted vs assumed.
6. **State open problems.** Name the assumptions that carry the conclusion and the experiments/analyses that would discriminate alternatives.
7. **Figures and appendix.** If the evidence graph is included, put it in a ``provenance / methodology'' appendix with a caption that states clearly: this figure summarises how the literature was organised during preparation; it is **not** the scientific content of the review.
8. **Compile and verify.** For LaTeX, compile to PDF, inspect figures, and fix font/encoding/reference warnings.

Read `references/review-structure.md` for the reusable outline and the banned-phrase checklist.

## Style

Normal academic prose for the target field. Separate epistemic statuses (``measured'', ``computed'', ``fitted'', ``assumed'', ``inferred'', ``background''). No pipeline narration unless the article is explicitly a methodology paper.

## Handoff

Use this skill after evidence artefacts (from `$lkm-api` + `$evidence-subgraph`, or any equivalent source) are in place. **Those artefacts inform which topics to cover; they do not dictate the narrative structure of the review.**
