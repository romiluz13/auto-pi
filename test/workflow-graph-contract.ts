// Machine-readable workflow graph contract for auto-pi v0.3+.
// This is NOT a runtime engine — it is a validation contract used by tests
// and as documentation of the intended graph. Tests validate that the
// SKILL.md files match this contract (phases, transitions, specialists,
// handoffs) rather than inferring the graph from prose.

export interface PhaseDef {
	name: string;
	specialists: string[]; // skills read in this phase (conditional reads marked with predicate in the predicate field)
	conditionalSpecialists?: { skill: string; predicate: string }[];
	next?: string[]; // allowed next phases (by name)
	terminal?: boolean;
	handoff?: { command: string; argPlaceholder?: string }; // user-facing slash handoff
}

export interface WorkflowDef {
	name: string;
	promptPin: string; // the skill: frontmatter in the prompt
	phases: PhaseDef[];
	stateFields: string[];
}

export const WORKFLOWS: WorkflowDef[] = [
	{
		name: "planning-workflow",
		promptPin: "planning-workflow",
		stateFields: [
			"workflow", "mode", "phase", "design", "style", "domain capture",
			"domain artifacts", "prototype", "prototype question",
			"prototype conclusion", "unresolved design uncertainty",
			"spec", "tickets", "frontier",
		],
		phases: [
			{
				name: "classify",
				specialists: [],
				next: ["setup", "wayfind"],
			},
			{
				name: "setup",
				specialists: [],
				next: ["brainstorm"],
			},
			{
				name: "brainstorm",
				specialists: [],
				conditionalSpecialists: [
					{ skill: "brainstorming", predicate: "style: brainstorming" },
					{ skill: "grilling", predicate: "style: grilling" },
					{ skill: "grill-me", predicate: "style: grilling + no codebase" },
					{ skill: "domain-modeling", predicate: "domain capture: on" },
				],
				next: ["spec"],
			},
			{
				name: "spec",
				specialists: ["to-spec"],
				next: ["tickets"],
			},
			{
				name: "tickets",
				specialists: ["to-tickets"],
				next: ["complete"],
			},
			{
				name: "wayfind",
				specialists: ["wayfinder"],
				next: ["complete", "setup", "spec"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "build", argPlaceholder: "<frontier>" },
			},
		],
	},
	{
		name: "build-workflow",
		promptPin: "build-workflow",
		stateFields: [
			"workflow", "phase", "ticket", "acceptance criteria",
			"slices completed", "slices remaining", "red", "root cause", "verification",
		],
		phases: [
			{
				name: "tdd",
				specialists: ["tdd"],
				conditionalSpecialists: [
					{ skill: "uv", predicate: "project is Python" },
				],
				next: ["diagnose", "complete"],
			},
			{
				name: "diagnose",
				specialists: ["diagnosing-bugs"],
				next: ["tdd"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "review" },
			},
		],
	},
	{
		name: "review-workflow",
		promptPin: "review-workflow",
		stateFields: ["workflow", "phase", "findings", "dispositions"],
		phases: [
			{
				name: "review",
				specialists: ["code-review"],
				next: ["disposition", "complete"],
			},
			{
				name: "disposition",
				specialists: ["receiving-code-review"],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "build" }, // or ship — conditional on findings
			},
		],
	},
	{
		name: "ship-workflow",
		promptPin: "ship-workflow",
		stateFields: [
			"workflow", "phase", "verification", "doc disposition",
			"commit hash", "pr url", "ci",
		],
		phases: [
			{
				name: "verify",
				specialists: ["verification-before-completion"],
				next: ["docs"],
			},
			{
				name: "docs",
				specialists: ["diff-driven-docs"],
				next: ["commit"],
			},
			{
				name: "commit",
				specialists: ["commit"],
				next: ["github"],
			},
			{
				name: "github",
				specialists: [],
				conditionalSpecialists: [
					{ skill: "github", predicate: "GitHub remote + user intent to push" },
				],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
			},
		],
	},
	{
		name: "research-workflow",
		promptPin: "research-workflow",
		stateFields: ["workflow", "phase", "research type", "findings", "sources"],
		phases: [
			{
				name: "classify",
				specialists: [],
				next: ["investigate"],
			},
			{
				name: "investigate",
				specialists: [],
				conditionalSpecialists: [
					{ skill: "research", predicate: "research type: general" },
					{ skill: "octocode-research", predicate: "research type: code" },
					{ skill: "live-research", predicate: "research type: deep-brief" },
				],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "plan" }, // or build, or stop — conditional
			},
		],
	},
	{
		name: "debug-workflow",
		promptPin: "debug-workflow",
		stateFields: ["workflow", "phase", "issue type", "root cause", "conflict resolved"],
		phases: [
			{
				name: "classify",
				specialists: [],
				next: ["diagnose", "resolve-conflict"],
			},
			{
				name: "diagnose",
				specialists: ["diagnosing-bugs"],
				next: ["complete"],
			},
			{
				name: "resolve-conflict",
				specialists: ["resolving-merge-conflicts"],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "build", argPlaceholder: "<fix>" },
			},
		],
	},
];

// ─── Reachability classification (two axes, non-overlapping) ───────────────

export interface ReachabilityEntry {
	skill: string;
	invocationSurface:
		| "workflow-prompt-pin"
		| "workflow-phase-read"
		| "extension-command"
		| "catalog-only"
		| "unavailable";
	productRole:
		| "orchestrator"
		| "normal-path-specialist"
		| "conditional-specialist"
		| "standalone-utility"
		| "domain-auto-triggered"
		| "superseded"
		| "community-on-demand";
	discoveryRoute: string;
	rationale: string;
}

// The ask-matt route dispositions (non-vacuous — each route has an explicit disposition)
export interface AskMattDisposition {
	askMattRoute: string;
	disposition: "equivalent" | "deliberate-substitution" | "intentional-standalone" | "intentional-unsupported";
	rationale: string;
}

export const ASK_MATT_DISPOSITIONS: AskMattDisposition[] = [
	{ askMattRoute: "grill-with-docs", disposition: "deliberate-substitution", rationale: "Decomposed into grilling (style) + domain-modeling (durable capture). Loading it would re-couple the dimensions we separated." },
	{ askMattRoute: "prototype", disposition: "equivalent", rationale: "Planning-workflow prototype interrupt (workflow-owned, consented)." },
	{ askMattRoute: "to-spec", disposition: "equivalent", rationale: "Planning-workflow spec phase." },
	{ askMattRoute: "to-tickets", disposition: "equivalent", rationale: "Planning-workflow tickets phase." },
	{ askMattRoute: "implement", disposition: "deliberate-substitution", rationale: "Decomposed into build-workflow (tdd) + review-workflow (code-review) + ship-workflow (commit). Invariants preserved." },
	{ askMattRoute: "tdd", disposition: "equivalent", rationale: "Build-workflow tdd phase." },
	{ askMattRoute: "code-review", disposition: "equivalent", rationale: "Review-workflow review phase (+ Security axis)." },
	{ askMattRoute: "triage", disposition: "equivalent", rationale: "/triage prompt (direct pin) + 8th Coach option." },
	{ askMattRoute: "diagnosing-bugs", disposition: "deliberate-substitution", rationale: "Debug-workflow (diagnose only) + build-workflow (fix with TDD). Split for independent observability." },
	{ askMattRoute: "wayfinder", disposition: "equivalent", rationale: "Planning-workflow wayfind phase." },
	{ askMattRoute: "improve-codebase-architecture", disposition: "intentional-standalone", rationale: "Codebase health (upkeep, not feature work). Reachable via /palette + AGENTS.md. Generates ideas → /plan." },
	{ askMattRoute: "domain-modeling", disposition: "equivalent", rationale: "Planning-workflow domain-modeling underlay (trigger-based)." },
	{ askMattRoute: "codebase-design", disposition: "intentional-standalone", rationale: "Vocabulary (on-demand). Reachable via /palette + AGENTS.md." },
	{ askMattRoute: "handoff", disposition: "equivalent", rationale: "handoff.ts extension + referenced in build/planning workflows." },
	{ askMattRoute: "compact", disposition: "equivalent", rationale: "Pi built-in /compact. Documented in AGENTS.md." },
	{ askMattRoute: "grill-me", disposition: "equivalent", rationale: "Planning-workflow no-codebase branch (when style: grilling + no codebase)." },
	{ askMattRoute: "teach", disposition: "intentional-standalone", rationale: "Learning tool (not SDLC). Reachable via /palette." },
	{ askMattRoute: "writing-great-skills", disposition: "intentional-standalone", rationale: "Reference (not SDLC). Reachable via /palette." },
	{ askMattRoute: "setup-matt-pocock-skills", disposition: "intentional-standalone", rationale: "One-time setup (not SDLC). Reachable via /palette." },
];
