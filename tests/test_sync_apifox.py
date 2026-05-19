import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "sync_apifox.py"
spec = importlib.util.spec_from_file_location("sync_apifox", MODULE_PATH)
sync_apifox = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(sync_apifox)


class SyncApifoxTests(unittest.TestCase):
    def test_render_openapi_contract_expands_refs_and_required_fields(self):
        openapi = {
            "openapi": "3.1.0",
            "info": {"title": "LKM API", "version": "1.0.0"},
            "paths": {
                "/search": {
                    "post": {
                        "summary": "Search claims",
                        "description": "Find claims by query.",
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/SearchRequest"
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "description": "OK",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/SearchResponse"
                                        }
                                    }
                                },
                            }
                        },
                    }
                }
            },
            "components": {
                "schemas": {
                    "SearchRequest": {
                        "type": "object",
                        "required": ["query"],
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Free-text query.",
                            },
                            "retrieval_mode": {
                                "type": "string",
                                "enum": ["semantic", "lexical", "hybrid"],
                                "default": "hybrid",
                                "description": "Retrieval mode.",
                            },
                        },
                    },
                    "SearchResponse": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "integer", "description": "Status."},
                            "data": {
                                "type": "object",
                                "properties": {
                                    "variables": {
                                        "type": "array",
                                        "items": {
                                            "$ref": "#/components/schemas/Variable"
                                        },
                                    }
                                },
                            },
                        },
                    },
                    "Variable": {
                        "type": "object",
                        "required": ["id"],
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "Global claim id.",
                            },
                            "score": {
                                "type": "number",
                                "description": "Ranking score.",
                            },
                        },
                    },
                },
            },
        }

        markdown = sync_apifox.render_contract(openapi, project_id="6039175")

        self.assertIn("DO NOT EDIT BY HAND", markdown)
        self.assertIn("## POST /search", markdown)
        self.assertIn("Search claims", markdown)
        self.assertIn("| `query` | string | yes |  | Free-text query. |", markdown)
        self.assertIn(
            "| `retrieval_mode` | string | no | `hybrid` | Retrieval mode. Enum: "
            "`semantic`, `lexical`, `hybrid`. |",
            markdown,
        )
        self.assertIn(
            "| `data.variables[].id` | string | yes |  | Global claim id. |",
            markdown,
        )

    def test_render_openapi_contract_filters_paths(self):
        openapi = {
            "openapi": "3.1.0",
            "info": {"title": "LKM API"},
            "paths": {
                "/search": {
                    "post": {
                        "summary": "Search claims",
                        "responses": {"200": {"description": "OK"}},
                    }
                },
                "/api/v1/account/acl": {
                    "get": {
                        "summary": "Unrelated account API",
                        "responses": {"200": {"description": "OK"}},
                    }
                },
            },
        }

        markdown = sync_apifox.render_contract(
            openapi,
            project_id="6039175",
            include_paths=["/search"],
        )

        self.assertIn("## POST /search", markdown)
        self.assertNotIn("/api/v1/account/acl", markdown)
