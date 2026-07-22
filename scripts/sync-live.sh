#!/bin/bash
# sync-live.sh — copy all auto-pi extensions, prompts, skills, and config
# from the repo to the live Pi config at ~/.pi/agent/.
# Run this after ANY change to extensions/, prompts/, skills/, or config/.
# This is the step that keeps getting forgotten.

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PI_DIR="$HOME/.pi/agent"
AGENTS_DIR="$HOME/.agents/skills"

echo "Syncing auto-pi repo → live config..."

# Extensions
for f in "$REPO_DIR"/extensions/*.ts; do
	[ -f "$f" ] || continue
	name=$(basename "$f")
	cp "$f" "$PI_DIR/extensions/$name"
	echo "  ✓ extension: $name"
done

# Prompts
for f in "$REPO_DIR"/prompts/*.md; do
	[ -f "$f" ] || continue
	name=$(basename "$f")
	cp "$f" "$PI_DIR/prompts/$name"
	echo "  ✓ prompt: $name"
done

# Agent types (for /loop --mode=agents — loadAgentType reads from ~/.pi/agent/agents/)
mkdir -p "$PI_DIR/agents"
for f in "$REPO_DIR"/agents/*.md; do
	[ -f "$f" ] || continue
	name=$(basename "$f")
	cp "$f" "$PI_DIR/agents/$name"
	echo "  ✓ agent type: $name"
done

# Skills (repo skills overwrite ~/.agents/skills/ — auto-pi wins collisions)
for d in "$REPO_DIR"/skills/*/; do
	[ -d "$d" ] || continue
	name=$(basename "$d")
	rm -rf "$AGENTS_DIR/$name"
	cp -R "$d" "$AGENTS_DIR/$name"
	echo "  ✓ skill: $name"
done

# AGENTS.md
cp "$REPO_DIR/config/agents.md" "$PI_DIR/AGENTS.md"
echo "  ✓ AGENTS.md"

# settings.json (merge — don't overwrite, preserve live keys like API tokens)
if [ -f "$PI_DIR/settings.json" ] && [ -f "$REPO_DIR/config/settings.json" ]; then
	# Only copy if they differ — and only the keys we manage
	echo "  ⚠ settings.json: manual merge required (run node -e to patch specific keys)"
else
	cp "$REPO_DIR/config/settings.json" "$PI_DIR/settings.json"
	echo "  ✓ settings.json"
fi

echo ""
echo "Done. Run /reload in Pi to activate."
echo "Verify: diff -q $REPO_DIR/extensions/*.ts $PI_DIR/extensions/ should show no mismatches"
