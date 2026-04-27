# Premise → prior paper conclusion (upstream support)

## Why this exists

Many downstream **conclusions** rest on **premises** that are not “atomic facts” from a single experiment; they are often **already established conclusions** of earlier papers. Those upstream conclusions rarely match the premise **verbatim** in language. Retrieval must therefore optimize for **propositional content overlap** and **inferential direction**, not string similarity.

## Step 0 — root must expose LKM evidence chains (default)

**First** obtain a **root claim** for which `GET /claims/{id}/evidence` returns **`total_chains > 0`**. Only then does “trace premises backward” mean anything in LKM: the premise IDs and chain topology are **authoritative inputs** to the worklist.

- If the user’s initial ID has **`total_chains == 0`**, the agent must **not** default to inventing synthetic premises. Instead: **search + probe evidence** on candidates until a chain-backed root is found, **or** the user explicitly authorizes a **documented chain-less / synthetic** mode.
- Synthetic premise decomposition remains a **last-resort** path, never the silent default.

## Agent effort budget (non-negotiable when the user roots on a conclusion)

Treat the premise list as a **worklist**, not a side effect.

1. **Enumerate** every premise attached to the root conclusion (all chains, including empty placeholders)—**after** Step 0 confirms packaged chains exist (unless waived).
2. **Per premise**, perform a deliberate upstream search pass before drawing support edges. A shallow single-query search is **insufficient** unless the premise is trivially definitional.
3. **Minimum depth heuristic** (adjust upward for long or compound premises):
   - at least **3 distinct search queries** per readable premise (different vocabulary: formalism, mechanism, quantity, negated/contrapositive framing, author/year if known from context);
   - fetch **evidence** for the top distinct **candidate** claims (not only rank-1);
   - record **near-misses** you reject (1 line each: why not support).

If a premise remains unsupported after disciplined search, mark it **`unresolved`** and say what evidence would change the verdict.

## Empty premise text and chain-internal premise IDs (common LKM pit)

Many packaged chains list premises with **`content: ""`** while still requiring both branches under `noisy_and` / similar factors.

1. **Do not** “invent” free-text premises to paste into the graph without documenting the source. **Do** copy the **factor `steps[].reasoning`** (or equivalent structured text) into the **audit** as the retrieval anchor when the premise body is empty.
2. **`GET /claims/{premise_id}/evidence` may return `claim not found`**: some premise IDs exist **only as children inside a parent chain** and are not first-class searchable claims. Treat that response as **expected**, not a retrieval failure; keep using the **parent `evidence` JSON`** as the authority for topology.
3. **Per-premise query bundles still apply:** derive search queries from the **step text grouped to that premise** (e.g. steps 1–3 vs 4–6 when the factor orders narrative that way). Record in the audit table: `premise_id`, `anchor_step_ids`, `query_count`, `rationale`.

## Multi-hop (“deeper”) expansion

When an **`upstream_conclusion_support`** node itself has **`total_chains > 0`** on `evidence`, **repeat the same workflow** for that node: list its native premises, run per-premise bundles, classify tier-2 edges, then render an extended graph (or a layered figure). Stop when:

- further `evidence` calls return `total_chains == 0`, or  
- the user caps depth, or  
- continued expansion would only duplicate the root package without new propositional content.

Mark each tier in the audit header (`Tier 0 root`, `Tier 1 upstream`, …).

## What counts as an “upstream paper conclusion”

Operational criteria (any discipline):

- The retrieved node is a **standalone proposition** that reads like a **paper-level result or synthesis** (conclusion, main claim, theorem statement, legal holding, etc.), not merely a method step or dataset row.
- Its **source package** is plausibly **prior or independent** of the root package when chronology matters (if unknown, say so and still audit content).
- The agent can articulate a **single bridging sentence**: “If we accept [upstream], then [premise] is more credible because …”

Do **not** require:

- identical wording, notation, or section labels;
- the upstream item to use the word “conclusion” in metadata.

## Content-based support test (stricter than keyword overlap)

Classify as **`upstream_conclusion_support`** (see audit rubric) only if **all** hold:

1. **Direction:** the upstream proposition is used as **support for** the premise, not the other way around.
2. **Propositional overlap:** the upstream content **entails, bounds, or materially strengthens** the specific part of the premise relied on by the root argument—not a generic topic match.
3. **No supersession confusion:** you are not citing a later review that merely **repeats** the premise’s paper without adding the actual prior result (avoid duplicate edges).
4. **Scope match:** same order of magnitude, same causal regime, same population/legal jurisdiction, etc., unless the premise explicitly generalizes.

If only (2) is weak, prefer **`weak_context`** or **`unresolved`** over a support edge.

## Graph conventions

- **Root node id:** use the **actual claim id** (e.g. `gcn_…`) as the Graphviz node name whenever possible—**avoid** opaque placeholders such as `ROOT` that do not round-trip to LKM.
- **Node `label` (human-facing):** use **short sentences in the user’s working language** (e.g. 中文短句) describing **propositional content**. Technical ids may appear **once** in parentheses or only in the audit file—**not** as the sole label on the figure.
- **Edge `label`:** use the same language for edge semantics (e.g. 链式支撑 / 文献支撑 / 背景), mapping to rubric classes in the legend.
- **Premises:** one node per premise instance; empty premises remain explicit with a **Chinese** (or locale) note like「链内前提（无字），锚定步骤 1–3」.
- **Upstream conclusions:** separate nodes; the audit column still carries the **English rubric class** (`upstream_conclusion_support`, etc.) for machine consistency.

## Anti-patterns

- One broad literature search for the whole paper instead of **per-premise** passes.
- Treating the highest lexical score as **verified_support** without the content test.
- Drawing edges from **definitions** or **instrument specs** to a substantive premise unless the premise is purely definitional.
- **Graph labels that are only `gcn_*` fragments or English role tokens** (`ROOT`, `prem`, `edc9`) without telling the reader **what the claim says**—this invalidates the figure for non-implementers.
- Assuming **`evidence` on a premise id** must succeed; failing to fall back to **parent-chain step anchoring** when it does not.
