#!/usr/bin/env bash
# Real Pi RPC canary: one public entry → four fresh top-level phases → one commit.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d /tmp/auto-pi-workflow-canary.XXXXXX)
VERIFY=/tmp/auto-pi-canary-verification.txt
DOCS=/tmp/auto-pi-canary-docs.txt
REPO_KEY=""

cleanup() {
	rm -rf "$TMP"
	rm -f "$VERIFY" "$DOCS"
	if [ -n "$REPO_KEY" ]; then
		rm -rf "${HOME}/.pi/agent/workflows/${REPO_KEY}"
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
BASELINE=$(git rev-parse HEAD)
printf 'after\n' >README.md
printf 'verification passed\n' >"$VERIFY"
printf 'docs none-needed\n' >"$DOCS"
VERIFY_DIGEST=$(shasum -a 256 "$VERIFY" | awk '{print $1}')
DOCS_DIGEST=$(shasum -a 256 "$DOCS" | awk '{print $1}')
REPO_KEY=$(node --experimental-strip-types --input-type=module -e \
	"import { repositoryKey } from '${ROOT}/extensions/workflow-interpreter.ts'; console.log(repositoryKey(process.cwd()))")

export ROOT TMP VERIFY DOCS VERIFY_DIGEST DOCS_DIGEST REPO_KEY
python3 - <<'PY'
import json
import os
import select
import subprocess
import sys
import time

prompt = f'''[AUTO_PI_WORKFLOW]
entry=ship
terminal=shipped
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
Execute exactly the event allowed by each fresh AUTO_PI_POLICY:
- ship-verify: first call workflow_exec with command=shasum args=["-a","256","README.md"], then call VERIFICATION_PASSED using exactly the verification receipt artifact returned in workflow_exec details.
- ship-docs: DOCS_READY with artifact id=canary-docs kind=docs locator={os.environ["DOCS"]} digest={os.environ["DOCS_DIGEST"]}.
- ship-commit: COMMIT_CREATED with commitMessage="test: workflow canary" and commitPaths=["README.md"].
- ship-publish: PUBLICATION_DONE with publicationMode=none.
Copy runId, expectedPhase, expectedSequence, and expectedProgressToken exactly from the current policy on every tool call.
[/AUTO_PI_SUBJECT]'''

command = [
    "pi", "--mode", "rpc", "--no-extensions",
    "-e", os.path.join(os.environ["ROOT"], "extensions/workflow-interpreter.ts"),
    "--no-builtin-tools", "--no-session",
]
environment = os.environ.copy()
environment["AUTO_PI_ALLOW_DIRECT_MARKER"] = "1"
error_file = open("/tmp/auto-pi-canary-error.txt", "w")
process = subprocess.Popen(
    command,
    cwd=os.environ["TMP"],
    env=environment,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=error_file,
    text=True,
    bufsize=1,
)
assert process.stdin is not None
assert process.stdout is not None
process.stdin.write(json.dumps({"id": "canary", "type": "prompt", "message": prompt}) + "\n")
process.stdin.flush()

workflow_root = os.path.expanduser(
    f"~/.pi/agent/workflows/{os.environ['REPO_KEY']}"
)
deadline = time.time() + 600
agent_settled = 0
extension_errors = []
completed = None
try:
    while time.time() < deadline:
        ready, _, _ = select.select([process.stdout], [], [], 1)
        if ready:
            line = process.stdout.readline()
            if line:
                event = json.loads(line)
                if event.get("type") == "agent_settled":
                    agent_settled += 1
                if event.get("type") == "extension_error":
                    extension_errors.append(event)
        for directory, _, files in os.walk(workflow_root):
            if "snapshot.json" not in files:
                continue
            try:
                record = json.load(open(os.path.join(directory, "snapshot.json")))
                state = record["state"]
                if state["status"] == "completed":
                    completed = state
                    break
            except (OSError, KeyError, json.JSONDecodeError):
                pass
        if completed is not None:
            break
        if process.poll() is not None:
            break
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
    error_file.close()

if extension_errors:
    raise SystemExit(f"extension errors: {extension_errors}")
if completed is None:
    raise SystemExit("workflow RPC canary did not complete")
expected = [
    "VERIFICATION_PASSED:ship-verify->ship-docs",
    "DOCS_READY:ship-docs->ship-commit",
    "COMMIT_CREATED:ship-commit->ship-publish",
    "PUBLICATION_DONE:ship-publish->complete",
]
if completed["history"] != expected or completed["humanCommands"] != 1:
    raise SystemExit(f"unexpected final state: {completed}")
print(json.dumps({
    "runId": completed["runId"],
    "status": completed["status"],
    "phase": completed["phase"],
    "humanCommands": completed["humanCommands"],
    "history": completed["history"],
    "agentSettledEvents": agent_settled,
}))
PY

test "$(git rev-list --count "${BASELINE}..HEAD")" = "1"
test ! -e "${HOME}/.pi/agent/workflows/${REPO_KEY}/active.lock"
