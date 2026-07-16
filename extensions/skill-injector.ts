/**
 * Skill Injector — multi-skill activation via system prompt injection.
 *
 * THE PROBLEM: Pi's PTM only supports ONE skill: frontmatter pin per prompt,
 * and that pin ONLY fires when a human types the slash command. The moment
 * the model continues autonomously ("go", "yes", "build ticket 02"), the pin
 * never fires and the model improvises from prose. Cross-project audit (Jul
 * 2026, 5 projects) confirmed: /build (tdd) was NEVER invoked via slash
 * command in any project. The model admitted it "can't trigger the slash
 * command" and improvised.
 *
 * THE SOLUTION: Two-layer injection via before_agent_start:
 * 1. On slash-command turns: detect the pinned skill from the prompt body,
 *    remember it per-session, inject SECONDARY skills (PTM handles primary
 *    as a skill-loaded message).
 * 2. On continuation turns (no slash command detected): inject BOTH primary
 *    AND secondary skills from the remembered state. PTM won't fire — we do.
 *
 * This closes the human-gate gap: the model always has the skill content in
 * its system prompt, whether the user typed a slash command or not.
 *
 * Compaction survival: before_agent_start fires on every agent run, including
 * after compaction. The per-session state survives compaction (it's in a Map,
 * not in the session). Skills are re-injected automatically.
 *
 * Harmony contract:
 * - Owns ONE axis: multi-skill system prompt injection (primary + secondary).
 * - Hooks before_agent_start (appends to systemPrompt, same as guardrails).
 * - Hooks session_compact (updates status only; state persists in Map).
 * - Does NOT register tools. Does NOT block tool calls.
 * - Composes with guardrails.ts (both append to systemPrompt, Pi chains handlers).
 * - Composes with PTM (PTM injects primary as a message on slash-command turns;
 *   we inject primary into system prompt on continuation turns — no conflict,
 *   slight redundancy on slash-command turns is harmless and intentional).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

// ─── Skill map: pinned skill → additional skills to inject ─────────────────

const SKILL_INJECTIONS: Record<string, string[]> = {
	tdd: ["implement", "uv"],
	brainstorming: [
		"to-spec",
		"to-tickets",
		"wayfinder",
		"prototype",
		"grill-with-docs",
		"grilling",
		"octocode-brainstorming",
	],
	"code-review": [
		"receiving-code-review",
		"improve-codebase-architecture",
		"codebase-hygiene",
	],
	"verification-before-completion": [
		"commit",
		"github",
		"diff-driven-docs",
		"domain-modeling",
		"memory-compounding",
		"deploy-to-vercel",
	],
	research: ["octocode-research", "live-research"],
};

// ─── Vocabulary layer (injected on EVERY before_agent_start) ───────────────

const VOCABULARY_SKILLS = ["domain-modeling", "codebase-design"];

// ─── Per-session workflow state ────────────────────────────────────────────
// Remembers the last detected workflow skill so continuation turns (where
// the user says "go" instead of /build) still get the skill injected.
// Keyed by sessionId so every session/subagent gets its own independent state
// (previously module-level `let` that leaked across sessions and subagents).

const workflowSkillBySession = new Map<string, string>();

function getWorkflowSkill(ctx: ExtensionContext): string | null {
	return workflowSkillBySession.get(ctx.sessionManager.getSessionId()) ?? null;
}

function setWorkflowSkill(ctx: ExtensionContext, skill: string): void {
	workflowSkillBySession.set(ctx.sessionManager.getSessionId(), skill);
}

// ─── Skill content loading ─────────────────────────────────────────────────

function loadSkillContent(skillName: string): string | null {
	const paths = [
		join(homedir(), ".agents", "skills", skillName, "SKILL.md"),
		join(homedir(), ".pi", "agent", "skills", skillName, "SKILL.md"),
	];
	for (const skillPath of paths) {
		if (existsSync(skillPath)) {
			const raw = readFileSync(skillPath, "utf-8");
			// Strip frontmatter
			const body = raw.replace(/^---[\s\S]*?---\s*/, "");
			return `\n--- ${skillName} skill (mechanically injected by skill-injector) ---\n${body}\n--- end ${skillName} skill ---\n`;
		}
	}
	return null;
}

// ─── Detect which prompt was invoked ────────────────────────────────────────
// PTM injects the pinned skill as a "skill-loaded" custom message.
// before_agent_start fires BEFORE the message is added, so we check
// event.prompt for known patterns from each prompt template.

function detectPinnedSkill(prompt: string): string | null {
	if (
		prompt.includes("workflow steps 4-5") ||
		prompt.includes("Build the following")
	) {
		return "tdd";
	}
	if (
		prompt.includes("workflow steps 1-3") ||
		prompt.includes("Plan the following")
	) {
		return "brainstorming";
	}
	if (
		prompt.includes("code-review skill") ||
		prompt.includes("Review the current")
	) {
		return "code-review";
	}
	if (
		prompt.includes("workflow steps 7-8") ||
		prompt.includes("Ship the current")
	) {
		return "verification-before-completion";
	}
	if (
		prompt.includes("workflow step 5") ||
		prompt.includes("Debug the following")
	) {
		return "diagnosing-bugs";
	}
	if (
		prompt.includes("research skill") ||
		prompt.includes("Research the following")
	) {
		return "research";
	}
	// /setup-audit pins setup-maintenance — body mentions "setup-maintenance"
	// and "health audit".
	if (prompt.includes("setup-maintenance") || prompt.includes("health audit")) {
		return "setup-maintenance";
	}
	return null;
}

// ─── Extension ──────────────────────────────────────────────────────────────

export default function skillInjectorExtension(pi: ExtensionAPI): void {
	pi.on("before_agent_start", async (event, ctx) => {
		// Layer 1: Vocabulary skills — always injected on every turn.
		const vocabContents: string[] = [];
		for (const skillName of VOCABULARY_SKILLS) {
			const content = loadSkillContent(skillName);
			if (content) vocabContents.push(content);
		}

		// Layer 2: Workflow skills — detect or persist.
		// On a slash-command turn, detectPinnedSkill matches the prompt body
		// and we save the skill to per-session state. On a continuation turn
		// ("go", "yes", "build ticket 02"), detectPinnedSkill returns null —
		// we fall back to the remembered skill so the model still has it.
		const detectedSkill = detectPinnedSkill(event.prompt);
		const isFreshSlashCommand = detectedSkill !== null;
		const activeSkill = detectedSkill ?? getWorkflowSkill(ctx);

		if (isFreshSlashCommand && detectedSkill) {
			setWorkflowSkill(ctx, detectedSkill);
		}

		const skillContents: string[] = [];

		if (activeSkill) {
			// On continuation turns (no slash command), inject the PRIMARY skill
			// into the system prompt — PTM won't do it because no slash command
			// fired. On fresh slash-command turns, PTM injects the primary as a
			// message, so we skip it here to avoid duplication.
			if (!isFreshSlashCommand) {
				const primaryContent = loadSkillContent(activeSkill);
				if (primaryContent) skillContents.push(primaryContent);
			}

			// Secondary skills: always inject (both fresh and continuation).
			const secondarySkills = SKILL_INJECTIONS[activeSkill] ?? [];
			for (const skillName of secondarySkills) {
				const content = loadSkillContent(skillName);
				if (content) skillContents.push(content);
			}
		}

		if (vocabContents.length === 0 && skillContents.length === 0) return;

		let injection = "";
		if (vocabContents.length > 0) {
			injection += `\n\n## Vocabulary Skills (mechanically injected by skill-injector)\n${vocabContents.join("\n")}\n`;
		}
		if (skillContents.length > 0) {
			const label = isFreshSlashCommand
				? "Additional Skills"
				: `Workflow Skills (continuation — ${activeSkill} is the active workflow skill, injected because no slash command fired this turn)`;
			injection += `\n\n## ${label} (mechanically injected by skill-injector)\n${skillContents.join("\n")}\n`;
		}

		return {
			systemPrompt: event.systemPrompt + injection,
		};
	});

	// After compaction, the per-session workflow state persists in the Map.
	// The next before_agent_start will re-inject automatically. Just update
	// the status indicator so the user knows skills survived compaction.
	pi.on("session_compact", async (_event, ctx) => {
		const active = getWorkflowSkill(ctx);
		if (!active) return;
		try {
			ctx.ui.setStatus(
				"skills",
				`${active} queued for re-injection after compaction`,
			);
		} catch {
			// Status may not be available in all modes
		}
	});
}
