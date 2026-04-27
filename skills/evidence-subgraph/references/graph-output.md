# Graph Output Guide

## Minimum Artifacts

- graph source: `.dot`, Mermaid, or JSON
- rendered graph: PDF/PNG/SVG when requested
- audit table: Markdown or JSON
- raw retrieval/evidence files when available

## Human-readable node labels (mandatory)

Figures are read by **scientists and reviewers**, not only by agents.

1. **Primary `label` text:** short **natural-language** phrases in the **user’s working language** (default for Chinese-speaking users: **中文短句**，2–4 行以内), stating **what the proposition says** (实验/理论/方法/背景), not the database role alone.
2. **Technical id:** keep `gcn_*` / `gfac_*` **either** only in the **audit table** **or** once in parentheses on the node—**never** as the only readable text on the node.
3. **Root node:** use the **real claim id as the Graphviz node name** (e.g. `"gcn_f6058142144e4e00"`), with `label=` 中文「目标结论」+ 内容摘要 — **do not** use a generic node name like `ROOT` that does not map back to LKM.
4. **Empty LKM premises:** node `label` must say **无字前提**（或等价表述）并写明 **锚定哪几条 `steps`**（如「锚定步骤 1–3」），见 `premise-upstream-support.md`。
5. **Subgraph / graph `label`:** use the same natural language for **图例**（黑实线=…，蓝虚线=…）.

## CJK / Unicode rendering (Graphviz pit)

Default fonts (e.g. Helvetica) often **omit Chinese glyphs**. Set explicitly, e.g.:

```dot
graph [fontname="PingFang SC"];
node [fontname="PingFang SC"];
edge [fontname="PingFang SC"];
```

On Linux, prefer **`Noto Sans CJK SC`** or **`Source Han Sans SC`** if PingFang is unavailable. **Re-open the rendered PNG/SVG** to confirm glyphs did not silently substitute to tofu blocks.

## Edge labels

Use the **same human language** as the node labels for edge semantics, mapped to rubric classes in the legend, e.g.:

| Rubric (audit) | 中文边标签示例 |
|----------------|----------------|
| `direct_support` | 链式支撑 |
| `upstream_conclusion_support` | 文献支撑 |
| `context` / `weak_context` | 背景 |
| `verified_support` | 人工核验支撑 |

## Premium color system (Graphviz)

Default rainbow primaries look **cheap** on slides and posters. Prefer a **muted, publication-style** palette: one **dark anchor** for the root, **cool tints** for premises, **lilac / indigo** for upstream literature claims, **emerald** for a **second-hop** tier if used, and **slate mist** for **context** nodes. Keep **WCAG-ish** contrast: light fills use **dark slate** text (`#0f172a`–`#1e293b`); only the **root** may use **inverted** colors (light text on deep fill).

### Recommended hex roles (copy-paste)

| Role | `fillcolor` | `color` (stroke) | `fontcolor` |
|------|-------------|------------------|-------------|
| Graph canvas | `bgcolor="#eef2f6"` | — | `fontcolor="#475569"` (graph label) |
| Cluster panel | `fillcolor="#ffffff"` | `color="#cbd5e1"` | — |
| **Root conclusion** | `#1e293b` | `#0f172a` | `#f1f5f9` |
| **Native premises** | `#e0f2fe` | `#0284c7` | `#0c4a6e` |
| **Upstream (support)** | `#eef2ff` | `#4f46e5` | `#312e81` |
| **Upstream tier-2+** (optional) | `#d1fae5` | `#047857` | `#064e3b` |
| **Intermediate hub** (chain-backed upstream reused as subgraph root) | `#ede9fe` | `#6d28d9` | `#4c1d95` |
| **Context / contrast** | `#f1f5f9` | `#64748b` | `#334155` |

### Edge colors

| Edge class | `color` | `style` | `penwidth` |
|------------|---------|---------|------------|
| `direct_support` | `#0f172a` | solid | `2.0`–`2.4` |
| `upstream_conclusion_support` | `#4338ca` | dashed | `1.5`–`1.8` |
| `context` | `#64748b` | dotted | `1.1`–`1.3` |

### Layout polish

```dot
graph [
  bgcolor="#eef2f6",
  splines=true,
  nodesep=0.32,
  ranksep=0.48,
  pad=0.22,
  fontname="PingFang SC"
];
```

Use `style="rounded,filled"` on **clusters** with a **white** or **very light** `fillcolor` so grouped nodes read as **panels**, not floating shapes.

## Role hints inside labels

Use short role hints **inside** the natural-language label, not instead of it:

- `目标结论` + 一句话
- `链内前提` + 一句话或「无字 + 步骤锚」
- `上游结论` + 一句话

When the graph is conclusion-rooted, **visually separate** root vs premises vs upstream conclusions (e.g. root = filled polygon, premise = note shape, upstream = box).

## Upstream support edges

If you use Graphviz colors for `upstream_conclusion_support` (see `SKILL.md`), keep a **legend** in the graph `label` or caption so PDFs are self-explanatory.

## Graphviz

Prefer automatic layout:

```bash
sfdp -Tpdf graph.dot -o graph.pdf
sfdp -Tpng graph.dot -o graph.png
```

Avoid manual constraints unless the automatic layout is unreadable.

## Verification

Before finalizing:

- count nodes and edges
- check cycles
- confirm every displayed chain has all premises
- confirm context edges are not described as dependencies
- **read every node label aloud**: would a non-implementer know **what** each box is?
- inspect the rendered graph visually (**CJK legibility**)
