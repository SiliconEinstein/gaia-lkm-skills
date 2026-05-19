#!/usr/bin/env python3
"""Sync Apifox OpenAPI export into an agent-friendly Markdown contract."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


APIFOX_EXPORT_URL = "https://api.apifox.com/v1/projects/{project_id}/export-openapi"
APIFOX_API_VERSION = "2024-03-28"
HTTP_METHODS = ("get", "post", "put", "patch", "delete", "head", "options")
DEFAULT_INCLUDE_PATHS = [
    "/search",
    "/claims/{id}/reasoning",
    "/reasoning/search",
    "/variables/batch",
    "/papers/graph",
]


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def fetch_openapi(project_id: str, token: str) -> dict[str, Any]:
    body = {
        "oasVersion": "3.1",
        "exportFormat": "JSON",
        "scope": {"type": "ALL"},
    }
    req = urllib.request.Request(
        APIFOX_EXPORT_URL.format(project_id=project_id),
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Apifox-Api-Version": APIFOX_API_VERSION,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Apifox export failed: HTTP {exc.code}: {text}") from exc

    if isinstance(payload, dict) and "openapi" in payload:
        return payload
    if isinstance(payload, dict):
        for key in ("data", "spec", "openapiData"):
            value = payload.get(key)
            if isinstance(value, dict) and "openapi" in value:
                return value
            if isinstance(value, str):
                parsed = json.loads(value)
                if isinstance(parsed, dict) and "openapi" in parsed:
                    return parsed
    raise RuntimeError("Apifox response did not contain an OpenAPI document")


def resolve_ref(schema: Any, document: dict[str, Any]) -> Any:
    if not isinstance(schema, dict) or "$ref" not in schema:
        return schema
    ref = schema["$ref"]
    if not isinstance(ref, str) or not ref.startswith("#/"):
        return schema
    current: Any = document
    for part in ref[2:].split("/"):
        part = part.replace("~1", "/").replace("~0", "~")
        current = current[part]
    merged = dict(current)
    for key, value in schema.items():
        if key != "$ref":
            merged[key] = value
    return merged


def merged_schema(schema: Any, document: dict[str, Any]) -> dict[str, Any]:
    schema = resolve_ref(schema, document)
    if not isinstance(schema, dict):
        return {}
    for combiner in ("allOf", "oneOf", "anyOf"):
        items = schema.get(combiner)
        if not isinstance(items, list):
            continue
        merged: dict[str, Any] = {k: v for k, v in schema.items() if k != combiner}
        properties: dict[str, Any] = {}
        required: list[str] = []
        descriptions: list[str] = []
        for item in items:
            child = merged_schema(item, document)
            properties.update(child.get("properties", {}))
            required.extend(child.get("required", []))
            if child.get("description"):
                descriptions.append(str(child["description"]))
            for key, value in child.items():
                if key not in {"properties", "required", "description"}:
                    merged.setdefault(key, value)
        if properties:
            merged["properties"] = properties
        if required:
            merged["required"] = sorted(set(required))
        if descriptions and not merged.get("description"):
            merged["description"] = " ".join(descriptions)
        return merged
    return schema


def schema_type(schema: dict[str, Any], document: dict[str, Any]) -> str:
    schema = merged_schema(schema, document)
    if "enum" in schema and not schema.get("type"):
        return "enum"
    raw_type = schema.get("type")
    if isinstance(raw_type, list):
        return " | ".join(str(item) for item in raw_type)
    if raw_type == "array":
        item_type = schema_type(schema.get("items", {}), document)
        return f"{item_type}[]"
    if raw_type:
        return str(raw_type)
    if "properties" in schema:
        return "object"
    return "unknown"


def description_for(schema: dict[str, Any]) -> str:
    bits: list[str] = []
    description = schema.get("description") or schema.get("title")
    if description:
        bits.append(str(description).replace("\n", " ").strip())
    enum = schema.get("enum")
    if isinstance(enum, list) and enum:
        bits.append("Enum: " + ", ".join(f"`{item}`" for item in enum) + ".")
    return " ".join(bits)


def default_for(schema: dict[str, Any]) -> str:
    if "default" not in schema:
        return ""
    value = schema["default"]
    if value is None:
        return "`null`"
    if isinstance(value, (dict, list)):
        return f"`{json.dumps(value, ensure_ascii=False)}`"
    return f"`{value}`"


def escape_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("|", "\\|").replace("\n", " ").strip()


def flatten_schema(
    schema: Any,
    document: dict[str, Any],
    *,
    prefix: str = "",
    required_names: set[str] | None = None,
    seen_refs: set[str] | None = None,
) -> list[dict[str, str]]:
    if seen_refs is None:
        seen_refs = set()
    if isinstance(schema, dict) and "$ref" in schema:
        ref = str(schema["$ref"])
        if ref in seen_refs:
            return []
        seen_refs = {*seen_refs, ref}
    schema = merged_schema(schema, document)
    if not schema:
        return []

    rows: list[dict[str, str]] = []
    schema = merged_schema(schema, document)
    required_names = required_names or set(schema.get("required", []))
    raw_properties = schema.get("properties")
    if isinstance(raw_properties, dict):
        local_required = set(schema.get("required", []))
        for name, child_schema in raw_properties.items():
            child = merged_schema(child_schema, document)
            path = f"{prefix}.{name}" if prefix else name
            rows.append(
                {
                    "field": path,
                    "type": schema_type(child, document),
                    "required": "yes" if name in local_required else "no",
                    "default": default_for(child),
                    "description": description_for(child),
                }
            )
            child_type = schema_type(child, document)
            if child_type.endswith("[]"):
                item_schema = merged_schema(child.get("items", {}), document)
                rows.extend(
                    flatten_schema(
                        item_schema,
                        document,
                        prefix=f"{path}[]",
                        required_names=set(item_schema.get("required", [])),
                        seen_refs=seen_refs,
                    )
                )
            elif child_type == "object" or "properties" in child:
                rows.extend(
                    flatten_schema(
                        child,
                        document,
                        prefix=path,
                        required_names=set(child.get("required", [])),
                        seen_refs=seen_refs,
                    )
                )
        return rows

    if prefix:
        rows.append(
            {
                "field": prefix,
                "type": schema_type(schema, document),
                "required": "yes" if prefix in required_names else "no",
                "default": default_for(schema),
                "description": description_for(schema),
            }
        )
    return rows


def schema_table(schema: Any, document: dict[str, Any]) -> str:
    rows = flatten_schema(schema, document)
    if not rows:
        return "_No JSON schema published in the OpenAPI export._"
    lines = [
        "| Field | Type | Required | Default | Description |",
        "|-------|------|----------|---------|-------------|",
    ]
    for row in rows:
        lines.append(
            "| `{field}` | {type} | {required} | {default} | {description} |".format(
                field=escape_cell(row["field"]),
                type=escape_cell(row["type"]),
                required=escape_cell(row["required"]),
                default=escape_cell(row["default"]),
                description=escape_cell(row["description"]),
            )
        )
    return "\n".join(lines)


def json_schema_from_content(content: Any) -> Any:
    if not isinstance(content, dict):
        return None
    for content_type in (
        "application/json",
        "application/*+json",
        "text/json",
    ):
        media = content.get(content_type)
        if isinstance(media, dict) and "schema" in media:
            return media["schema"]
    for media in content.values():
        if isinstance(media, dict) and "schema" in media:
            return media["schema"]
    return None


def operation_parameters(operation: dict[str, Any], path_item: dict[str, Any]) -> list[dict[str, Any]]:
    params: list[dict[str, Any]] = []
    for source in (path_item.get("parameters"), operation.get("parameters")):
        if isinstance(source, list):
            params.extend(item for item in source if isinstance(item, dict))
    return params


def render_parameters(
    operation: dict[str, Any],
    path_item: dict[str, Any],
    document: dict[str, Any],
) -> str:
    params = operation_parameters(operation, path_item)
    if not params:
        return ""
    lines = [
        "### Parameters",
        "",
        "| Name | In | Type | Required | Default | Description |",
        "|------|----|------|----------|---------|-------------|",
    ]
    for param in params:
        param = merged_schema(param, document)
        schema = merged_schema(param.get("schema", {}), document)
        lines.append(
            "| `{name}` | {where} | {type} | {required} | {default} | {description} |".format(
                name=escape_cell(param.get("name", "")),
                where=escape_cell(param.get("in", "")),
                type=escape_cell(schema_type(schema, document)),
                required="yes" if param.get("required") else "no",
                default=escape_cell(default_for(schema)),
                description=escape_cell(param.get("description") or description_for(schema)),
            )
        )
    return "\n".join(lines)


def render_operation(
    method: str,
    path: str,
    path_item: dict[str, Any],
    operation: dict[str, Any],
    document: dict[str, Any],
) -> str:
    title = operation.get("summary") or operation.get("operationId") or ""
    lines = [f"## {method.upper()} {path}"]
    if title:
        lines.extend(["", str(title).strip()])
    description = operation.get("description")
    if description:
        lines.extend(["", str(description).strip()])

    params = render_parameters(operation, path_item, document)
    if params:
        lines.extend(["", params])

    request_body = operation.get("requestBody")
    if isinstance(request_body, dict):
        request_body = merged_schema(request_body, document)
        schema = json_schema_from_content(request_body.get("content"))
        if schema is not None:
            lines.extend(["", "### Request Body", "", schema_table(schema, document)])

    responses = operation.get("responses")
    if isinstance(responses, dict):
        success_response = None
        for status in ("200", "201", "202", "default"):
            if status in responses:
                success_response = responses[status]
                break
        if success_response is not None:
            response = merged_schema(success_response, document)
            schema = json_schema_from_content(response.get("content"))
            lines.extend(["", "### Response"])
            if response.get("description"):
                lines.extend(["", str(response["description"]).strip()])
            if schema is not None:
                lines.extend(["", schema_table(schema, document)])

    return "\n".join(lines).strip()


def render_contract(
    document: dict[str, Any],
    *,
    project_id: str,
    include_paths: list[str] | None = None,
) -> str:
    info = document.get("info", {}) if isinstance(document.get("info"), dict) else {}
    title = info.get("title", "Apifox OpenAPI Contract")
    version = info.get("version", "")
    lines = [
        "# API Contract",
        "",
        "<!-- DO NOT EDIT BY HAND. Regenerate with `python scripts/sync_apifox.py`. -->",
        "",
        "This file is auto-generated from the Apifox OpenAPI export.",
        f"Apifox project: `{project_id}`.",
        "",
        f"Source title: **{title}**" + (f" (`{version}`)." if version else "."),
        "",
        "Agent workflow, endpoint-selection guidance, known pitfalls, and CLI helper usage live in `SKILL.md`.",
    ]

    paths = document.get("paths", {})
    include_path_set = set(include_paths or [])
    if isinstance(paths, dict):
        for path in sorted(paths):
            if include_path_set and path not in include_path_set:
                continue
            path_item = paths[path]
            if not isinstance(path_item, dict):
                continue
            for method in HTTP_METHODS:
                operation = path_item.get(method)
                if isinstance(operation, dict):
                    lines.extend(
                        [
                            "",
                            "---",
                            "",
                            render_operation(method, path, path_item, operation, document),
                        ]
                    )
    return "\n".join(lines).rstrip() + "\n"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export OpenAPI from Apifox and render Markdown API contract."
    )
    parser.add_argument("--project-id", default=os.environ.get("APIFOX_PROJECT_ID"))
    parser.add_argument("--token", default=os.environ.get("APIFOX_ACCESS_TOKEN"))
    parser.add_argument("--dotenv", default=".env")
    parser.add_argument("--openapi-json", help="Use an existing OpenAPI JSON file")
    parser.add_argument(
        "--out",
        default="skills/lkm-search/references/api-contract.md",
        help="Markdown output path",
    )
    parser.add_argument(
        "--save-openapi-json",
        help="Optional path to write the raw OpenAPI export JSON",
    )
    parser.add_argument(
        "--include-path",
        action="append",
        dest="include_paths",
        help="Only render this path. May be passed multiple times.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    load_dotenv(Path(args.dotenv))
    project_id = args.project_id or os.environ.get("APIFOX_PROJECT_ID")
    token = args.token or os.environ.get("APIFOX_ACCESS_TOKEN")
    if not project_id:
        parser.error("missing --project-id or APIFOX_PROJECT_ID")

    try:
        if args.openapi_json:
            document = json.loads(
                Path(args.openapi_json).read_text(encoding="utf-8")
            )
        else:
            if not token:
                parser.error("missing --token or APIFOX_ACCESS_TOKEN")
            document = fetch_openapi(project_id, token)
    except (OSError, json.JSONDecodeError, RuntimeError) as exc:
        sys.stderr.write(f"{exc}\n")
        return 1

    if args.save_openapi_json:
        raw_path = Path(args.save_openapi_json)
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    markdown = render_contract(
        document,
        project_id=project_id,
        include_paths=args.include_paths or DEFAULT_INCLUDE_PATHS,
    )
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
