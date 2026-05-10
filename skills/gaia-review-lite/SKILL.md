---
name: gaia-review-lite
description: Lightweight ("flash") scientific audit prompt template for a compiled Gaia knowledge package. Claim+contradiction-centric quick review — walks the agent through inspecting the package's Gaia IR / probability graph, surveying science-facing nodes and their support / deduction / contradiction relations, and writing two audit deliverables (`docs/scientific_story.md` for the overall scientific story plus node/edge reasonableness, and `docs/open_questions_review.md` for `contradiction(...)`-backed open questions only). Hypothesis-only items in `.gaia/inquiry` are explicitly out of scope. Pure documentation atomic; no scripts, no runtime workflow. Covers ~30-40% of named Gaia IR primitive types — see `## Coverage`. Use when the user asks for a quick / lite / flash review of a `<name>-gaia/` package and a full IR audit is overkill; for a deeper IR-coverage review, the planned `$gaia-review-deep` is the follow-up.
---

# $gaia-review-lite

A lightweight scientific-audit prompt template for a compiled Gaia knowledge package. The skill body **is** the prompt: an agent invoking this skill runs the workflow below against the package's compiled Gaia IR plus its source files, audit logs, and saved LKM raw payloads (when present), and produces two Markdown deliverables.

This is a *prompt-driven* review, complementary to the programmatic checks under `$gaia-cli` (`gaia check`, `gaia infer`). It is intentionally narrow — claim+contradiction-centric — and trades IR coverage for speed. See [Coverage](#coverage) for what is and is not in scope.

## Role

`$gaia-review-lite` is a **references-only documentation atomic**, parallel to [`$gaia-package`](../gaia-package/SKILL.md) and [`$gaia-cli`](../gaia-cli/SKILL.md). No scripts. No runtime workflow other than the audit prompt itself.

It does not retrieve evidence, edit the package, or modify Gaia DSL files. It produces two read-only audit documents under `docs/`.

## What this skill does

我想对当前 Gaia package 的**完整 compiled Gaia IR / 概率图**做一次科学审计。这里的"最终 Gaia graph"指 Gaia 编译后的完整 IR 中的 knowledge / strategy / operator 结构，而不是手工简化图或 README 中的叙述图。请确认两件事情：

1. 完整 Gaia IR / 概率图里的所有 science-facing nodes，以及 node 与 node 之间的关系，在该领域背景下是否科学准确、合理、没有明显误导？
2. 完整 Gaia IR 中实际存在的 `contradiction(...)` operators 提出的 open questions 是什么？请尤其谨慎判断这些 open questions 是否科学合理，是否只是 scope mismatch、方法学差异、有限尺寸 / 实验条件差异导致的伪问题。

### Scope

- 审计对象以完整 compiled Gaia IR 为准，包括 `claim` knowledge、`support` / `deduction` strategies、`contradiction` operators，以及它们构成的概率图关系。
- Gaia 编译时自动生成的内部形式化 helper nodes（例如 `__implication_result_*`、`__conjunction_result_*`）属于概率图结构的一部分；审计时要确认它们没有造成科学误导，但不要把它们当作独立科学命题来讲故事。
- `open question` 只统计已经提升为 Gaia DSL `contradiction(...)` 的部分，即 IR 中 contradiction operator 的 reason 里 `open_problem:` 对应的问题。
- 不要把只停留在 `.gaia/inquiry` 里的 hypothesis-only 问题纳入 `docs/open_questions_review.md`。
- 可以在背景说明中提到 hypothesis-only 问题存在，但不要把它们当作"最终图中的 open questions"审计。

### Inputs

请先基于：

- 当前 Gaia IR / source files / audit logs；
- 已保存的 LKM raw payload；
- 你自己的领域知识；
- 必要时使用可靠网页或论文页面检索；

完成科学判断。

然后产出两个 Markdown 文档。

### Deliverable 1 — `docs/scientific_story.md`

- 简洁说明最终 Gaia graph 讲了什么科学故事。
- 先完成 node / edge 科学合理性审计后再写。
- 如果发现任何科学硬伤、明显误导、scope mismatch 被过度解释、或需要人工决断的问题，不要隐藏；在文档最后单独加 `## Issues Requiring Review` 列出。
- 如果没有硬伤，也明确写 `No blocking scientific issues found.`

建议文档结构：

```md
# Scientific Story and Scientific-Validity Audit

## Audit Scope

说明本次审计覆盖当前完整 compiled Gaia IR / 概率图中的 science-facing nodes、strategy / operator relations、contradiction-backed open questions，以及使用了哪些材料。

明确排除：

- `.gaia/inquiry` 中仅作为 hypothesis 保留、未提升为 `contradiction(...)` 的问题。

同时说明：

- Gaia 编译自动生成的内部 helper nodes（例如 `__implication_result_*`、`__conjunction_result_*`）是概率图结构的一部分，但不是独立科学命题；科学故事不应把它们当作领域结论叙述。

## Audit Verdict

明确写：

- `No blocking scientific issues found.`

或者：

- `Blocking / possible scientific issues found; see Issues Requiring Review.`

## Scientific Story

用领域语言简洁讲清最终 Gaia graph 的科学主线。不要只罗列文件或节点。

## Node and Edge Reasonableness

概括说明主要节点类型、主要边类型为什么科学上合理。

这里应覆盖：

- claim nodes；
- support / deduction / contradiction 等关系；
- contradiction 是否是合理的科学张力，而不是被 scope mismatch 误导出来的伪矛盾。

## External Source Check

列出用于交叉核对的可靠来源，例如论文页、arXiv、出版社页面、官方数据页等。

## Issues Requiring Review

列出所有科学硬伤、潜在误导、scope mismatch、需要人工决断的点。
如果没有阻塞性问题，也要写：

`No blocking scientific issues found.`
```

### Deliverable 2 — `docs/open_questions_review.md`

- 只审计完整 Gaia IR 中实际存在的 `contradiction(...)` operators 对应的 open questions。
- 每个 contradiction-backed open question 单独成段或小节。
- 对每个 open question 写清：
  - open question 原文；
  - 它对应哪个 `contradiction(...)`；
  - 它是由图中哪些 scientific claims / tensions / methods 引出的；
  - 它的科学意义是什么；
  - 它为什么是合理 open question，或为什么可能只是 scope mismatch / 方法差异 / 伪问题；
  - 需要 review / 决断的点。
- 不要纳入只停留在 `.gaia/inquiry` 中、没有成为 `contradiction(...)` 的 hypothesis-only 问题。
- 不要把 open question 直接包装成结论；保持审慎语气。

建议每个 open question 使用如下结构：

```md
## N. <open question 原文>

Corresponding contradiction: `<contradiction_symbol>`

This open question is introduced by ...

Its scientific significance is ...

This is / is not a reasonable open question because ...

Review point: ...
```

最后加一个总览：

```md
## Summary of Open-Question Status

- 当前最终 Gaia graph 中一共有多少个 contradiction-backed open questions；
- 哪些科学上合理；
- 哪些最需要人工 review；
- 哪些可能只是 scope mismatch / 方法学差异；
- 是否存在应降级、改写、删除、或从 `contradiction(...)` 改成 hypothesis-only 的 open question。
```

### Final response

最后请简要汇报：

- 产出了哪些文件；
- 是否发现 blocking scientific issue；
- 最终 Gaia graph 中有几个 contradiction-backed open questions；
- 哪些 contradiction-backed open questions 最需要人工 review；
- 是否有 hypothesis-only 问题被明确排除在本轮审计之外；
- 是否已经 commit / push（如果用户要求）。

## Coverage

This skill is **claim+contradiction-centric**, suitable for inquiry-flavored quick review of a Gaia package. About 30-40% of named IR primitive types covered.

Covered:

- `claim` Knowledge type (premise / derived / exported)
- `contradiction` Operator
- `support` Strategy (independent evidence)
- `deduction` Strategy (logical inference)

Not covered (use future `$gaia-review-deep` for full IR audit):

- `setting` / `question` Knowledge types
- 5 non-contradiction operators: `implication` / `equivalence` / `complement` / `disjunction` / `conjunction`
- 11 non-deduction / non-support strategies: `infer` / `noisy_and` / `reductio` / `elimination` / `mathematical_induction` / `case_analysis` / `abduction` / `analogy` / `extrapolation` / `compare` / `induction`
- `CompositeStrategy` / `FormalStrategy` / `FormalExpr` internal structure
- `parameterization` values (priors, beliefs)
- Edge `role` semantics (premise / background / variable / conclusion)

The skill still notices Gaia compile-generated helper nodes (`__implication_result_*`, `__conjunction_result_*`, etc.) as structure, but it does not deeply audit the operators that produce them. If a package's scientific load-bearing structure lives mainly in those uncovered operators or strategies, route to `$gaia-review-deep` instead (when available) or fall back to a manual IR walk paired with `gaia check --brief` / `gaia check --show`.

## Future work

`$gaia-review-deep` (TBD) is the planned follow-up for full IR-coverage review — same prompt-driven shape, expanded to all knowledge types, all operators, all strategies, composite / formal structure, and parameterization. When that skill lands, it will become the recommended path for any audit where the uncovered surface above is load-bearing.

## See also

- [`$gaia-package`](../gaia-package/SKILL.md) — package shape contract (input contract for this skill — defines what a `<name>-gaia/` package looks like on disk and what metadata its claims / strategies / operators carry).
- [`$gaia-cli`](../gaia-cli/SKILL.md) — quality gate via `gaia check` / `gaia infer` (programmatic checks, complementary to this prompt-driven review).
- [`$lkm-explorer`](../lkm-explorer/SKILL.md) and [`$formalize`](../formalize/SKILL.md) — typical upstream skills that produce the packages reviewed here.
