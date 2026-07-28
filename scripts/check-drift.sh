#!/usr/bin/env bash
# check-drift.sh — three-way drift check for local forks (code-review, diagnosing-bugs)
#
# Compares: base (upstream at the recorded provenance commit) vs upstream-HEAD vs local.
# Reports: upstream-changed/local-unchanged, local-changed/upstream-unchanged, or overlapping changes.
# Exit 0 = no drift OR drift is intentional (provenance present, no overlap with upstream changes).
# Exit 1 = drift without provenance, or upstream changed in/near local patch regions (stale fork).
#
# Usage: bash scripts/check-drift.sh
# Must be run from the repo root (or the script resolves it from its own location).

set -euo pipefail

# Resolve repo root from script location (don't rely on cwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
UPSTREAM_REPO="${MATTPocOCK_REPO:-/Users/rom.iluz/Dev/mattpocock-skills}"

# The local forks with known drift
LOCAL_FORKS=("code-review" "diagnosing-bugs")

echo "=== Three-way drift check for local forks ==="
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
	recorded_commit=$(grep "^  commit:" "$local_file" | head -1 | awk '{print $2}')
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
	# 2. base vs local: did the local fork change from the base?
	upstream_changed=$(diff -q "$base_file" "$upstream_head_file" >/dev/null 2>&1 && echo "no" || echo "yes")
	local_changed=$(diff -q "$base_file" "$local_file" >/dev/null 2>&1 && echo "no" || echo "yes")

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
		diff "$base_file" "$upstream_head_file" | head -10 | sed 's/^/      /'
		echo "    local changes (base → local):"
		diff "$base_file" "$local_file" | head -10 | sed 's/^/      /'
		echo "    If the upstream changes touch the same lines as the local patch, the local fork may be missing upstream improvements. Review and update the provenance commit after merging."
		exit_code=1
	fi

	rm -f "$base_file"
done

echo ""
if [ "$exit_code" -eq 0 ]; then
	echo "✓ All local forks have provenance. Drift is intentional and tracked. No upstream changes overlap with local patches."
else
	echo "✗ Drift issues detected — see above."
fi

exit $exit_code
