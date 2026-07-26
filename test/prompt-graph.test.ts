import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const REPO_ROOT = process.cwd();
const PROMPTS_DIR = join(REPO_ROOT, "prompts");
const SKILLS_DIR = join(homedir(), ".agents", "skills");

// The set of prompt names (without .md) that are valid "Next: type /X" targets.
// These are the auto-pi prompts (each has a skill: pin).
const PROMPT_NAMES = readdirSync(PROMPTS_DIR)
	.filter((f) => f.endsWith(".md"))
	.map((f) => f.replace(/\.md$/, ""));

function readPrompt(name: string): string {
	return readFileSync(join(PROMPTS_DIR, `${name}.md`), "utf-8");
}

function skillPin(prompt: string): string | null {
	const match = prompt.match(/^skill:\s*(\S+)/m);
	return match ? match[1] : null;
}

function skillExists(name: string): boolean {
	// Check ~/.agents/skills/<name>/SKILL.md
	return existsSync(join(SKILLS_DIR, name, "SKILL.md"));
}

function nextStepTargets(prompt: string): string[] {
	const targets: string[] = [];
	// Match "Next: type /X" — capture the command name (may have args after)
	const regex = /Next:\s*type\s*`?\/(\S+?)`?[\s.,]/g;
	let match;
	while ((match = regex.exec(prompt)) !== null) {
		// Strip any args (e.g., "/build <ticket>" → "build")
		const cmd = match[1].replace(/[<"].*/, "").replace(/[.].*/, "");
		targets.push(cmd);
	}
	return targets;
}

// ─── Every prompt has exactly one valid skill: target ────────────────────────

test("every prompt has exactly one skill: frontmatter pin", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		const pin = skillPin(content);
		assert.ok(pin, `prompt ${name}.md has no skill: pin`);
	}
});

test("every prompt's skill: target exists in the skill library", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		const pin = skillPin(content);
		assert.ok(pin, `prompt ${name}.md has no skill: pin`);
		assert.ok(
			skillExists(pin),
			`prompt ${name}.md pins skill "${pin}" but no SKILL.md exists at ~/.agents/skills/${pin}/SKILL.md`,
		);
	}
});

// ─── Every "Next: type /X" names an installed prompt ─────────────────────────

test("every 'Next: type /X' names an installed prompt command", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		const targets = nextStepTargets(content);
		// /ship is terminal (no next step) — skip if there are no targets
		if (targets.length === 0) continue;
		for (const target of targets) {
			// The target should be a prompt name OR a skill command.
			// Prompts: /build, /debug, /plan, /research, /review, /ship, /setup-audit, /spec, /tickets, /wayfind
			// Some "Next" may point to /skill:X (skill commands) — those are valid too.
			const isPrompt = PROMPT_NAMES.includes(target);
			const isSkillCmd = skillExists(target);
			assert.ok(
				isPrompt || isSkillCmd,
				`prompt ${name}.md says "Next: type /${target}" but /${target} is neither a prompt nor a skill`,
			);
		}
	}
});

// ─── The plan chain is complete (no broken edges) ─────────────────────────────

test("the /plan → /spec → /tickets → /build chain has no broken edges", () => {
	const plan = readPrompt("plan");
	const spec = readPrompt("spec");
	const tickets = readPrompt("tickets");

	// /plan → /spec
	assert.ok(
		/Next:\s*type\s*`?\/spec`?/.test(plan),
		"/plan should recommend /spec as the next step",
	);
	// /spec → /tickets
	assert.ok(
		/Next:\s*type\s*`?\/tickets/.test(spec),
		"/spec should recommend /tickets as the next step",
	);
	// /tickets → /build
	assert.ok(
		/Next:\s*type\s*`?\/build/.test(tickets),
		"/tickets should recommend /build as the next step",
	);
});

// ─── No prompt says "Want me to invoke it?" (the agent can't) ────────────────

test("no prompt says 'Want me to invoke it?' (the agent can't run slash commands)", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		assert.ok(
			!/Want me to invoke/i.test(content),
			`prompt ${name}.md says "Want me to invoke it?" — the agent can't run slash commands`,
		);
	}
});
