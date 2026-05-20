#!/usr/bin/env python3
"""Validate SKILL.md frontmatter for cross-host loader compatibility.

Hard errors (exit code 1):
    - Missing or malformed YAML frontmatter block (no opening/closing `---`).
    - Missing ``name`` or ``description`` field.
    - ``name`` value does not match the parent directory name.
    - ``description`` length > 1024 characters (Codex CLI loader hard limit).

Soft warnings (print to stderr; promoted to errors with ``--strict``):
    - ``description`` contains a bare ``: `` (colon-space) outside backticks.
      Strict YAML parsers in some hosts read this as a nested mapping and
      truncate or reject the description.

Usage:
    python scripts/check_skill_frontmatter.py              # checks ./skills/
    python scripts/check_skill_frontmatter.py --strict     # warnings -> errors
    python scripts/check_skill_frontmatter.py path/to/skills
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

DESCRIPTION_LIMIT = 1024  # Codex CLI loader cap; binding across hosts.

_FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)
_FIELD_RE = re.compile(
    r"^([a-z_][a-z_0-9-]*):\s*(.*?)(?=^[a-z_][a-z_0-9-]*:|\Z)",
    re.M | re.S,
)


def parse_frontmatter(text: str) -> dict[str, str] | None:
    """Extract top-level scalar fields from YAML frontmatter.

    Returns ``None`` if no ``---`` frontmatter block is present at the start
    of the file. Multi-line values (continuation lines indented under a
    field) are joined into a single string with whitespace collapsed at the
    edges; nested mappings are not supported (none are used in this repo).
    """
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return None
    fields: dict[str, str] = {}
    for fm in _FIELD_RE.finditer(m.group(1)):
        fields[fm.group(1)] = fm.group(2).strip()
    return fields


def check_one(path: Path) -> tuple[list[str], list[str]]:
    """Validate one SKILL.md. Returns (errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []

    fm = parse_frontmatter(path.read_text(encoding="utf-8"))
    if fm is None:
        errors.append("missing or malformed YAML frontmatter")
        return errors, warnings

    name = fm.get("name")
    if not name:
        errors.append("missing `name:` field")
    elif name != path.parent.name:
        errors.append(
            f"name `{name}` does not match parent dir `{path.parent.name}`"
        )

    desc = fm.get("description")
    if not desc:
        errors.append("missing `description:` field")
    else:
        if len(desc) > DESCRIPTION_LIMIT:
            errors.append(
                f"description is {len(desc)} chars, "
                f"exceeds Codex CLI limit of {DESCRIPTION_LIMIT}"
            )
        desc_no_code = re.sub(r"`[^`]*`", "", desc)
        if ": " in desc_no_code:
            warnings.append(
                "description contains bare `: ` (colon-space) outside backticks; "
                "may trip strict YAML parsers"
            )

    return errors, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate SKILL.md frontmatter for cross-host compatibility."
    )
    parser.add_argument(
        "skills_dir",
        nargs="?",
        default="skills",
        help="Directory containing skill subdirectories (default: skills)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors (non-zero exit)",
    )
    args = parser.parse_args(argv)

    skills_dir = Path(args.skills_dir)
    if not skills_dir.is_dir():
        print(f"error: {skills_dir} is not a directory", file=sys.stderr)
        return 2

    skill_files = sorted(skills_dir.glob("*/SKILL.md"))
    if not skill_files:
        print(
            f"error: no SKILL.md files under {skills_dir}/*/",
            file=sys.stderr,
        )
        return 2

    fail_count = 0
    warn_count = 0
    for path in skill_files:
        errors, warnings = check_one(path)
        try:
            rel = path.relative_to(Path.cwd())
        except ValueError:
            rel = path
        if not errors and not warnings:
            print(f"OK   {rel}")
            continue
        for err in errors:
            print(f"FAIL {rel}: {err}", file=sys.stderr)
            fail_count += 1
        for warn in warnings:
            print(f"WARN {rel}: {warn}", file=sys.stderr)
            warn_count += 1

    summary = (
        f"\nchecked {len(skill_files)} skill(s): "
        f"{fail_count} error(s), {warn_count} warning(s)"
    )
    print(summary, file=sys.stderr)

    if fail_count or (args.strict and warn_count):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
