---
name: scholarly-review
description: Write standalone scholarly reviews, mini-review papers, or LaTeX manuscripts from audited evidence graphs, reasoning chains, paper-extraction outputs, or structured proposition sets. Use when Codex needs to turn claim/premise/context evidence into academic prose, compare theory with experiment or source with source, identify assumptions and open problems, include evidence graphs in articles, or produce Markdown/LaTeX/PDF outputs without relying on retrieval-system jargon.
---

# Scholarly Review

## Principle

Write for a reader who has never seen the retrieval system. The review should explain the actual scientific, historical, legal, technical, or scholarly reasoning, not the database schema.

## Workflow

1. Identify the problem.
   State the substantive question and why it matters.

2. Separate evidence types.
   Distinguish observed facts, computed results, fitted parameters, definitions, model assumptions, and inferred conclusions.

3. Reconstruct reasoning.
   Explain how prior work got from evidence to conclusion. Use the audited graph as a guide, but avoid system terms such as claim, premise, factor, or ID in the main prose.

4. Compare sources.
   Discuss agreements and discrepancies: theory vs experiment, model vs model, measurement vs measurement, textual interpretation vs textual interpretation, or dataset vs dataset.

5. State gaps and open problems.
   Identify what remains unresolved, what assumptions carry the conclusion, and what evidence would settle the issue.

6. Include figures when useful.
   If an evidence graph is part of the deliverable, include it with a caption that distinguishes dependencies from context.

7. Compile and verify.
   For LaTeX outputs, compile to PDF, inspect the rendered figure, and report warnings that matter.

Read `references/review-structure.md` for a reusable article outline and quality checklist.

## Style

Use normal academic prose. Avoid pipeline narration unless the article is explicitly about methodology. Be precise about epistemic status: “measured,” “computed,” “fitted,” “assumed,” “inferred,” and “contextual background” are different claims.

## Handoff

Use this skill after `$lkm-api` and `$evidence-subgraph` have produced audited evidence artifacts, or with any equivalent evidence package supplied by the user.
