// workflow-gate-logic.ts — Pure gate logic, separated from the Pi runtime.
//
// Extracted from workflow-gate.ts so it can be tested without the Pi runtime.
// Same pattern as loop-dispatch.ts.

// ─── Skill requirements for operations ─────────────────────────────────────

export const COMMIT_REQUIRED_SKILLS = ["verification-before-completion"];
export const PUSH_REQUIRED_SKILLS = ["commit"];
export const BUILD_REQUIRED_SKILLS = ["tdd"];
export const REVIEW_REQUIRED_SKILLS = ["code-review"];

// ─── File classification ───────────────────────────────────────────────────
// The TDD gate only blocks writes to SOURCE files. Test files, docs, and
// config are always allowed — writing tests first IS the point of TDD.

const TEST_FILE_PATTERNS = [
	/\.test\.[tj]sx?$/,
	/\.spec\.[tj]sx?$/,
	/_test\.go$/,
	/^test_.*\.py$/,
	/.*_test\.py$/,
	/.*_test\.rs$/,
	/(^|\/)(test|tests|__tests__|spec|specs)\//,
];

const SOURCE_EXTENSIONS = [
	".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
	".py", ".go", ".rs", ".java", ".kt", ".rb",
	".c", ".cpp", ".cc", ".h", ".hpp", ".swift",
	".php", ".scala", ".clj", ".ex", ".exs", ".heex",
	".vue", ".svelte", ".astro",
];

export function isTestFile(filePath: string): boolean {
	return TEST_FILE_PATTERNS.some((p) => p.test(filePath));
}

export function isSourceFile(filePath: string): boolean {
	if (isTestFile(filePath)) return false;
	const lower = filePath.toLowerCase();
	return SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// ─── Skill detection ───────────────────────────────────────────────────────
// A skill is "active" if EITHER:
// 1. PTM injected it as a skill-loaded message in the session (slash-command turn), OR
// 2. skill-injector added it to the system prompt (continuation turn after my fix)
//
// This dual check catches both the fresh-slash-command path and the
// autonomous-continuation path.

export interface SkillCheckContext {
	sessionManager: {
		getBranch: () => Array<Record<string, unknown>>;
	};
	getSystemPrompt?: () => string;
}

export function getLoadedSkills(ctx: SkillCheckContext): Set<string> {
	const loaded = new Set<string>();
	try {
		const branch = ctx.sessionManager.getBranch();
		for (const entry of branch) {
			if (entry.customType === "skill-loaded" && entry.details) {
				const skillName = (entry.details as { skillName?: string }).skillName;
				if (skillName) loaded.add(skillName);
			}
		}
	} catch {
		// Session access may fail — fail open
	}
	return loaded;
}

export function isSkillActive(ctx: SkillCheckContext, skillName: string): boolean {
	// Source 1: skill-loaded message in session (fresh slash-command turn)
	const loaded = getLoadedSkills(ctx);
	if (loaded.has(skillName)) return true;

	// Source 2: injection marker in system prompt (continuation turn)
	// skill-injector adds "--- {skillName} skill (mechanically injected" markers
	try {
		if (ctx.getSystemPrompt) {
			const sp = ctx.getSystemPrompt();
			if (sp.includes(`--- ${skillName} skill`)) return true;
		}
	} catch {
		// System prompt access may fail — fail open
	}

	return false;
}

export function anySkillActive(ctx: SkillCheckContext, skills: string[]): boolean {
	return skills.some((s) => isSkillActive(ctx, s));
}

// ─── Gate decisions ────────────────────────────────────────────────────────
// Pure functions that return { block, reason } given the context.
// The extension wires these into the tool_call handler.

export interface GateDecision {
	block: boolean;
	reason?: string;
}

export function shouldGateWrite(
	filePath: string,
	ctx: SkillCheckContext,
	skipGate: boolean,
): GateDecision {
	if (skipGate) return { block: false };
	if (!isSourceFile(filePath)) return { block: false };
	if (anySkillActive(ctx, BUILD_REQUIRED_SKILLS)) return { block: false };

	return {
		block: true,
		reason: `[WORKFLOW GATE] write/edit blocked on source file "${filePath}": no build skill (tdd) is active. Run /build or /feature first. Use /skip-gate to override.`,
	};
}

export function shouldGateCommit(
	ctx: SkillCheckContext,
	skipGate: boolean,
	testsWereRun: boolean,
): GateDecision {
	if (skipGate) return { block: false };

	const hasVerification = isSkillActive(ctx, "verification-before-completion");
	const hasReview = anySkillActive(ctx, REVIEW_REQUIRED_SKILLS);

	// Gate 1: verification-before-completion (existing behavior, tightened)
	if (!hasVerification && !testsWereRun) {
		return {
			block: true,
			reason: `[WORKFLOW GATE] git commit blocked: verification-before-completion skill not loaded and no test command detected. Run /ship, or run /skill:verification-before-completion, then commit. Use /skip-gate to override.`,
		};
	}

	// Gate 2: code-review must have been loaded (new enforcement)
	if (!hasReview) {
		return {
			block: true,
			reason: `[WORKFLOW GATE] git commit blocked: code-review skill not loaded. Run /review before committing. Use /skip-gate to override.`,
		};
	}

	return { block: false };
}

export function shouldGatePush(
	ctx: SkillCheckContext,
	skipGate: boolean,
): GateDecision {
	if (skipGate) return { block: false };
	if (anySkillActive(ctx, PUSH_REQUIRED_SKILLS)) return { block: false };

	return {
		block: true,
		reason: `[WORKFLOW GATE] git push blocked: commit skill not loaded. Run /ship or /skill:commit before pushing. Use /skip-gate to override.`,
	};
}

// ─── Test-run detection (heuristic) ────────────────────────────────────────

export function wasTestRun(ctx: SkillCheckContext): boolean {
	try {
		const branch = ctx.sessionManager.getBranch();
		for (const entry of branch) {
			const input = entry.input as { command?: string } | undefined;
			if (input?.command) {
				const cmd = input.command.toLowerCase();
				if (
					cmd.includes("test") ||
					cmd.includes("pytest") ||
					cmd.includes("npm test") ||
					cmd.includes("node --test")
				) {
					return true;
				}
			}
		}
	} catch {
		// fail open
	}
	return false;
}
