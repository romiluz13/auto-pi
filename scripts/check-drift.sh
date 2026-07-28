#!/usr/bin/env bash
# check-drift.sh — three-way drift check for the 2 local forks (code-review, diagnosing-bugs)
# Reports: which local skills have provenance frontmatter, which match upstream, which drifted.
# Exit 0 = no drift OR drift is intentional (provenance present). Exit 1 = drift without provenance (a problem).

set -euo pipefail

MATTPocOCK_REPO="/Users/rom.iluz/Dev/mattpocock-skills"
UPSTREAM_COMMIT="ed37663"

# The 2 local forks with known drift
LOCAL_FORKS=("code-review" "diagnosing-bugs")

echo "=== Drift check for local forks (upstream commit $UPSTREAM_COMMIT) ==="
echo ""

exit_code=0

for skill in "${LOCAL_FORKS[@]}"; do
  local_file="skills/$skill/SKILL.md"
  upstream_file="$MATTPocOCK_REPO/skills/engineering/$skill/SKILL.md"

  if [ ! -f "$local_file" ]; then
    echo "✗ $skill: local file missing ($local_file)"
    exit_code=1
    continue
  fi

  if [ ! -f "$upstream_file" ]; then
    echo "✗ $skill: upstream file missing ($upstream_file)"
    exit_code=1
    continue
  fi

  # Check for provenance frontmatter
  has_provenance=$(grep -c "^upstream:" "$local_file" || true)

  if [ "$has_provenance" -eq 0 ]; then
    echo "✗ $skill: drifted but NO provenance frontmatter (upstream: field missing)"
    exit_code=1
    continue
  fi

  # Check the upstream commit in the frontmatter
  provenance_commit=$(grep "commit:" "$local_file" | head -1 | awk '{print $2}')
  if [ "$provenance_commit" != "$UPSTREAM_COMMIT" ]; then
    echo "⚠ $skill: provenance commit is $provenance_commit, expected $UPSTREAM_COMMIT (upstream may have updated — check for new changes)"
  fi

  # Check actual drift
  if diff -q "$upstream_file" "$local_file" >/dev/null 2>&1; then
    echo "✓ $skill: matches upstream (provenance present, no drift)"
  else
    up_bytes=$(wc -c < "$upstream_file")
    local_bytes=$(wc -c < "$local_file")
    echo "✓ $skill: intentionally drifted (provenance present). Upstream: $up_bytes bytes, local: $local_bytes bytes."
    echo "  Run 'diff $upstream_file $local_file' to see the local patch."
  fi
done

echo ""
if [ "$exit_code" -eq 0 ]; then
  echo "✓ All local forks have provenance. Drift is intentional and tracked."
else
  echo "✗ Drift without provenance detected. Add the upstream: frontmatter block."
fi

exit $exit_code
