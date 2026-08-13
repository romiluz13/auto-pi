#!/usr/bin/env bash
# Real Pi RPC canary for direct PTM and Coach → PTM workflow admission.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PTM="$HOME/.pi/agent/npm/node_modules/pi-prompt-template-model/index.ts"

run_scenario() {
	local mode=$1
	local tmp artifact digest key
	tmp=$(mktemp -d "/tmp/auto-pi-${mode}-entry.XXXXXX")
	artifact=$(mktemp "/tmp/auto-pi-${mode}-research.XXXXXX.md")
	(
		set -e
		cd "$tmp"
		git init -q
		git config user.email canary@example.com
		git config user.name Canary
		printf 'entry\n' >README.md
		git add README.md
		git commit -qm initial
		printf 'cited research\n' >"$artifact"
		digest=$(shasum -a 256 "$artifact" | awk '{print $1}')
		key=$(node --experimental-strip-types --input-type=module -e \
			"import { repositoryKey } from '${ROOT}/extensions/workflow-interpreter.ts'; console.log(repositoryKey(process.cwd()))")
		export ROOT PTM mode tmp artifact digest key
		python3 - <<'PY'
import json
import os
import select
import subprocess
import sys
import time

mode = os.environ["mode"]
extensions = ["-e", os.path.join(os.environ["ROOT"], "extensions/workflow-interpreter.ts")]
if mode == "coach":
    extensions = ["-e", os.path.join(os.environ["ROOT"], "extensions/coach.ts")] + extensions
extensions += ["-e", os.environ["PTM"]]
command = [
    "pi", "--mode", "rpc", "--no-extensions", *extensions,
    "--no-builtin-tools", "--no-session",
]
instruction = (
    f"Call workflow_transition RESEARCH_READY with artifact id={mode}-research "
    f"kind=research locator={os.environ['artifact']} digest={os.environ['digest']}; "
    "copy runId, expectedPhase, expectedSequence, and expectedProgressToken from policy."
)
message = f"/research {instruction}" if mode == "direct" else f"Research this workflow admission canary. {instruction}"
error_path = f"/tmp/auto-pi-{mode}-entry-error.txt"
error_file = open(error_path, "w")
process = subprocess.Popen(
    command,
    cwd=os.environ["tmp"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=error_file,
    text=True,
    bufsize=1,
)
assert process.stdin is not None
assert process.stdout is not None
process.stdin.write(json.dumps({"id": mode, "type": "prompt", "message": message}) + "\n")
process.stdin.flush()
workflow_root = os.path.expanduser(f"~/.pi/agent/workflows/{os.environ['key']}")
deadline = time.time() + 420
completed = None
extension_errors = []
coach_selections = 0
try:
    while time.time() < deadline:
        ready, _, _ = select.select([process.stdout], [], [], 1)
        if ready:
            line = process.stdout.readline()
            if line:
                event = json.loads(line)
                if event.get("type") == "extension_error":
                    extension_errors.append(event)
                if (
                    mode == "coach"
                    and event.get("type") == "extension_ui_request"
                    and event.get("method") == "select"
                ):
                    process.stdin.write(json.dumps({
                        "type": "extension_ui_response",
                        "id": event["id"],
                        "value": "/research — Research a topic (parallel fan-out)",
                    }) + "\n")
                    process.stdin.flush()
                    coach_selections += 1
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
    error_file.close()

if extension_errors:
    raise SystemExit(f"{mode} extension errors: {extension_errors}")
if completed is None:
    raise SystemExit(f"{mode} entry canary did not complete")
if completed["entry"] != "research" or completed["humanCommands"] != 1:
    raise SystemExit(f"{mode} unexpected state: {completed}")
if mode == "coach" and coach_selections != 1:
    raise SystemExit(f"coach selection count was {coach_selections}")
print(json.dumps({
    "mode": mode,
    "status": completed["status"],
    "entry": completed["entry"],
    "history": completed["history"],
    "coachSelections": coach_selections,
}))
PY
		rm -rf "$HOME/.pi/agent/workflows/$key"
	)
	rm -rf "$tmp" "$artifact"
}

run_scenario direct
run_scenario coach
