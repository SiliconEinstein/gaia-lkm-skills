# Evidence Edge Audit Rubric

## Support Edge Test

Draw an edge as support only if:

1. The upstream statement would make the downstream premise more credible.
2. The support direction is correct.
3. The upstream node's own reasoning/evidence, if available, supports the part being used.
4. Removing the upstream node would weaken the downstream premise, not merely remove useful background.

## Relation Classes

- `direct_support`: explicit returned evidence-chain edge.
- `verified_support`: manually verified support not directly returned as the downstream chain.
- `upstream_conclusion_support`: manually verified support where the **upstream node is a prior paper’s conclusion-type claim** (or equivalent standalone result) and **propositional content**—not wording—supports a **downstream premise** of the user’s root conclusion. See `references/premise-upstream-support.md`.
- `context`: relevant background, method, definition, or experimental setting.
- `weak_context`: generic or cross-system background.
- `reversed`: downstream conclusion retrieved as upstream support.
- `duplicate`: same claim or restatement.
- `noise`: lexical hit without reasoning role.
- `unresolved`: relevant but not inspected enough.

## Loop Policy

Break cycles created only by semantic retrieval. Keep a cycle only when explicit reasoning chains prove mutual dependence and the domain genuinely requires it.

## Common False Positives

- **lexical hit, no inferential link** to the specific premise (especially across subfields or homonyms)
- shared keywords but different system
- generic formulas used as if they proved case-specific values
- method terms matching across unrelated fields
- reviews retrieving original papers in the wrong direction
- empty premises without chains
