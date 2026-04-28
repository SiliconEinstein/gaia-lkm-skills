# Source Ground-Truth Loop (via `papers-ocr`)

LKM claims are extracted propositions; the **source paper** still holds the final authority over wording, figure captions, and numerical values. Whenever a `claim.provenance.source_packages[0]` corresponds to a `paper:<numeric_id>`, the agent can pull a cleaned OCR markdown via `$lkm-api`'s `papers-ocr` endpoint and use it as a **third, independent check** beyond LKM `search` and `evidence`.

This closes a verification loop:

```text
LKM search  ──▶ candidate claim text
LKM evidence ──▶ factor/premise topology
papers-ocr ──▶ ORIGINAL paper markdown + figures  ◀── final ground truth
```

## When to invoke

Pull the OCR markdown when **any** of the following hold:

1. The root conclusion's factor `steps[].reasoning` references specific **numerical values**, **figure numbers**, or **equation labels**. The cleaned markdown keeps LaTeX, Fig/Table captions, and Eq. numbers, so you can find the exact sentence.
2. You need to resolve a **near-miss** candidate (same paper family, different numerical report) before accepting or rejecting a verification-support edge. Reading the primary source usually settles direction and scope faster than running more search queries.
3. The paper may contain **multiple parallel results / sub-models** that LKM has split across several claims (e.g. one paper analysing both an XY and a Heisenberg variant, each with its own conclusion). The section structure in the markdown tells you how many sub-models to expect; if LKM has returned fewer claim ids, you know to search again.
4. You are about to write a `$scholarly-review`: reviewers will ask "does the paper actually say X?" — having the markdown open makes that direct.

## CLI usage (via `$lkm-api` helper)

```bash
# 1) fetch signed URLs
node skills/lkm-api/scripts/lkm.mjs papers-ocr \
  --ids 812114964624965633,paper:812079052750848000 \
  --out ocr.json

# 2) pull the markdown (signed URLs expire in 24 hours — download now)
mkdir -p sources
node -e '
const d=require("./ocr.json").data;
for (const it of d.items) {
  console.log(it.paper_id, it.markdown_url);
}
' | while read pid url; do
  curl -sS "$url" -o "sources/${pid}.md"
done
```

Images (figures, plots) can be pulled the same way from `items[].images[].url` when you need to inspect Fig. <n> data-collapse shapes.

## How to use the markdown in the audit

Add a **`source_page_anchor`** column (or sub-field) to the audit table for each premise / upstream edge. Typical anchors:

| What to cite | Example anchor |
| --- | --- |
| A section header | `§ RESULTS FOR THE J-Q MODEL` |
| A figure caption | `Fig. 12 caption, line 205 of sources/812114964624965633.md` |
| A specific equation | `Eq. (4), line 64` |
| A verbatim sentence | `"On the other hand, for the SU(2) symmetric J-Q model…" (SUMMARY)` |

Line numbers refer to the downloaded markdown (helpful for long papers). Attach them once in the audit so a reviewer can grep the same file.

### Minimal worked example

Root claim `gcn_efdd79a286bf4c0e` (Sandvik 2006, `paper:812114964624965633`) references `Δ/Q ≈ 0.066` inside `steps[0].reasoning`. The OCR markdown's **Figure 12 caption** reads:

> FIGURE 12. … the solid curve is a cubic fit to the J/Q=0 data, extrapolating to **Δ(L=∞)/Q ≈ 0.066**. The dashed line shows the linear in 1/L behavior expected at a quantum-critical point with z=1.

That single line ratifies the claim's numerical content. Record it as `source_page_anchor = "Fig. 12 caption"` next to the verification-support edge from the same-package conclusion.

## Cross-checking multi-sub-model papers

For papers that LKM has split into several claims (one per sub-model), the markdown's **section headers** give you an enumeration:

```bash
grep -nE "^#+ " sources/<paper_id>.md
```

Compare that list with the claims you already have from `search` / same-package queries. If the markdown lists `RESULTS FOR <model A>` and `RESULTS FOR <model B>` but your LKM set only covers A, run targeted `search` queries for B's terminology (model name, key coupling, distinctive result) before closing the subgraph. Document the gap in the audit under "unresolved".

## Do not promote OCR text into synthetic premises

The markdown is an **auditing anchor**, not a new premise source. Do not type paraphrases of OCR paragraphs into the graph as if they were LKM premises — that quietly switches the subgraph from chain-backed to synthetic. When the original paper contains content LKM has not extracted, either:

- file it as `unresolved` with `source_page_anchor` pointing at the markdown, or
- if the claim is important enough to trace upstream, return to `$lkm-api` and run a new per-claim search (LKM may have the result under a different `source_package`).

## Caching & re-fetch discipline

- Store OCR responses under `sources/` with the paper_id as filename; keep the raw `ocr.json` alongside so you know when `expires_at` was.
- Re-issue `papers-ocr` whenever the TOS signatures expire (>24h). Content behind them is stable, so re-downloading is idempotent.
- Do **not** commit the downloaded markdown into the skill repo — the OCR output belongs to the paper's rights holder. Keep it in working directories only.
