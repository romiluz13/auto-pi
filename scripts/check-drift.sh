#!/usr/bin/env bash
# check-drift.sh — drift check for local forks (code-review, diagnosing-bugs)
#                + pinned external dependencies (ask-matt)
#
# LOCAL FORKS: three-way compare base (upstream at recorded commit) vs upstream-HEAD vs local.
#   Exit 0 = no drift OR drift is intentional (provenance present, no overlap with upstream changes).
#   Exit 1 = drift without provenance, or upstream changed in/near local patch regions (stale fork).
#
# PINNED DEPS: verify the installed file's SHA-256 matches the recorded SHA in the manifest.
#   Exit 0 = installed SHA matches the pinned SHA.
#   Exit 1 = installed SHA differs (the running version is not what we pinned), or manifest missing.
#
# Usage: bash scripts/check-drift.sh
# Env vars (for testing): REPO_ROOT, MATTPocOCK_REPO, LOCAL_FORK_NAMES,
#   PINNED_DEPS_JSON (path to pinned-deps.json), PINNED_DEP_NAMES (override list),
#   INSTALLED_SKILLS_DIR (override root for installed paths).
# Must be run from the repo root (or the script resolves it from its own location).

set -euo pipefail

# Resolve repo root from script location (or accept REPO_ROOT env var for testing)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
UPSTREAM_REPO="${MATTPocOCK_REPO:-/Users/rom.iluz/Dev/mattpocock-skills}"
PINNED_DEPS_JSON_ENV="${PINNED_DEPS_JSON:-}"
INSTALLED_SKILLS_DIR_ENV="${INSTALLED_SKILLS_DIR:-}"

# The local forks with known drift (space-separated; empty = skip local-fork check)
LOCAL_FORKS=(${LOCAL_FORK_NAMES-code-review diagnosing-bugs})
# The pinned external dependencies (space-separated; empty = skip pinned-dep check)
PINNED_DEPS=(${PINNED_DEP_NAMES-ask-matt})

echo "=== Drift check: local forks + pinned dependencies ==="
echo "Repo root: $REPO_ROOT"
echo "Upstream repo: $UPSTREAM_REPO"
echo ""

exit_code=0

for skill in "${LOCAL_FORKS[@]}"; do
	local_file="$REPO_ROOT/skills/$skill/SKILL.md"
	upstream_path="skills/engineering/$skill/SKILL.md"
	upstream_head_file="$UPSTREAM_REPO/$upstream_path"

	echo "--- $skill ---"

	if [ ! -f "$local_file" ]; then
		echo "  ✗ local file missing ($local_file)"
		exit_code=1
		continue
	fi

	if [ ! -f "$upstream_head_file" ]; then
		echo "  ✗ upstream file missing ($upstream_head_file)"
		exit_code=1
		continue
	fi

	# Check for provenance frontmatter
	if ! grep -q "^upstream:" "$local_file"; then
		echo "  ✗ NO provenance frontmatter (upstream: field missing)"
		exit_code=1
		continue
	fi

	# Read the recorded upstream commit from the frontmatter
	recorded_commit=$(awk '/^  commit:/{print $2; exit}' "$local_file")
	if [ -z "$recorded_commit" ]; then
		echo "  ✗ provenance commit not found in frontmatter"
		exit_code=1
		continue
	fi

	echo "  Provenance commit: $recorded_commit"

	# Materialize the base file at the recorded commit
	base_file=$(mktemp)
	if ! (cd "$UPSTREAM_REPO" && git show "$recorded_commit:$upstream_path" >"$base_file" 2>/dev/null); then
		echo "  ✗ cannot materialize base at commit $recorded_commit — the recorded commit may not exist in the upstream repo, or the path has changed"
		rm -f "$base_file"
		exit_code=1
		continue
	fi

	# Three-way comparison
	# 1. base vs upstream-HEAD: did upstream change since the recorded commit?
	# 2. base vs local (content only, stripping the provenance frontmatter): did the local fork change the content?
	upstream_changed=$(diff -q "$base_file" "$upstream_head_file" >/dev/null 2>&1 && echo "no" || echo "yes")

	# For local comparison: strip the YAML frontmatter from BOTH the local file and the base file
	# to compare content only (the provenance frontmatter is the local patch; the content is what matters for drift)
	local_content_file=$(mktemp)
	base_content_file=$(mktemp)
	# Strip everything between the first two --- lines (the frontmatter)
	awk 'BEGIN{in_fm=0} /^---$/{if(in_fm){in_fm=0; next} else {in_fm=1; next}} !in_fm' "$local_file" >"$local_content_file"
	awk 'BEGIN{in_fm=0} /^---$/{if(in_fm){in_fm=0; next} else {in_fm=1; next}} !in_fm' "$base_file" >"$base_content_file"
	local_changed=$(diff -q "$base_content_file" "$local_content_file" >/dev/null 2>&1 && echo "no" || echo "yes")
	rm -f "$local_content_file" "$base_content_file"

	if [ "$upstream_changed" = "no" ] && [ "$local_changed" = "no" ]; then
		echo "  ✓ matches upstream (no drift — local = base = upstream-HEAD)"
	elif [ "$upstream_changed" = "no" ] && [ "$local_changed" = "yes" ]; then
		echo "  ✓ intentionally drifted (upstream unchanged since recorded commit; local patch is the only diff)"
	elif [ "$upstream_changed" = "yes" ] && [ "$local_changed" = "no" ]; then
		echo "  ⚠ upstream changed since recorded commit, local unchanged — the local fork is stale. Review the upstream changes and update the local fork + provenance commit."
		exit_code=1
	else
		# Both changed — check for overlap
		echo "  ⚠ both upstream and local changed since recorded commit — check for overlap:"
		echo "    upstream changes (base → upstream-HEAD):"
		diff "$base_file" "$upstream_head_file" | head -10 | sed 's/^/      /' || true
		echo "    local changes (base → local):"
		diff "$base_file" "$local_file" | head -10 | sed 's/^/      /' || true
		echo "    If the upstream changes touch the same lines as the local patch, the local fork may be missing upstream improvements. Review and update the provenance commit after merging."
		exit_code=1
	fi

	rm -f "$base_file"
done

# ── Pinned external dependencies (ask-matt) ────────────────────────────────
if [ ${#PINNED_DEPS[@]} -gt 0 ]; then
	echo "=== Pinned dependencies ==="
	echo ""

	pinned_manifest="$REPO_ROOT/config/pinned-deps.json"
	if [ -n "$PINNED_DEPS_JSON_ENV" ]; then
		pinned_manifest="$PINNED_DEPS_JSON_ENV"
	fi

	if [ ! -f "$pinned_manifest" ]; then
		echo "✗ pinned-deps manifest missing ($pinned_manifest)"
		exit_code=1
	else
		for dep in "${PINNED_DEPS[@]}"; do
			echo "--- $dep (pinned) ---"

			# Parse the manifest entry via python3 (macOS ships it)
			entry_json=$(python3 -c "
import json
with open('$pinned_manifest') as f:
    data = json.load(f)
if '$dep' not in data:
    print('MISSING')
else:
    e = data['$dep']
    print(e.get('installedPath',''))
    print(e.get('sha256',''))
    print(e.get('upstreamRepo',''))
    print(e.get('upstreamPath',''))
    print(e.get('baseCommit',''))
" 2>/dev/null) || entry_json=""

			if [ -z "$entry_json" ] || [ "$entry_json" = "MISSING" ]; then
				echo "  ✗ no manifest entry for $dep"
				exit_code=1
				continue
			fi

			# Read the entry fields (line-separated)
			installed_path=$(echo "$entry_json" | sed -n '1p')
			recorded_sha=$(echo "$entry_json" | sed -n '2p')

			# Resolve ~ in the installed path, unless INSTALLED_SKILLS_DIR overrides
			if [ -n "$INSTALLED_SKILLS_DIR_ENV" ]; then
				resolved_installed="$INSTALLED_SKILLS_DIR_ENV/$dep/SKILL.md"
			else
				resolved_installed="${installed_path/#\~/$HOME}"
			fi

			if [ ! -f "$resolved_installed" ]; then
				echo "  ✗ installed file missing ($resolved_installed)"
				exit_code=1
				continue
			fi

			# Compute SHA-256 of the installed file
			actual_sha=$(shasum -a 256 "$resolved_installed" | awk '{print $1}')

			if [ -z "$recorded_sha" ]; then
				echo "  ✗ no sha256 recorded in manifest for $dep"
				exit_code=1
				continue
			fi

			if [ "$actual_sha" = "$recorded_sha" ]; then
				echo "  ✓ installed SHA matches pinned SHA ($actual_sha)"
			else
				echo "  ⚠ installed SHA differs from pinned SHA"
				echo "    recorded: $recorded_sha"
				echo "    actual:   $actual_sha"
				echo "    The running version is not what we pinned. Review upstream changes and update the manifest if desired."
				exit_code=1
			fi
		done
		echo ""
	fi
fi

echo ""
if [ "$exit_code" -eq 0 ]; then
	echo "✓ All local forks have provenance + all pinned deps match. No drift requires manual review."
else
	echo "✗ Drift issues detected — see above."
fi

exit $exit_code
