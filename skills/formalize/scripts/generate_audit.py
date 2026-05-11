#!/usr/bin/env python3
"""Generate `graph_growth_log.jsonl` + `mapping_audit.md` from a `$formalize` package.

Reads `src/<pkg>/paper_<key>.py` + `src/<pkg>/priors.py` via Python AST,
extracts every `claim(...)`, `question(...)` and `deduction(...)` call plus the
`PRIORS` dict, and emits the two audit-trail files required by the
`$gaia-package` contract:

  artifacts/paper-extract/graph_growth_log.jsonl  (v1 schema, append-only)
  artifacts/paper-extract/mapping_audit.md        (human-readable tables)

Standard library only — no third-party deps. Reads no environment variables.

Usage:
    python3 generate_audit.py <package-dir>
    python3 generate_audit.py <package-dir> --dry-run

Motivation:
    Phase 4 of the `$formalize` workflow requires emitting one
    `graph_growth_log.jsonl` event per claim / deduction / prior, plus a
    matching `mapping_audit.md` row. For a package with N conclusions and
    M weak points, this is at minimum N + M + (N+M) + (N+M) ≈ 4*(N+M) lines
    of structured JSON to hand-author. For a typical paper this is
    25-50 lines of repetitive boilerplate that drifts away from the
    Python source over time.

    This helper extracts everything from the existing Python via AST so the
    audit is regenerated deterministically from the source of truth. Run it
    after Phase 4 emits paper_<key>.py + priors.py and before quality-gate
    review.

Notes:
    - Schema follows `$gaia-package/references/audit-log.md` v1 paper-extract subset:
      `package_initialized`, `accepted_claim` (with claim_kind, plus
      node_kind="question" for motivation / open-question nodes),
      `accepted_deduction`, `prior_added`. No candidate-handling events.
    - Logical-order seq per §7: init → question nodes → conclusion claims →
      weak-point claims → priors → deductions.
    - Timestamps use a deterministic seq-based offset so reruns are stable.
    - `actor_id` is a per-run UUID4 prefix; rerunning produces a new actor_id
      so historical events from earlier runs (if any) remain distinguishable.
    - The script is permissive about missing fields (e.g., claim without
      explicit claim_kind defaults to empty string in the payload).
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _kw_value(kw: ast.keyword) -> Any:
    """Resolve a keyword argument's value to a Python literal or list of names/literals."""
    val = kw.value
    if isinstance(val, ast.Constant):
        return val.value
    if isinstance(val, ast.List):
        out = []
        for elt in val.elts:
            if isinstance(elt, ast.Constant):
                out.append(elt.value)
            elif isinstance(elt, ast.Name):
                out.append(elt.id)
            else:
                out.append(None)
        return out
    return None


def parse_paper_file(
    path: Path,
) -> tuple[
    list[tuple[str, dict]],
    list[tuple[str, dict]],
    list[tuple[str, list[str], str | None, dict]],
]:
    """Return (claims, questions, deductions).

    claims:    list of (var_name, kwargs_dict) — kwargs includes 'body' from positional arg
    questions: list of (var_name, kwargs_dict) — kwargs includes 'body' from positional arg
    deductions: list of (var_name, premises, conclusion, kwargs_dict)
    """
    with open(path) as fh:
        tree = ast.parse(fh.read())

    claims: list[tuple[str, dict]] = []
    questions: list[tuple[str, dict]] = []
    deductions: list[tuple[str, list[str], str | None, dict]] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        if len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
            continue
        var_name = node.targets[0].id
        if not isinstance(node.value, ast.Call):
            continue
        func = node.value.func
        if not isinstance(func, ast.Name):
            continue

        kwargs: dict[str, Any] = {}
        for kw in node.value.keywords:
            kwargs[kw.arg] = _kw_value(kw)

        if func.id == "claim":
            body = ""
            if node.value.args and isinstance(node.value.args[0], ast.Constant):
                body = node.value.args[0].value
            kwargs["body"] = body
            claims.append((var_name, kwargs))
        elif func.id == "question":
            body = ""
            if node.value.args and isinstance(node.value.args[0], ast.Constant):
                body = node.value.args[0].value
            kwargs["body"] = body
            questions.append((var_name, kwargs))
        elif func.id == "deduction":
            premises: list[str] = []
            conclusion: str | None = None
            if node.value.args:
                premises_node = node.value.args[0]
                if isinstance(premises_node, ast.List):
                    premises = [
                        elt.id for elt in premises_node.elts
                        if isinstance(elt, ast.Name)
                    ]
                if len(node.value.args) > 1:
                    conclusion_node = node.value.args[1]
                    if isinstance(conclusion_node, ast.Name):
                        conclusion = conclusion_node.id
            deductions.append((var_name, premises, conclusion, kwargs))

    return claims, questions, deductions


def parse_priors_file(path: Path) -> dict[str, tuple[float, str]]:
    """Return {var_name: (prior_value, justification)} from PRIORS dict in priors.py."""
    with open(path) as fh:
        tree = ast.parse(fh.read())

    priors: dict[str, tuple[float, str]] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if not (isinstance(target, ast.Name) and target.id == "PRIORS"):
                continue
            if not isinstance(node.value, ast.Dict):
                continue
            for k, v in zip(node.value.keys, node.value.values):
                if not isinstance(k, ast.Name):
                    continue
                if not isinstance(v, ast.Tuple) or len(v.elts) < 2:
                    continue
                prior_val = v.elts[0].value if isinstance(v.elts[0], ast.Constant) else None
                justification = ""
                if isinstance(v.elts[1], ast.Constant):
                    justification = v.elts[1].value
                if prior_val is not None:
                    priors[k.id] = (prior_val, justification)
    return priors


def _make_event_factory(actor_id: str, base_time: datetime, package_name: str):
    """Closure-bound event factory that auto-increments seq + emits stable timestamps.

    Every event carries the mandatory `audit_files` array and a per-event
    `gaia_actions` array (schema §17). Callers pass `gaia_actions` describing
    the source-language call(s) that produced the event.
    """
    seq_state = {"n": 0}

    def make_event(
        decision: str,
        payload: dict,
        graph_delta: dict,
        gaia_actions: list[dict],
        extra: dict | None = None,
    ) -> dict:
        seq_state["n"] += 1
        seq = seq_state["n"]
        # Deterministic timestamp: base_time + seq * 1ms (approximately).
        # Use the same ISO-8601 string for both `timestamp_utc` and the
        # `event_id` prefix (schema §3 example).
        ts = base_time.strftime("%Y-%m-%dT%H:%M:%S.") + f"{seq:03d}Z"
        decision_token = "init" if decision == "package_initialized" else decision
        event = {
            "schema_version": "1",
            "event_id": f"{ts}__{actor_id}__{decision_token}__{seq}",
            "timestamp_utc": ts,
            "stage": "mapping",
            "round_id": "round_0000",
            "actor": "formalize",
            "actor_id": actor_id,
            "seq": seq,
            "decision": decision,
            "phase": 4,
        }
        if extra:
            event.update(extra)
        event["payload"] = payload
        event["graph_delta"] = graph_delta
        event["gaia_actions"] = gaia_actions
        event["audit_files"] = ["artifacts/paper-extract/mapping_audit.md"]
        return event

    return make_event


def build_events(
    pkg_dir: Path,
    paper_key: str,
    paper_file_rel: str,
    priors_file_rel: str,
    claims: list[tuple[str, dict]],
    questions: list[tuple[str, dict]],
    deductions: list[tuple[str, list[str], str | None, dict]],
    priors: dict[str, tuple[float, str]],
) -> list[dict]:
    """Build the full event list per gaia-package audit-log v1 paper-extract subset.

    Logical order (schema §7): init → all question nodes → all conclusion
    claims → all weak-point claims → all priors → all deductions.
    """
    actor_id = f"formalize-{uuid.uuid4().hex[:8]}"
    base_time = datetime.now(timezone.utc)
    make_event = _make_event_factory(actor_id, base_time, pkg_dir.name)

    events: list[dict] = []
    empty_delta = {
        "nodes_added": [],
        "edges_added": [],
        "nodes_removed": [],
        "edges_removed": [],
    }

    # 1. package_initialized
    events.append(make_event(
        "package_initialized",
        {"package_name": pkg_dir.name, "source_paper": paper_key},
        {**empty_delta},
        [{"action": "init", "symbol": pkg_dir.name, "file": paper_file_rel}],
    ))

    # 2. accepted_claim per question() — motivation + opt-in open-question nodes.
    #    Emitted before conclusion claims so the motivation node is on the
    #    starmap when the first conclusion lands (schema §8).
    for var_name, kw in questions:
        events.append(make_event(
            "accepted_claim",
            {
                "label": var_name,
                "node_kind": "question",
                "title": kw.get("title", "") or "",
                "source_paper": kw.get("source_paper", paper_key) or paper_key,
                "provenance_source": kw.get("provenance_source", "paper_extract") or "paper_extract",
                "body_excerpt": (kw.get("body", "") or "")[:200],
            },
            {
                "nodes_added": [{
                    "id": var_name,
                    "kind": "question",
                    "label": (kw.get("title", var_name) or var_name)[:80],
                    "source_paper": kw.get("source_paper", paper_key) or paper_key,
                    "content_excerpt": (kw.get("body", "") or "")[:200],
                }],
                "edges_added": [],
                "nodes_removed": [],
                "edges_removed": [],
            },
            [{"action": "question", "symbol": var_name, "file": paper_file_rel}],
        ))

    # 3. accepted_claim per claim() — conclusions first, then weak_points
    #    (schema §7 logical order).
    def _claim_sort_key(item: tuple[str, dict]) -> tuple[int, int]:
        kind = item[1].get("claim_kind") or ""
        # conclusions before weak_points before anything else
        if kind == "conclusion":
            return (0, 0)
        if kind == "weak_point":
            return (1, 0)
        return (2, 0)

    sorted_claims = sorted(
        enumerate(claims),
        key=lambda iv: (_claim_sort_key(iv[1]), iv[0]),
    )
    for _, (var_name, kw) in sorted_claims:
        prior_val = priors.get(var_name, (None,))[0]
        claim_kind = kw.get("claim_kind", "") or ""
        payload: dict[str, Any] = {
            "label": var_name,
            "claim_kind": claim_kind,
            "node_kind": "claim",
            "title": kw.get("title", "") or "",
            "source_paper": kw.get("source_paper", paper_key) or paper_key,
            "provenance_source": kw.get("provenance_source", "paper_extract") or "paper_extract",
            "body_excerpt": (kw.get("body", "") or "")[:200],
        }
        # weak_point payload: include p1 / p2 / conclusion_id / weak_types
        # only when the source actually carried them (audit-log §8).
        if claim_kind == "weak_point":
            for fld in ("p1", "p2", "conclusion_id", "weak_types"):
                if fld in kw and kw[fld] is not None:
                    payload[fld] = kw[fld]
        elif claim_kind == "conclusion":
            for fld in ("conclusion_id", "review_prior"):
                if fld in kw and kw[fld] is not None:
                    payload[fld] = kw[fld]

        events.append(make_event(
            "accepted_claim",
            payload,
            {
                "nodes_added": [{
                    "id": var_name,
                    "kind": "claim",
                    "label": (kw.get("title", var_name) or var_name)[:80],
                    "source_paper": kw.get("source_paper", paper_key) or paper_key,
                    "prior": prior_val,
                    "content_excerpt": (kw.get("body", "") or "")[:200],
                }],
                "edges_added": [],
                "nodes_removed": [],
                "edges_removed": [],
            },
            [{"action": "claim", "symbol": var_name, "file": paper_file_rel}],
        ))

    # 4. prior_added per priors.py entry — emitted before deductions so
    #    deduction premises already carry priors at replay time (schema §7).
    for var_name, (prior_val, justification) in priors.items():
        events.append(make_event(
            "prior_added",
            {
                "label": var_name,
                "prior": prior_val,
                "justification": justification,
            },
            {**empty_delta},
            [{"action": "set_prior", "symbol": var_name, "file": priors_file_rel}],
        ))

    # 5. accepted_deduction per deduction() — one event per call, expanded
    #    into N slim edges (one per premise → conclusion pair) per §5a.
    for var_name, premises, conclusion, kw in deductions:
        warrant_prior = kw.get("prior")
        reason_full = kw.get("reason", "") or ""
        edges = [
            {
                "from": prem,
                "to": conclusion,
                "kind": "deduction",
                "prior": warrant_prior,
            }
            for prem in premises
        ]
        events.append(make_event(
            "accepted_deduction",
            {
                "premises": premises,
                "conclusion": conclusion,
                "reason_excerpt": reason_full[:200],
            },
            {
                "nodes_added": [],
                "edges_added": edges,
                "nodes_removed": [],
                "edges_removed": [],
            },
            # `deduction(...)` is anonymous strategy: symbol is null per §5a,
            # even though the AST may bind it to a `gfac_*` name.
            [{"action": "deduction", "symbol": None, "file": paper_file_rel}],
            extra={"warrant_prior": warrant_prior},
        ))

    return events


def build_audit_md(
    pkg_dir: Path,
    paper_key: str,
    claims: list[tuple[str, dict]],
    questions: list[tuple[str, dict]],
    deductions: list[tuple[str, list[str], str | None, dict]],
    priors: dict[str, tuple[float, str]],
) -> str:
    """Build human-readable mapping_audit.md (Conclusions / Weak Points / Deductions tables)."""
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    def _esc(s: str | None, n: int = 120) -> str:
        s = (s or "")[:n].replace("\n", " ").replace("|", "\\|")
        return s

    lines = [
        f"# Mapping Audit — {pkg_dir.name}",
        "",
        f"Generated: {now_iso}",
        f"Source paper: {paper_key}",
        f"Generated by: `generate_audit.py` (formalize helper script)",
        "",
        "## Conclusions",
        "",
        "| Label | Title | Prior | Source Paper | Body excerpt |",
        "|---|---|---|---|---|",
    ]
    for var_name, kw in claims:
        if kw.get("claim_kind") != "conclusion":
            continue
        prior_val = priors.get(var_name, (None,))[0]
        lines.append(
            f"| `{var_name}` | {_esc(kw.get('title'), 80)} | "
            f"{prior_val if prior_val is not None else '—'} | "
            f"{kw.get('source_paper', paper_key) or paper_key} | "
            f"{_esc(kw.get('body'), 120)}... |"
        )

    lines.extend([
        "",
        "## Weak Points",
        "",
        "| Label | Title | weak_types | Prior | Justification excerpt |",
        "|---|---|---|---|---|",
    ])
    for var_name, kw in claims:
        if kw.get("claim_kind") != "weak_point":
            continue
        prior_val = priors.get(var_name, (None,))[0]
        justif = priors.get(var_name, (None, ""))[1]
        weak_types = ", ".join(kw.get("weak_types", []) or [])
        lines.append(
            f"| `{var_name}` | {_esc(kw.get('title'), 80)} | "
            f"{weak_types} | "
            f"{prior_val if prior_val is not None else '—'} | "
            f"{_esc(justif, 100)}... |"
        )

    lines.extend([
        "",
        "## Deductions",
        "",
        "| Label | Premises | Conclusion | Prior | Reason excerpt |",
        "|---|---|---|---|---|",
    ])
    for var_name, premises, conclusion, kw in deductions:
        prem_cells = ", ".join(f"`{p}`" for p in premises) if premises else "—"
        lines.append(
            f"| `{var_name}` | {prem_cells} | "
            f"`{conclusion}` | "
            f"{kw.get('prior') if kw.get('prior') is not None else '—'} | "
            f"{_esc(kw.get('reason'), 120)}... |"
        )

    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate graph_growth_log.jsonl + mapping_audit.md from a $formalize package.",
    )
    parser.add_argument("package_dir", help="Path to the <name>-gaia/ package directory.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print summary to stdout without writing files.")
    args = parser.parse_args(argv)

    pkg_dir = Path(args.package_dir).resolve()
    if not pkg_dir.is_dir():
        print(f"ERROR: not a directory: {pkg_dir}", file=sys.stderr)
        return 1

    src_root = pkg_dir / "src"
    if not src_root.is_dir():
        print(f"ERROR: missing src/ in {pkg_dir}", file=sys.stderr)
        return 1

    src_subs = [p for p in src_root.iterdir() if p.is_dir()]
    if not src_subs:
        print(f"ERROR: no subdirectory under src/ in {pkg_dir}", file=sys.stderr)
        return 1
    src = src_subs[0]

    paper_files = list(src.glob("paper_*.py"))
    if not paper_files:
        print(f"ERROR: no paper_*.py in {src}", file=sys.stderr)
        return 1
    paper_file = paper_files[0]
    paper_key = paper_file.stem.removeprefix("paper_")
    paper_file_rel = str(paper_file.relative_to(pkg_dir))

    priors_file = src / "priors.py"
    if not priors_file.is_file():
        print(f"WARN: no priors.py in {src} — proceeding with empty priors.",
              file=sys.stderr)
        priors: dict[str, tuple[float, str]] = {}
        priors_file_rel = str((src / "priors.py").relative_to(pkg_dir))
    else:
        priors = parse_priors_file(priors_file)
        priors_file_rel = str(priors_file.relative_to(pkg_dir))

    claims, questions, deductions = parse_paper_file(paper_file)
    events = build_events(
        pkg_dir, paper_key, paper_file_rel, priors_file_rel,
        claims, questions, deductions, priors,
    )
    audit_md = build_audit_md(pkg_dir, paper_key, claims, questions, deductions, priors)

    if args.dry_run:
        print(f"DRY RUN — would write to {pkg_dir / 'artifacts/paper-extract'}")
        print(f"  graph_growth_log.jsonl: {len(events)} events")
        print(
            f"  mapping_audit.md: {len(claims)} claims + {len(questions)} questions + "
            f"{len(deductions)} deductions"
        )
        for ev in events:
            print(json.dumps(ev, ensure_ascii=False))
        return 0

    audit_dir = pkg_dir / "artifacts" / "paper-extract"
    audit_dir.mkdir(parents=True, exist_ok=True)

    log_path = audit_dir / "graph_growth_log.jsonl"
    with open(log_path, "w") as fh:
        for ev in events:
            fh.write(json.dumps(ev, ensure_ascii=False) + "\n")
    print(f"✓ Wrote {len(events)} events → {log_path}")

    audit_path = audit_dir / "mapping_audit.md"
    with open(audit_path, "w") as fh:
        fh.write(audit_md)
    print(
        f"✓ Wrote {len(claims)} claims + {len(questions)} questions + "
        f"{len(deductions)} deductions → {audit_path}"
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
