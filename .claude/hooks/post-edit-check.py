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

sep = os.sep
if f"{sep}web{sep}" in path or path.endswith(f"{sep}web"):
    ws_dir, ws_name = os.path.join(ROOT, "web"), "web"
elif f"{sep}services{sep}api{sep}" in path:
    ws_dir, ws_name = os.path.join(ROOT, "services", "api"), "services/api"
else:
    sys.exit(0)

result = subprocess.run(
    ["npm", "run", "typecheck", "--silent"],
    cwd=ws_dir,
    capture_output=True,
    text=True,
    timeout=60,
)

if result.returncode != 0:
    out = (result.stdout + result.stderr).strip()[-800:]
    print(f"\nTypeScript errors in {ws_name}/:\n{out}")
else:
    print(f"{ws_name}/ typecheck clean")
