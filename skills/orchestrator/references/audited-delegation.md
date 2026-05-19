# Audited delegation pattern

Use this pattern whenever an LKM/Gaia turn contains separable atomic work. It
applies to cold-start builds, extensions, duplicate cleanup, graph-only work,
synthesis tasks, and external Gaia CLI/publish workflow commands run outside
local skills.

## Principle

The orchestrator may delegate atomic work to subagents, but it never accepts delegated output directly. Every delegated artifact must be reviewed against the relevant skill contract, repaired if needed, and only then synthesized into the growing package.

Default loop:

1. **Partition.** Split the turn into atomic units with clear inputs and outputs: one selected root, one evidence graph, one duplicate batch, one render target, one synthesis step, etc.
2. **Delegate.** Spawn a subagent for each atomic unit when the work is independent enough to parallelize or risky enough to benefit from isolation.
3. **Force skill loading.** The subagent prompt must name the exact skill files it must read before acting, especially `lkm-explorer/SKILL.md` or `evidence-subgraph/SKILL.md`.
4. **Require a strict return.** Each subagent must report files changed, commands run, pass/fail status, open obligations, and rule deviations.
5. **Review.** The orchestrator independently reads the returned source files and reruns the relevant checks. Do not rely only on the subagent summary.
6. **Repair.** If the artifact violates a skill rule, delegate a focused repair task with the exact finding. Iterate until the artifact passes or the blocker is explicit.
7. **Synthesize.** If multiple validated artifacts must become one package, use a separate synthesis task. Synthesis adds only grounded cross-artifact wiring (merges, equivalences, accepted contradictions, hypothesis-only open problems) and re-runs the quality gates.
8. **Verify.** Run the turn's final success checks from the target package. For Gaia packages this means `gaia build compile .`, `gaia build check --hole .`, and `gaia run infer .`; external Gaia CLI/publish workflow commands also rerun their target-specific checks.

## Turn-specific defaults

### Turn 1: cold-start build

After the mandatory user-selection checkpoint, treat each selected root as an atomic LKM-explorer mapping task when work needs delegation. Each worker reads `$lkm-explorer` and returns a standalone package source delta plus audit notes. Synthesize validated source deltas into the initial final package only after each delta passes its own mapping checks.

### Turn 2: extend

Follow the single workflow in `lkm-explorer-sop.md`. Use the cold-start root
frontier unless the user explicitly names a different target. For each frontier
claim, run both the support channel and the open-question/conflict channel from
that SOP. For each accepted candidate batch, delegate an audited
`$lkm-explorer` source delta when useful, then merge it into the existing
final package without silently changing prior emitted statements.

### Turn 3: traverse and purge duplication

Delegate duplicate discovery and semantic merge review when the graph is nontrivial. The orchestrator reviews every proposed merge/equivalence/keep-distinct decision before applying it. Ambiguous cases default to keep-distinct.

### Render / publish outside local skills

Render/publish work uses the installed Gaia CLI or Gaia repo-provided publish
workflow. This local skill family does not define a separate render/publish
contract. If such work is delegated, first ensure package quality gates pass,
run the relevant Gaia commands (`gaia run render`, `gaia inspect starmap`, etc.), inspect
generated outputs, and report commands/results.

### Graph-only path

Delegate evidence-subgraph construction when there are multiple selected roots or dense evidence chains. Review the graph against the evidence-subgraph contract before handing it to any synthesis or publication step.

## Subagent prompt minimums

Every delegated task prompt should include:

- Workspace and exact target paths.
- Exact raw input files.
- Relevant skill files to read before acting.
- The atomic output expected.
- The checks to run and repair loop expectation.
- A prohibition on editing unrelated package areas.
- Required final report fields: files changed, commands run, pass/fail, open risks, deviations.

## Acceptance rule

An artifact is accepted only when:

- The orchestrator has independently inspected it.
- Required checks pass locally.
- Deviations are documented.
- The user-selection invariant is respected for new roots.
