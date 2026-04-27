# Review Structure

## Audience and framing

The deliverable is a **standalone scholarly review** of a substantive problem (a physics question, a historical debate, a method comparison…). Assume the reader has **never** seen the evidence graph, the retrieval system, or the audit workflow. The evidence graph exists only to keep the author honest; it is **not** the subject.

## Recommended sections (domain language only)

1. Title and abstract — in field vocabulary; no meta-commentary about the graph.
2. Introduction — the substantive question and why it matters.
3. Background / preliminaries — definitions, observables, models needed to read the article.
4. Evidence and results — grouped by **physical/scholarly theme**, not by graph tier. Each subsection presents measurements, computations, and historical claims, separating measured / computed / fitted / assumed status.
5. Interpretation and model dependence — what the results license, under which assumptions.
6. Tensions among sources — where papers disagree, where units/normalisations differ.
7. Open problems and future evidence.
8. Conclusion.
9. Acknowledgements / references.
10. *(Optional)* Appendix — methodology and provenance: one short section if the user wants it; may include the evidence graph figure. This is the **only** place where retrieval-system vocabulary may appear, and it must still be minimised.

## Banned phrases in the main narrative

Section titles and body text must **not** read like a commentary on the graph. Do not use:

- ``evidence graph / dependency graph / subgraph / 深度依赖图''
- ``evidence chain / chain-backed / chain-internal / 链内''
- ``premise / factor / claim id / upstream support / upstream conclusion''
- ``audit / audit trail / audit table''
- ``tier 0 / tier 1 / tier 2 / first layer / second layer (在指图的层级时)''
- ``LKM / gcn_* / gfac_* / source package''
- Section titles such as ``与深度图同构的叙述'', ``图中各层在说什么'', ``链内打包的直接支撑''

Rewrite in domain language: speak of **experiments, calculations, measurements, samples, models, assumptions, prior works**.

## Figure policy

- Graphs of evidence/dependency structure belong in the **provenance appendix**, not as a main figure.
- Figures in the main text should show **physical content** (a spectrum, a dispersion, a schematic, a table of numbers), not the retrieval graph.
- When the evidence graph is included as an appendix figure, its caption must state plainly that it is a **methodological summary of how the literature was organised**, not a scientific diagram. Edge/colour keys are listed in the same caption. Node captions must already be in natural language (see `skills/evidence-subgraph/references/graph-output.md`).

## Quality checklist

- Does the article make sense to a domain reader who never opens the appendix?
- Are the title, abstract, and section headings written in domain language only (no ``graph'', ``chain'', ``premise'', ``tier'', ``audit'')?
- Are measured / computed / fitted / assumed claims separated?
- Are tensions between sources discussed in physical/scholarly terms, not as edge colours?
- Are prior works cited **as papers**, not as nodes?
- Is the evidence graph, if present, clearly demoted to methodology?
- Does the final PDF compile cleanly and render CJK / math correctly?
