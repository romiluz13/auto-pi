#!/usr/bin/env bash
# Real Pi print→RPC restart canary: durable pending dispatch resumes the same run.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d /tmp/auto-pi-restart-canary.XXXXXX)
DOCS=/tmp/auto-pi-restart-docs.txt
REPO_KEY=""
cleanup() {
	rm -rf "$TMP" "$DOCS"
	if [ -n "$REPO_KEY" ]; then
		rm -rf "$HOME/.pi/agent/workflows/$REPO_KEY"
	fi
}
trap cleanup EXIT

cd "$TMP"
git init -q
git config user.email canary@example.com
git config user.name Canary
printf 'before\n' >README.md
git add README.md
git commit -qm initial
printf 'after\n' >README.md
printf 'docs none-needed\n' >"$DOCS"
DOCS_DIGEST=$(shasum -a 256 "$DOCS" | awk '{print $1}')
REPO_KEY=$(node --experimental-strip-types --input-type=module -e \
	"import { repositoryKey } from '${ROOT}/extensions/workflow-interpreter.ts'; console.log(repositoryKey(process.cwd()))")

PROMPT="[AUTO_PI_WORKFLOW]
entry=ship
terminal=shipped
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
At ship-verify call workflow_exec with shasum -a 256 README.md and use its receipt for VERIFICATION_PASSED. At ship-docs call DOCS_READY with artifact id=restart-docs kind=docs locator=$DOCS digest=$DOCS_DIGEST. At ship-commit call COMMIT_CREATED with commitMessage=test:restart-canary and commitPaths=[README.md]. At ship-publish call PUBLICATION_DONE with publicationMode=none. Copy expected state fields from policy.
[/AUTO_PI_SUBJECT]"

AUTO_PI_ALLOW_DIRECT_MARKER=1 pi \
	--no-extensions \
	-e "$ROOT/extensions/workflow-interpreter.ts" \
	--no-builtin-tools \
	--no-session \
	-p "$PROMPT" \
	>/tmp/auto-pi-restart-print-output.txt \
	2>/tmp/auto-pi-restart-print-error.txt || true

export ROOT TMP REPO_KEY
python3 - <<'PY'
import json
import os
import select
import subprocess
import sys
import time

workflow_root = os.path.expanduser(
    f"~/.pi/agent/workflows/{os.environ['REPO_KEY']}"
)
print_state = None
for directory, _, files in os.walk(workflow_root):
    if "snapshot.json" in files:
        print_state = json.load(open(os.path.join(directory, "snapshot.json")))["state"]
if (
    print_state is None
    or print_state["phase"] != "ship-docs"
    or print_state["sequence"] != 1
):
    raise SystemExit(f"print mode did not persist ship-docs dispatch: {print_state}")

process = subprocess.Popen(
    [
        "pi", "--mode", "rpc", "--no-extensions",
        "-e", os.path.join(os.environ["ROOT"], "extensions/workflow-interpreter.ts"),
        "--no-builtin-tools", "--no-session",
    ],
    cwd=os.environ["TMP"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=open("/tmp/auto-pi-restart-rpc-error.txt", "w"),
    text=True,
    bufsize=1,
)
assert process.stdin is not None
assert process.stdout is not None
process.stdin.write(json.dumps({
    "id": "resume",
    "type": "prompt",
    "message": "/workflow resume",
}) + "\n")
process.stdin.flush()
deadline = time.time() + 600
completed = None
errors = []
try:
    while time.time() < deadline:
        ready, _, _ = select.select([process.stdout], [], [], 1)
        if ready:
            line = process.stdout.readline()
            if line:
                event = json.loads(line)
                if event.get("type") == "extension_error":
                    errors.append(event)
        for directory, _, files in os.walk(workflow_root):
            if "snapshot.json" not in files:
                continue
            try:
                state = json.load(open(os.path.join(directory, "snapshot.json")))["state"]
                if state["status"] == "completed":
                    completed = state
                    break
            except (OSError, KeyError, json.JSONDecodeError):
                pass
        if completed is not None or process.poll() is not None:
            break
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()

if errors:
    raise SystemExit(f"restart extension errors: {errors}")
if completed is None:
    raise SystemExit("restart canary did not complete")
if completed["runId"] != print_state["runId"]:
    raise SystemExit("restart created a replacement run")
print(json.dumps({
    "sameRun": True,
    "printPhase": print_state["phase"],
    "final": completed["status"],
    "history": completed["history"],
}))
PY
