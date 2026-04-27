# Review Structure

## Recommended Sections

1. Title and abstract
2. Introduction: problem and stakes
3. Evidence base: empirical/textual/computational facts
4. Modeling or interpretive framework
5. Reasoning reconstruction
6. Comparison and tension among sources
7. Open problems and future evidence
8. Conclusion
9. References

## What To Avoid

- Do not write a database summary as if it were a paper.
- Do not use system IDs in main prose unless the user asks for audit documentation.
- Do not promote context edges to proof.
- Do not hide model dependence, fitted parameters, or missing premises.
- Do not claim consensus where the graph only shows one source or one model.

## Figure Caption Pattern

State relation semantics explicitly:

> Solid edges denote direct evidence-chain support; dashed edges denote manually verified support across sources; **blue dashed edges** (when used) denote **prior paper conclusion → premise** support judged on **propositional content**; dotted edges denote background context and should not be read as proof dependencies.
>
> Figures delivered to readers should use **natural-language node captions** (e.g. 中文) keyed to the same claims referenced in the audit table, not raw ids alone—see `skills/evidence-subgraph/references/graph-output.md`.

## Quality Checklist

- Can a reader understand the question without the graph?
- Are theory/experiment/model comparisons explicit where relevant?
- Are assumptions and open problems named?
- Are measured, computed, fitted, and inferred claims separated?
- Is the graph caption honest about dependencies vs context?
- For **conclusion-rooted** graphs, does the prose (or appendix) make clear **which prior established results license which premises**, without confusing lexical similarity with support?
- Does the final PDF render correctly?
