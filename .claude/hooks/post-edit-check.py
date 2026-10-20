#!/usr/bin/env python3
"""
PostToolUse hook: fires after every Edit or Write.
- Detects smart/curly quotes that break esbuild.
- Runs workspace-aware TypeScript typecheck for .ts/.tsx files.
"""
import sys, json, subprocess, os, re

event = json.load(sys.stdin)
inp = event.get("tool_input", {})
path = inp.get("file_path", "")
content = inp.get("new_string", "") or inp.get("content", "")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Smart quote detection — these break esbuild silently (U+2018/2019/201C/201D)
if content and re.search(r"[‘’“”]", content):
    found = set(re.findall(r"[‘’“”]", content))
    print(f"\nWARNING: smart quotes detected in {os.path.basename(path)}: {found}")
    print("  Replace with straight ASCII quotes to avoid breaking esbuild.")

# Workspace-aware typecheck for TypeScript files only
if not path.endswith((".ts", ".tsx")):
    sys.exit(0)

rel = os.path.relpath(os.path.abspath(path), ROOT).replace(os.sep, "/")
# Both tsconfigs include only src/, so only src/ edits are actually covered.
# web/ has no typecheck script; its build runs `tsc -b` (noEmit in tsconfig).
if rel.startswith("web/src/"):
    ws_dir, ws_name = os.path.join(ROOT, "web"), "web"
    cmd = ["npx", "--no-install", "tsc", "-b"]
elif rel.startswith("services/api/src/"):
    ws_dir, ws_name = os.path.join(ROOT, "services", "api"), "services/api"
    cmd = ["npm", "run", "typecheck", "--silent"]
elif rel.startswith(("web/", "services/api/")):
    print(f"\n{rel} is outside the workspace tsconfig include - not type-checked")
    sys.exit(0)
else:
    sys.exit(0)

try:
    result = subprocess.run(
        cmd,
        cwd=ws_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
except subprocess.TimeoutExpired:
    print(f"\n{ws_name}/ typecheck timed out after 120s - run it manually")
    sys.exit(0)

if result.returncode != 0:
    out = (result.stdout + result.stderr).strip()[-800:]
    print(f"\nTypeScript errors in {ws_name}/:\n{out}")
else:
    print(f"{ws_name}/ typecheck clean")
