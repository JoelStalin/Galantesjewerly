import os
from datetime import datetime

OUTPUT_FILE = "WORKSPACE.map"
EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    ".venv",
    ".venv-scrapling",
    "dist",
    "build",
    "__pycache__",
    ".next",
    ".artifacts",
    "tmp",
    "archive",
    "logs",
    "chrome_profile",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    "playwright-report",
    "test-results",
    "blob-report",
    "_codex_stage",
}
KEY_FILENAMES = {
    "GEMINI.md",
    "CLAUDE.md",
    "AGENTS.md",
    ".env.example",
    ".env.gcp.example",
    "README.md",
    "pyproject.toml",
    "package.json",
    "docker-compose.yml",
    "docker-compose.production.yml",
    "WORKSPACE.map",
}


def generate_map() -> None:
    lines = []
    lines.append("# 🗺️ GALANTES JEWELRY WORKSPACE MAP")
    lines.append(f"# Last Full Sync: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("# Scope: Dedicated repo / production checkout")
    lines.append("")
    lines.append("## 📜 Agent Rule")
    lines.append("1. Read this file before broad repo exploration.")
    lines.append("2. Regenerate it after structural changes with `python scripts/update_repo_map.py`.")
    lines.append("")
    lines.append("## 📂 Repository Tree")
    lines.append("```text")

    root_path = os.getcwd()

    for root, dirs, files in os.walk(root_path):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS)
        files = sorted(files)

        rel_path = os.path.relpath(root, root_path)
        if rel_path == ".":
            for f_name in files:
                marker = " [KEY]" if f_name in KEY_FILENAMES else ""
                lines.append(f"├── {f_name}{marker}")
            continue

        depth = rel_path.count(os.sep) + 1
        indent = "  " * (depth - 1)
        dir_name = os.path.basename(root)
        marker = " [KEY]" if dir_name in {"app", "components", "lib", "odoo", "scripts", "infra", "tests"} else ""
        lines.append(f"{indent}├── {dir_name}/{marker}")

        for f_name in files:
            f_indent = "  " * depth
            file_marker = " [KEY]" if f_name in KEY_FILENAMES else ""
            lines.append(f"{f_indent}└── {f_name}{file_marker}")

    lines.append("```")
    lines.append("")
    lines.append("## 🤖 End Of Map")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    generate_map()
