# LKM-Explorer Package Layout

> Generic Gaia knowledge-package layout, naming conventions, and file
> templates (`pyproject.toml`, `__init__.py`, `paper_<key>.py`,
> `references.json`) are owned upstream by `SiliconEinstein/Gaia` — see
> `docs/for-users/quick-start.md` and `docs/for-users/language-reference.md`.
> This file documents only the LKM-explorer module-routing convention.

## Module routing

`$lkm-explorer` writes one `paper_<key>.py` sibling per source paper. All
emissions for that paper — claims, deductions (factor-derived or warrant
support), cross-paper operators (`equal` / `contradict` / `exclusive`) that
mention this paper, and `register_prior(...)` calls — route to the same
sibling. There is no dedicated `cross_paper.py` or `priors.py` sibling; the
single per-paper module keeps the import-graph simple and the package
self-contained.

```text
<name>-gaia/
├── pyproject.toml
├── references.json
└── src/<import>/
    ├── __init__.py
    └── paper_<key>.py
```

Scaffold with:

```bash
gaia pkg scaffold --target <name>-gaia --name <name>-gaia --with-uuid \
    --description "<one-line description>"
gaia pkg add-module --target <name>-gaia --name paper_<key>
```

Subsequent papers add their own `paper_<key2>.py` via another `gaia pkg
add-module`. Cross-paper operators are emitted into whichever of the two
papers' sibling modules is more natural for the discussion.
