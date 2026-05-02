# Shared-premise extraction procedure

Spelled-out algorithm for the dedup pass that runs after `lkm_io.collectPremises` and before `dsl_emit.emitClaim`. Cited by [`SKILL.md`](../SKILL.md) §"Shared-premise extraction".

## Why this exists

Two LKM premises that assert the same proposition will, if emitted as two distinct `claim(...)` calls without a coupling operator, be treated by Gaia's BP as **two independent observations of the underlying truth** — and BP will combine their priors as if they were independent evidence. That's correct *if* they really are independent (e.g. two labs measuring the same quantity), but **wrong** if they are the same proposition restated (e.g. an arXiv preprint and the published journal version of one paper). The wrong case is silent double-counting and is exactly what this procedure prevents.

The framing comes from the user's design constraint: "在写之前，需要 agent 去看一下两者的 reasoning 里面是不是还有共通的部分可以提炼出来，成为 share 的 premise claim，防止概率计算的时候 double counting".

## Decision matrix

For every pair of premises (`p_i`, `p_j`) collected across all loaded run-folders:

| condition | action |
|---|---|
| `p_i.id == p_j.id` (same `gcn_*`) | **auto-merge** — already one entry in `collectPremises`'s map; nothing to do |
| `normalize(p_i.content) == normalize(p_j.content)` AND content is non-empty | **auto-merge** — string-equal post-normalization; one canonical claim, both `lkm_id`s in `metadata.lkm_ids` |
| Pair is in `equivalences.json` with lineage tag `same_paper_different_version` | **auto-merge** — the lineage is a strong signal it's one proposition restated |
| Pair is in `equivalences.json` with lineage tag `independent_experimental`, `independent_theoretical`, or `cross_paradigm` | **keep distinct + emit `equivalence(...)` operator** — the independence is informative; the operator's warrant prior gates the BP boost so it stays correct |
| Pair is in `equivalences.json` with lineage tag `unclassified` | **surface to user** via `merge_decisions.todo` (default action: KEEP) |
| Cosine / Jaccard similarity on normalized content > threshold (default 0.85) AND not already in `equivalences.json` | **surface to user** via `merge_decisions.todo` (default action: KEEP) |
| All other pairs | **keep distinct, no operator** |

`normalize(s)` lowercases, collapses whitespace, strips trailing punctuation. Implementation lives in `lkm_io.mjs` (TODO: not yet wired; the canonical-claim table in batch mode currently only does the first three rules — text-equality and lineage-driven merge — pending a similarity-threshold helper).

## `merge_decisions.todo` schema

A `merge_decisions.todo` file is written to `artifacts/lkm-discovery/<run-folder-name>/` whenever the procedure surfaces ambiguous pairs. The file is consumed by a re-run of the skill (the skill re-loads it before re-running the procedure).

```yaml
# merge_decisions.todo — fill in MERGE or KEEP for every pair below, then re-run.
# Default if blank: KEEP (safe; no merge, no operator beyond what's already in equivalences.json).

- decision: ""              # MERGE | KEEP
  pair_id: "eq_root_ab"     # id from equivalences.json (or auto-generated for similarity-only candidates)
  origin: "equivalences"    # equivalences | similarity
  reason_for_surfacing: "lineage=unclassified"
  claims:
    - lkm_id: "gcn_root_a"
      content: "Tc of MgB2 is approximately 39 K."
      source_paper: "paper:p_an2001"
    - lkm_id: "gcn_root_b"
      content: "Independent XRD-coupled measurement: Tc of MgB2 is 39.2 +/- 0.3 K."
      source_paper: "paper:p_xrd2003"

- decision: ""
  pair_id: "sim_001"
  origin: "similarity"
  reason_for_surfacing: "cosine=0.91 on normalized content"
  claims: [...]
```

When the user fills in `MERGE`:

- The two premises collapse into one canonical claim (the longer-content one wins, or alphabetical tie-break).
- Both `lkm_id`s land in `metadata.lkm_ids`.
- If the pair was in `equivalences.json`, no `equivalence(...)` operator is emitted.

When the user fills in `KEEP` (the default):

- The two premises stay distinct.
- If the pair was in `equivalences.json`, the operator IS emitted per the mapping contract §3.
- If the pair was surfaced by similarity only, no operator is emitted (the agent has to add one explicitly if they want the coupling).

## `merge_audit.md`

Every dedup decision the procedure made is logged to `artifacts/lkm-discovery/merge_audit.md` (one file at the top of `lkm-discovery/`, not per-run-folder, so cross-run-folder merges are visible):

```markdown
# Merge audit log — <package name>

| canonical label | merged lkm_ids | rule |
|---|---|---|
| gcn_phonon_pairing | [gcn_phonon_pairing, gcn_phonon_pairing_v2] | text_equal |
| gcn_root_a | [gcn_root_a] | unique |
| (canonical=gcn_root_a) | [gcn_root_a, gcn_root_a_arxiv] | lineage=same_paper_different_version |

## Surfaced for user decision

- pair `eq_root_ab` (lineage=unclassified): user chose KEEP -> kept distinct, emitted equivalence(...)
- pair `sim_001` (cosine=0.91): user chose MERGE -> canonical=gcn_phonon_pairing
```

Read this file when investigating "why are the BP beliefs lower / higher than I expected on claim X?" — a wrong merge or wrong split is the most common cause of belief surprise on LKM-imported packages.

## Cross-run-folder considerations

When multiple run-folders are loaded together (multi-root mode):

- Premise dedup is **global across run-folders**, not per-folder. A premise that appears in run-folder A and run-folder B (same `gcn_*`) collapses to one canonical claim with `metadata.run_folders = [<A_name>, <B_name>]`.
- `equivalences.json` pairs are unioned across all run-folders. Conflicting lineage classifications across run-folders for the same pair are surfaced to `merge_decisions.todo` for human resolution.
- `contradictions.json` and `cross_validation.json` pairs are unioned similarly. Cap stays at top 10 per file (per the run-folder contract); when union exceeds the cap, the skill keeps the union as-is and emits a warning to `mapping_audit.md` (no automatic re-capping).

## What this procedure deliberately does NOT do

- It does **not** merge premises across different `gfac_*` factors that happen to share content but live in disagreeing chains (e.g. one chain claims premise X with prior 0.9 and another chain claims premise X with prior 0.3). Both premises are real and independent; if they coincidentally share text, that's a data-quality issue in the LKM corpus, not a merge candidate.
- It does **not** synthesize new equivalence operators that weren't in `equivalences.json`. The discovery-flag pass in `$evidence-graph-synthesis` is the authoritative source for what counts as an equivalence pair.
- It does **not** re-classify lineage. If `equivalences.json` says `unclassified`, this procedure does not guess the lineage; it surfaces the pair to the user.
