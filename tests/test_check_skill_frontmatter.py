import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1] / "scripts" / "check_skill_frontmatter.py"
)
spec = importlib.util.spec_from_file_location("check_skill_frontmatter", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)


def _write_skill(tmpdir: Path, name: str, frontmatter: str, body: str = "# Body") -> Path:
    """Materialize a minimal `<tmpdir>/<name>/SKILL.md` for a test case."""
    skill_dir = tmpdir / name
    skill_dir.mkdir(parents=True)
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(f"---\n{frontmatter}\n---\n\n{body}\n", encoding="utf-8")
    return skill_md


class ParseFrontmatterTests(unittest.TestCase):
    def test_extracts_name_and_description(self):
        text = "---\nname: foo\ndescription: bar\n---\n\nbody"
        fm = mod.parse_frontmatter(text)
        self.assertEqual(fm, {"name": "foo", "description": "bar"})

    def test_returns_none_when_missing(self):
        self.assertIsNone(mod.parse_frontmatter("no frontmatter here"))

    def test_handles_wrapped_description(self):
        text = (
            "---\n"
            "name: foo\n"
            "description: line one continues\n"
            "  line two continues\n"
            "---\n"
        )
        fm = mod.parse_frontmatter(text)
        self.assertEqual(fm["name"], "foo")
        self.assertIn("line one", fm["description"])
        self.assertIn("line two", fm["description"])


class CheckOneTests(unittest.TestCase):
    def test_clean_skill_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_skill(
                Path(tmp), "foo", "name: foo\ndescription: Use when doing foo."
            )
            errors, warnings = mod.check_one(path)
            self.assertEqual(errors, [])
            self.assertEqual(warnings, [])

    def test_missing_frontmatter_is_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill_dir = Path(tmp) / "foo"
            skill_dir.mkdir()
            path = skill_dir / "SKILL.md"
            path.write_text("no frontmatter here", encoding="utf-8")
            errors, _ = mod.check_one(path)
            self.assertTrue(any("frontmatter" in e for e in errors))

    def test_name_mismatch_is_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_skill(
                Path(tmp), "foo", "name: bar\ndescription: ok"
            )
            errors, _ = mod.check_one(path)
            self.assertTrue(any("does not match parent dir" in e for e in errors))

    def test_missing_description_is_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_skill(Path(tmp), "foo", "name: foo")
            errors, _ = mod.check_one(path)
            self.assertTrue(any("missing `description:`" in e for e in errors))

    def test_description_over_limit_is_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            long_desc = "x" * (mod.DESCRIPTION_LIMIT + 1)
            path = _write_skill(
                Path(tmp), "foo", f"name: foo\ndescription: {long_desc}"
            )
            errors, _ = mod.check_one(path)
            self.assertTrue(any("exceeds Codex CLI limit" in e for e in errors))

    def test_description_at_limit_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            desc = "x" * mod.DESCRIPTION_LIMIT
            path = _write_skill(
                Path(tmp), "foo", f"name: foo\ndescription: {desc}"
            )
            errors, _ = mod.check_one(path)
            self.assertEqual(errors, [])

    def test_colon_space_in_description_warns(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_skill(
                Path(tmp),
                "foo",
                "name: foo\ndescription: Atomic: this is the API surface.",
            )
            _, warnings = mod.check_one(path)
            self.assertTrue(
                any("colon-space" in w for w in warnings),
                f"expected colon-space warning, got {warnings!r}",
            )

    def test_colon_space_inside_backticks_does_not_warn(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_skill(
                Path(tmp),
                "foo",
                "name: foo\ndescription: See `key: value` syntax.",
            )
            _, warnings = mod.check_one(path)
            self.assertEqual(warnings, [])


class MainExitCodeTests(unittest.TestCase):
    def test_main_returns_zero_on_clean_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            _write_skill(Path(tmp), "foo", "name: foo\ndescription: Use when foo.")
            self.assertEqual(mod.main([tmp]), 0)

    def test_main_returns_one_on_hard_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            long_desc = "x" * (mod.DESCRIPTION_LIMIT + 1)
            _write_skill(
                Path(tmp), "foo", f"name: foo\ndescription: {long_desc}"
            )
            self.assertEqual(mod.main([tmp]), 1)

    def test_main_strict_promotes_warnings_to_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            _write_skill(
                Path(tmp),
                "foo",
                "name: foo\ndescription: Atomic: this is the API surface.",
            )
            self.assertEqual(mod.main([tmp]), 0)
            self.assertEqual(mod.main([tmp, "--strict"]), 1)

    def test_main_returns_two_when_dir_missing(self):
        self.assertEqual(mod.main(["/nonexistent/path/xyzzy"]), 2)


if __name__ == "__main__":
    unittest.main()
