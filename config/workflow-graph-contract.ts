// Machine-readable workflow graph contract for auto-pi v0.3+.
// This is NOT a runtime engine — it is a validation contract used by tests
// and as documentation of the intended graph. Tests validate that the
// SKILL.md files match this contract (phases, transitions, specialists,
// handoffs, state constraints) rather than inferring the graph from prose.
//
// Location: config/ (not test/) — this is the source of truth + documentation,
// not just a test fixture.

// ─── Phase definitions ─────────────────────────────────────────────────────

export interface ConditionalSpecialist {
	skill: string;
	predicate: string; // must be mutually exclusive with other conditional specialists in the same phase
}

export interface Handoff {
	command: string;
	argPlaceholder?: string;
	argFromState?: string; // the state field the argument value comes from (e.g., "frontier" → /build <frontier>)
}

export interface Outcome {
	predicate: string;
	handoff?: Handoff;
	terminal: boolean;
	evidenceFields: string[];
}

export interface StateConstraint {
	field: string;
	requiredOnEntry?: string[]; // allowed values when entering this phase
	requiredOnExit?: string[]; // allowed values when exiting this phase
}

export interface Interrupt {
	name: string;
	availableFrom: string[]; // phases this interrupt can be triggered from
	specialist: string; // the skill to read
	transitions: { from: string; to: string }[]; // state transitions (e.g., proposed → declined)
	resumePhase: string; // the phase to resume after the interrupt
}

export interface PhaseDef {
	name: string;
	specialists: string[]; // unconditional skills read in this phase
	conditionalSpecialists?: ConditionalSpecialist[];
	next?: string[]; // allowed next phases (by name)
	terminal?: boolean;
	outcomes?: Outcome[]; // conditional terminal outcomes (replaces single handoff)
	stateConstraints?: StateConstraint[]; // required state field values on entry/exit
	procedureScope?: string; // e.g., "Phases 1-4" — bounds which parts of the specialist procedure to follow
}

export interface WorkflowDef {
	name: string;
	promptPin: string;
	phases: PhaseDef[];
	stateFields: string[];
	stateDomains?: Record<string, string[]>; // allowed values for state fields
	interrupts?: Interrupt[];
}

// ─── The 6 workflows + triage ──────────────────────────────────────────────

export const WORKFLOWS: WorkflowDef[] = [
	{
		name: "planning-workflow",
		promptPin: "planning-workflow",
		stateFields: [
			"workflow",
			"mode",
			"phase",
			"design",
			"style",
			"domain capture",
			"domain artifacts",
			"prototype",
			"prototype question",
			"prototype conclusion",
			"unresolved design uncertainty",
			"resume phase",
			"spec",
			"tickets",
			"frontier",
			"map",
			"wayfind frontier",
			"outcome",
		],
		stateDomains: {
			mode: ["bounded", "foggy"],
			design: ["pending", "approved", "not-applicable"],
			style: ["brainstorming", "grilling", "not-applicable"],
			"domain capture": ["off", "on", "not-applicable"],
			"domain artifacts": ["none", "none-needed", "not-applicable"],
			prototype: ["not-needed", "proposed", "declined", "running", "complete"],
			"resume phase": ["not-applicable", "brainstorm"],
		},
		interrupts: [
			{
				name: "prototype",
				availableFrom: ["brainstorm"],
				specialist: "prototype",
				transitions: [
					{ from: "proposed", to: "declined" },
					{ from: "proposed", to: "running" },
					{ from: "running", to: "complete" },
				],
				resumePhase: "brainstorm",
			},
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
				stateConstraints: [
					{
						field: "style",
						requiredOnExit: ["brainstorming", "grilling", "not-applicable"],
					},
					{
						field: "domain capture",
						requiredOnExit: ["off", "on", "not-applicable"],
					},
				],
			},
			{
				name: "brainstorm",
				specialists: [],
				conditionalSpecialists: [
					{ skill: "brainstorming", predicate: "style=brainstorming" },
					{ skill: "grilling", predicate: "style=grilling && hasCodebase" },
					{ skill: "grill-me", predicate: "style=grilling && !hasCodebase" },
					{ skill: "domain-modeling", predicate: "domain capture=on" },
				],
				next: ["spec"],
				stateConstraints: [{ field: "design", requiredOnExit: ["approved"] }],
			},
			{
				name: "spec",
				specialists: ["to-spec"],
				next: ["tickets"],
				stateConstraints: [
					{ field: "design", requiredOnEntry: ["approved"] },
					{ field: "spec", requiredOnExit: ["<tracker reference>"] },
				],
			},
			{
				name: "tickets",
				specialists: ["to-tickets"],
				next: ["complete"],
				stateConstraints: [
					{ field: "spec", requiredOnEntry: ["<tracker reference>"] },
					{ field: "tickets", requiredOnExit: ["[<references>]"] },
					{ field: "frontier", requiredOnExit: ["<first unblocked ticket>"] },
				],
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
				outcomes: [
					{
						predicate: "mode=bounded",
						handoff: {
							command: "build",
							argPlaceholder: "<frontier>",
							argFromState: "frontier",
						},
						terminal: true,
						evidenceFields: ["spec", "tickets", "frontier"],
					},
					{
						predicate: "mode=foggy && outcome=map-charted",
						handoff: {
							command: "plan",
							argPlaceholder: "<map>",
							argFromState: "map",
						},
						terminal: true,
						evidenceFields: ["map", "wayfind frontier", "outcome"],
					},
					{
						predicate: "mode=foggy && outcome=decision-resolved",
						handoff: {
							command: "plan",
							argPlaceholder: "<map>",
							argFromState: "map",
						},
						terminal: true,
						evidenceFields: ["map", "wayfind frontier", "outcome"],
					},
				],
			},
		],
	},
	{
		name: "build-workflow",
		promptPin: "build-workflow",
		stateFields: [
			"workflow",
			"phase",
			"ticket",
			"acceptance criteria",
			"slices completed",
			"slices remaining",
			"red",
			"root cause",
			"verification",
		],
		phases: [
			{
				name: "tdd",
				specialists: ["tdd"],
				conditionalSpecialists: [
					{ skill: "uv", predicate: "project is Python" },
				],
				next: ["diagnose", "complete"],
				stateConstraints: [
					{ field: "ticket", requiredOnEntry: ["<one ticket>"] },
				],
			},
			{
				name: "diagnose",
				specialists: ["diagnosing-bugs"],
				next: ["tdd"],
				procedureScope: "Phases 1-4 (not Phase 5 — fix happens in tdd)",
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				outcomes: [
					{
						predicate: "all acceptance criteria met",
						handoff: { command: "review" },
						terminal: true,
						evidenceFields: ["verification"],
					},
				],
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
				outcomes: [
					{
						predicate: "findings exist",
						handoff: { command: "build" },
						terminal: true,
						evidenceFields: ["findings", "dispositions"],
					},
					{
						predicate: "findings=none",
						handoff: { command: "ship" },
						terminal: true,
						evidenceFields: ["findings"],
					},
				],
			},
		],
	},
	{
		name: "ship-workflow",
		promptPin: "ship-workflow",
		stateFields: [
			"workflow",
			"phase",
			"verification",
			"doc disposition",
			"commit hash",
			"pr url",
			"ci",
		],
		phases: [
			{
				name: "verify",
				specialists: ["verification-before-completion"],
				next: ["docs"],
				stateConstraints: [
					{
						field: "verification",
						requiredOnExit: ["<command + exit code + output>"],
					},
				],
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
				stateConstraints: [
					{ field: "commit hash", requiredOnExit: ["<hash>"] },
				],
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
				outcomes: [
					{
						predicate: "pr url != not-applicable",
						terminal: true,
						evidenceFields: ["commit hash", "pr url", "ci"],
					},
					{
						predicate: "pr url=not-applicable",
						terminal: true,
						evidenceFields: ["commit hash", "pr url"],
					},
				],
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
					{ skill: "research", predicate: "research type=general" },
					{ skill: "octocode-research", predicate: "research type=code" },
					{ skill: "live-research", predicate: "research type=deep-brief" },
				],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				outcomes: [
					{
						predicate: "findings suggest planning",
						handoff: { command: "plan" },
						terminal: true,
						evidenceFields: ["findings", "sources"],
					},
					{
						predicate: "findings suggest building",
						handoff: { command: "build" },
						terminal: true,
						evidenceFields: ["findings", "sources"],
					},
					{
						predicate: "research complete, no next action",
						terminal: true,
						evidenceFields: ["findings", "sources"],
					},
				],
			},
		],
	},
	{
		name: "debug-workflow",
		promptPin: "debug-workflow",
		stateFields: [
			"workflow",
			"phase",
			"issue type",
			"root cause",
			"conflict resolved",
		],
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
				procedureScope: "Phases 1-4 (not Phase 5 — fix happens in /build)",
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
				outcomes: [
					{
						predicate: "issue type=bug",
						handoff: {
							command: "build",
							argPlaceholder: "<fix>",
							argFromState: "root cause",
						},
						terminal: true,
						evidenceFields: ["root cause"],
					},
					{
						predicate: "issue type=merge-conflict",
						terminal: true,
						evidenceFields: ["conflict resolved"],
					},
				],
			},
		],
	},
];

// ─── Triage (direct-pinned state machine, not a workflow skill) ─────────────

export interface DirectPinnedStateMachine {
	kind: "direct-pinned-state-machine";
	name: string;
	prompt: string;
	promptPin: string;
	outcomes: TriageOutcome[];
}

export interface TriageOutcome {
	outcome: string;
	handoff?: Handoff;
	terminal: boolean;
	evidenceFields?: string[];
}

export const TRIAGE_OUTCOMES: TriageOutcome[] = [
	{
		outcome: "ready-for-agent",
		handoff: {
			command: "build",
			argPlaceholder: "<issue ref>",
			argFromState: "issue ref",
		},
		terminal: true,
		evidenceFields: ["issue ref", "agent-ready brief"],
	},
	{ outcome: "needs-info", terminal: true, evidenceFields: ["missing info"] },
	{
		outcome: "ready-for-human",
		terminal: true,
		evidenceFields: ["human decision needed"],
	},
	{ outcome: "wontfix", terminal: true, evidenceFields: ["close reason"] },
	{ outcome: "needs-triage", terminal: false, evidenceFields: [] },
	{ outcome: "list-query", terminal: true, evidenceFields: ["issue list"] },
];

export const TRIAGE_CONTRACT: DirectPinnedStateMachine = {
	kind: "direct-pinned-state-machine",
	name: "triage",
	prompt: "triage",
	promptPin: "triage",
	outcomes: TRIAGE_OUTCOMES,
};

// ─── Reachability (two axes, non-overlapping) ───────────────────────────────

export interface ReachabilityEntry {
	skill: string;
	invocationSurfaces: (
		| "workflow-prompt-pin"
		| "workflow-phase-read"
		| "extension-command"
		| "catalog-only"
		| "unavailable"
	)[];
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
	physicalPaths: string[]; // all paths where this skill exists
	selectedPath: string; // the path Pi actually resolves to (the winner)
	shadowedPaths: string[]; // paths that are shadowed by the selected path
}

// The entries are in the second part of this file (after the ask-matt dispositions).
export const REACHABILITY_ENTRIES: ReachabilityEntry[] = [
	{
		skill: "agent-browser",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:agent-browser",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/agent-browser/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/agent-browser/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "agents-sdk",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:agents-sdk",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/agents-sdk/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/agents-sdk/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "ask-matt",
		invocationSurfaces: ["catalog-only"],
		productRole: "superseded",
		discoveryRoute: "/palette + /skill:ask-matt",
		rationale: "superseded by auto-pi architecture",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/ask-matt/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/ask-matt/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "batch-grill-me",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:batch-grill-me",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/batch-grill-me/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/batch-grill-me/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "bearings",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:bearings",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: ["skills/bearings/SKILL.md"],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/bearings/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/bearings/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "brainstorming",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: ["skills/brainstorming/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/brainstorming/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/brainstorming/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "bright-data-best-practices",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:bright-data-best-practices",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/bright-data-best-practices/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/bright-data-best-practices/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "brightdata-cli",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:brightdata-cli",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/brightdata-cli/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/brightdata-cli/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "build-workflow",
		invocationSurfaces: ["workflow-prompt-pin"],
		productRole: "orchestrator",
		discoveryRoute: "Coach menu + prompt pin",
		rationale: "auto-pi workflow orchestrator",
		sourcePaths: ["skills/build-workflow/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/build-workflow/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/build-workflow/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "claude-handoff",
		invocationSurfaces: ["catalog-only"],
		productRole: "superseded",
		discoveryRoute: "/palette + /skill:claude-handoff",
		rationale: "superseded by auto-pi architecture",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/claude-handoff/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/claude-handoff/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "cloudflare",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:cloudflare",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/cloudflare/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/cloudflare/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "cloudflare-email-service",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:cloudflare-email-service",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/cloudflare-email-service/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/cloudflare-email-service/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "cloudflare-one",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:cloudflare-one",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/cloudflare-one/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/cloudflare-one/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "cloudflare-one-migrations",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:cloudflare-one-migrations",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/cloudflare-one-migrations/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/cloudflare-one-migrations/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "code-review",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: ["skills/code-review/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/code-review/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/code-review/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "codebase-design",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:codebase-design",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/codebase-design/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/codebase-design/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "codebase-hygiene",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:codebase-hygiene",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: ["skills/codebase-hygiene/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/codebase-hygiene/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/codebase-hygiene/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "commit",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/commit/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/commit/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "compact-safe",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:compact-safe",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/compact-safe/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/compact-safe/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "data-feeds",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:data-feeds",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/data-feeds/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.pi/agent/skills/data-feeds/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "debug-workflow",
		invocationSurfaces: ["workflow-prompt-pin"],
		productRole: "orchestrator",
		discoveryRoute: "Coach menu + prompt pin",
		rationale: "auto-pi workflow orchestrator",
		sourcePaths: ["skills/debug-workflow/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/debug-workflow/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/debug-workflow/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "decision-hold-lifecycle",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:decision-hold-lifecycle",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: ["skills/decision-hold-lifecycle/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/decision-hold-lifecycle/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/decision-hold-lifecycle/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "deploy-to-vercel",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:deploy-to-vercel",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/deploy-to-vercel/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/deploy-to-vercel/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "design-an-interface",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:design-an-interface",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/design-an-interface/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/design-an-interface/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "design-heuristic-evaluation",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:design-heuristic-evaluation",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/design-heuristic-evaluation/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/design-heuristic-evaluation/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "diagnosing-bugs",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: ["skills/diagnosing-bugs/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "diff-driven-docs",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: ["skills/diff-driven-docs/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/diff-driven-docs/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/diff-driven-docs/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "discover-api",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:discover-api",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/discover-api/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/discover-api/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "domain-modeling",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "conditional-specialist",
		discoveryRoute: "workflow phase read (conditional)",
		rationale: "conditional specialist — read only when predicate matches",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/domain-modeling/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/domain-modeling/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "durable-objects",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:durable-objects",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/durable-objects/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/durable-objects/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "edit-article",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:edit-article",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/edit-article/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/edit-article/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "find-skills",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:find-skills",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/find-skills/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/find-skills/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "frontend-design",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:frontend-design",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/frontend-design/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/frontend-design/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "git-guardrails-claude-code",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:git-guardrails-claude-code",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/git-guardrails-claude-code/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/git-guardrails-claude-code/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "github",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/github/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/github/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "grill-me",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "conditional-specialist",
		discoveryRoute: "workflow phase read (conditional)",
		rationale: "conditional specialist — read only when predicate matches",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/grill-me/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/grill-me/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "grill-with-docs",
		invocationSurfaces: ["catalog-only"],
		productRole: "superseded",
		discoveryRoute: "/palette + /skill:grill-with-docs",
		rationale: "superseded by auto-pi architecture",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/grill-with-docs/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/grill-with-docs/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "grilling",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: ["skills/grilling/SKILL.md"],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/grilling/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/grilling/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "handoff",
		invocationSurfaces: ["extension-command"],
		productRole: "standalone-utility",
		discoveryRoute: "/handoff extension command",
		rationale: "extension-backed cross-session transfer",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/handoff/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/handoff/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "herdr",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:herdr",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/herdr/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/herdr/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "hyperadar-stack-gotchas",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:hyperadar-stack-gotchas",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/hyperadar-stack-gotchas/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/hyperadar-stack-gotchas/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "impeccable",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:impeccable",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/impeccable/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/impeccable/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "implement",
		invocationSurfaces: ["catalog-only"],
		productRole: "superseded",
		discoveryRoute: "/palette + /skill:implement",
		rationale: "superseded by auto-pi architecture",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/implement/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/implement/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "improve-codebase-architecture",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:improve-codebase-architecture",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/improve-codebase-architecture/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/improve-codebase-architecture/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "live-heuristic-evaluation",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:live-heuristic-evaluation",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/live-heuristic-evaluation/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/live-heuristic-evaluation/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "live-research",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "conditional-specialist",
		discoveryRoute: "workflow phase read (conditional)",
		rationale: "conditional specialist — read only when predicate matches",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/live-research/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/live-research/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "loop-me",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:loop-me",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/loop-me/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/loop-me/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "memory-compounding",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:memory-compounding",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: ["skills/memory-compounding/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/memory-compounding/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/memory-compounding/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "migrate-to-shoehorn",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:migrate-to-shoehorn",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/migrate-to-shoehorn/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/migrate-to-shoehorn/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "mongodb-atlas-stream-processing",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:mongodb-atlas-stream-processing",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/mongodb-atlas-stream-processing/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/mongodb-atlas-stream-processing/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "mongodb-connection",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:mongodb-connection",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/mongodb-connection/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/mongodb-connection/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "mongodb-mcp-cluster-per-project",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:mongodb-mcp-cluster-per-project",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/mongodb-mcp-cluster-per-project/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/mongodb-mcp-cluster-per-project/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "mongodb-mcp-setup",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:mongodb-mcp-setup",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/mongodb-mcp-setup/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/mongodb-mcp-setup/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "mongodb-natural-language-querying",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:mongodb-natural-language-querying",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/mongodb-natural-language-querying/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/mongodb-natural-language-querying/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "mongodb-query-optimizer",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:mongodb-query-optimizer",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/mongodb-query-optimizer/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/mongodb-query-optimizer/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "mongodb-schema-design",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:mongodb-schema-design",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/mongodb-schema-design/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/mongodb-schema-design/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "mongodb-search-and-ai",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:mongodb-search-and-ai",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/mongodb-search-and-ai/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/mongodb-search-and-ai/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "obsidian-vault",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:obsidian-vault",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/obsidian-vault/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/obsidian-vault/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "octocode",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:octocode",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/octocode/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/octocode/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "octocode-brainstorming",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:octocode-brainstorming",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/octocode-brainstorming/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/octocode-brainstorming/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "octocode-research",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "conditional-specialist",
		discoveryRoute: "workflow phase read (conditional)",
		rationale: "conditional specialist — read only when predicate matches",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/octocode-research/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/octocode-research/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "octocode-rfc-generator",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:octocode-rfc-generator",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/octocode-rfc-generator/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/octocode-rfc-generator/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "octocode-roast",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:octocode-roast",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/octocode-roast/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/octocode-roast/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "pi-hermes-memory-cleanup",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:pi-hermes-memory-cleanup",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/pi-hermes-memory-cleanup/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/pi-hermes-memory-cleanup/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "pi-update-cache-bypass",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:pi-update-cache-bypass",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/pi-update-cache-bypass/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/pi-update-cache-bypass/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "planning-workflow",
		invocationSurfaces: ["workflow-prompt-pin"],
		productRole: "orchestrator",
		discoveryRoute: "Coach menu + prompt pin",
		rationale: "auto-pi workflow orchestrator",
		sourcePaths: ["skills/planning-workflow/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/planning-workflow/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/planning-workflow/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "port-api-blueprint-creation",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:port-api-blueprint-creation",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/port-api-blueprint-creation/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/port-api-blueprint-creation/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "prototype",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "conditional-specialist",
		discoveryRoute: "workflow phase read (conditional)",
		rationale: "conditional specialist — read only when predicate matches",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/prototype/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/prototype/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "qa",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:qa",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/qa/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/qa/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "rag-pipeline",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:rag-pipeline",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.pi/agent/skills/rag-pipeline/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.pi/agent/skills/rag-pipeline/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "receiving-code-review",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: ["skills/receiving-code-review/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/receiving-code-review/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/receiving-code-review/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "request-refactor-plan",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:request-refactor-plan",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/request-refactor-plan/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/request-refactor-plan/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "research",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/research/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/research/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "research-workflow",
		invocationSurfaces: ["workflow-prompt-pin"],
		productRole: "orchestrator",
		discoveryRoute: "Coach menu + prompt pin",
		rationale: "auto-pi workflow orchestrator",
		sourcePaths: ["skills/research-workflow/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/research-workflow/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/research-workflow/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "resolving-merge-conflicts",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "conditional-specialist",
		discoveryRoute: "workflow phase read (conditional)",
		rationale: "conditional specialist — read only when predicate matches",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/resolving-merge-conflicts/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/resolving-merge-conflicts/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "review-workflow",
		invocationSurfaces: ["workflow-prompt-pin"],
		productRole: "orchestrator",
		discoveryRoute: "Coach menu + prompt pin",
		rationale: "auto-pi workflow orchestrator",
		sourcePaths: ["skills/review-workflow/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/review-workflow/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/review-workflow/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "sandbox-sdk",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:sandbox-sdk",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/sandbox-sdk/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/sandbox-sdk/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "scaffold-exercises",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:scaffold-exercises",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/scaffold-exercises/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/scaffold-exercises/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "scrape",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:scrape",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.pi/agent/skills/scrape/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.pi/agent/skills/scrape/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "search",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:search",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.pi/agent/skills/search/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.pi/agent/skills/search/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "session-handoff",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:session-handoff",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: ["skills/session-handoff/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/session-handoff/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/session-handoff/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "setup-maintenance",
		invocationSurfaces: ["workflow-prompt-pin"],
		productRole: "standalone-utility",
		discoveryRoute: "Coach menu + direct prompt pin",
		rationale: "direct-pinned self-contained state machine",
		sourcePaths: ["skills/setup-maintenance/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/setup-maintenance/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/setup-maintenance/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "setup-matt-pocock-skills",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:setup-matt-pocock-skills",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: ["skills/setup-matt-pocock-skills/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/setup-matt-pocock-skills/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/setup-matt-pocock-skills/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "setup-pre-commit",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:setup-pre-commit",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/setup-pre-commit/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/setup-pre-commit/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "setup-ts-deep-modules",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:setup-ts-deep-modules",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/setup-ts-deep-modules/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/setup-ts-deep-modules/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "ship-workflow",
		invocationSurfaces: ["workflow-prompt-pin"],
		productRole: "orchestrator",
		discoveryRoute: "Coach menu + prompt pin",
		rationale: "auto-pi workflow orchestrator",
		sourcePaths: ["skills/ship-workflow/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/ship-workflow/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/ship-workflow/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "tdd",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/tdd/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/tdd/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "teach",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:teach",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/teach/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/teach/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "to-questionnaire",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:to-questionnaire",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/to-questionnaire/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/to-questionnaire/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "to-spec",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/to-spec/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/to-spec/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "to-tickets",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/to-tickets/SKILL.md",
		],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/to-tickets/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "triage",
		invocationSurfaces: ["workflow-prompt-pin"],
		productRole: "standalone-utility",
		discoveryRoute: "Coach menu + direct prompt pin",
		rationale: "direct-pinned self-contained state machine",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/triage/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/triage/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "turnstile-spin",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:turnstile-spin",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/turnstile-spin/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/turnstile-spin/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "ubiquitous-language",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:ubiquitous-language",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/ubiquitous-language/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/ubiquitous-language/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "upgrade-advisor",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:upgrade-advisor",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/upgrade-advisor/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/upgrade-advisor/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "uv",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "conditional-specialist",
		discoveryRoute: "workflow phase read (conditional)",
		rationale: "conditional specialist — read only when predicate matches",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/uv/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/uv/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "vercel-composition-patterns",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:vercel-composition-patterns",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/vercel-composition-patterns/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/vercel-composition-patterns/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "vercel-optimize",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:vercel-optimize",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/vercel-optimize/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/vercel-optimize/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "vercel-react-best-practices",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:vercel-react-best-practices",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/vercel-react-best-practices/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/vercel-react-best-practices/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "verification-before-completion",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: ["skills/verification-before-completion/SKILL.md"],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/verification-before-completion/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/verification-before-completion/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "wayfinder",
		invocationSurfaces: ["workflow-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "workflow phase read",
		rationale: "read by a workflow at a phase boundary",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/wayfinder/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/wayfinder/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "web-design-guidelines",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:web-design-guidelines",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/web-design-guidelines/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/web-design-guidelines/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "web-perf",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:web-perf",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/web-perf/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/web-perf/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "wizard",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:wizard",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/wizard/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/wizard/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "workers-best-practices",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:workers-best-practices",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/workers-best-practices/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/workers-best-practices/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "wrangler",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:wrangler",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: ["/Users/rom.iluz/.agents/skills/wrangler/SKILL.md"],
		selectedRuntimePath: "/Users/rom.iluz/.agents/skills/wrangler/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "writing-awesome-readmes",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:writing-awesome-readmes",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/writing-awesome-readmes/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/writing-awesome-readmes/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "writing-beats",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:writing-beats",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/writing-beats/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/writing-beats/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "writing-fragments",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:writing-fragments",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/writing-fragments/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/writing-fragments/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "writing-great-skills",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:writing-great-skills",
		rationale: "auto-pi repo skill (standalone utility)",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/writing-great-skills/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/writing-great-skills/SKILL.md",
		shadowedRuntimePaths: [],
	},
	{
		skill: "writing-shape",
		invocationSurfaces: ["catalog-only"],
		productRole: "community-on-demand",
		discoveryRoute: "/palette + /skill:writing-shape",
		rationale: "community skill, available on-demand",
		sourcePaths: [],
		runtimePhysicalPaths: [
			"/Users/rom.iluz/.agents/skills/writing-shape/SKILL.md",
		],
		selectedRuntimePath:
			"/Users/rom.iluz/.agents/skills/writing-shape/SKILL.md",
		shadowedRuntimePaths: [],
	},
];

// ─── Ask-matt dispositions (structured harmony evidence) ───────────────────

export interface AskMattDisposition {
	askMattRoute: string;
	sourceCommit: string; // the upstream ask-matt base commit (skill content unchanged since ed37663; repo HEAD at 2ab9580)
	disposition:
		| "equivalent"
		| "deliberate-substitution"
		| "intentional-standalone"
		| "intentional-unsupported";
	trigger: string;
	invariants: string;
	artifacts: string;
	exit: string;
	autoPiRoute: string;
	rationale: string;
}

export const ASK_MATT_DISPOSITIONS: AskMattDisposition[] = [
	{
		askMattRoute: "grill-with-docs",
		sourceCommit: "ed37663",
		disposition: "deliberate-substitution",
		trigger: "bounded work needing durable domain record",
		invariants: "collaborative approval + durable domain capture",
		artifacts: "approved design + CONTEXT.md/ADR",
		exit: "spec phase",
		autoPiRoute:
			"planning-workflow setup + brainstorm (grilling + domain-modeling)",
		rationale:
			"Decomposed — loading grill-with-docs would re-couple the dimensions we separated.",
	},
	{
		askMattRoute: "prototype",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "design question needs runnable answer",
		invariants: "throwaway, one command, no persistence",
		artifacts: "answer captured",
		exit: "resume design phase",
		autoPiRoute: "planning-workflow prototype interrupt",
		rationale: "Workflow-owned, consented interrupt.",
	},
	{
		askMattRoute: "to-spec",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "bounded, design approved",
		invariants: "seam confirmation",
		artifacts: "spec reference",
		exit: "tickets phase",
		autoPiRoute: "planning-workflow spec phase",
		rationale: "Direct equivalent.",
	},
	{
		askMattRoute: "to-tickets",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "spec published",
		invariants: "ticket-breakdown approval",
		artifacts: "ticket refs + frontier",
		exit: "complete → /build",
		autoPiRoute: "planning-workflow tickets phase",
		rationale: "Direct equivalent.",
	},
	{
		askMattRoute: "implement",
		sourceCommit: "ed37663",
		disposition: "deliberate-substitution",
		trigger: "a ticket",
		invariants: "tdd red-green, fresh context per ticket, review before commit",
		artifacts: "verification evidence, commit hash",
		exit: "review → ship",
		autoPiRoute: "build-workflow + review-workflow + ship-workflow",
		rationale:
			"Decomposed for independent observability. Invariants preserved.",
	},
	{
		askMattRoute: "tdd",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "a slice",
		invariants: "red-green one slice at a time",
		artifacts: "passing test",
		exit: "diagnose or complete",
		autoPiRoute: "build-workflow tdd phase",
		rationale: "Direct equivalent.",
	},
	{
		askMattRoute: "code-review",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "uncommitted diff",
		invariants: "standards + spec (+ security)",
		artifacts: "findings with file:line",
		exit: "disposition or complete",
		autoPiRoute: "review-workflow review phase",
		rationale: "Direct equivalent + Security axis.",
	},
	{
		askMattRoute: "triage",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "incoming raw issues/PRs",
		invariants: "triage roles, not to-tickets output",
		artifacts: "agent-ready briefs",
		exit: "/build when ready-for-agent",
		autoPiRoute: "/triage prompt (direct pin) + 8th Coach option",
		rationale: "Direct equivalent.",
	},
	{
		askMattRoute: "diagnosing-bugs",
		sourceCommit: "ed37663",
		disposition: "deliberate-substitution",
		trigger: "bug",
		invariants: "feedback loop, root cause (Phases 1-4 only)",
		artifacts: "root cause diagnosis",
		exit: "/build (fix with TDD)",
		autoPiRoute: "debug-workflow (diagnose) + build-workflow (fix)",
		rationale: "Split — diagnosis only, fix in /build via TDD.",
	},
	{
		askMattRoute: "wayfinder",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "foggy",
		invariants: "decisions, not deliverables",
		artifacts: "map reference + outcome",
		exit: "resume or route",
		autoPiRoute: "planning-workflow wayfind phase",
		rationale: "Direct equivalent.",
	},
	{
		askMattRoute: "improve-codebase-architecture",
		sourceCommit: "ed37663",
		disposition: "intentional-standalone",
		trigger: "spare moment for codebase health",
		invariants: "surfaces deepening opportunities",
		artifacts: "ideas",
		exit: "/plan",
		autoPiRoute: "/palette + AGENTS.md",
		rationale: "Upkeep, not feature work.",
	},
	{
		askMattRoute: "domain-modeling",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "domain terms/ADRs need capture",
		invariants: "glossary when resolved, ADR when hard-to-reverse",
		artifacts: "CONTEXT.md/ADR",
		exit: "resume planning",
		autoPiRoute: "planning-workflow domain-modeling underlay",
		rationale: "Trigger-based underlay.",
	},
	{
		askMattRoute: "codebase-design",
		sourceCommit: "ed37663",
		disposition: "intentional-standalone",
		trigger: "module shape design",
		invariants: "deep-module vocabulary",
		artifacts: "design",
		exit: "—",
		autoPiRoute: "/palette + AGENTS.md",
		rationale: "Vocabulary, on-demand.",
	},
	{
		askMattRoute: "handoff",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "session full / branch off",
		invariants: "preserve context",
		artifacts: "HANDOFF.md",
		exit: "fresh session",
		autoPiRoute: "handoff.ts extension",
		rationale: "Direct equivalent.",
	},
	{
		askMattRoute: "compact",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "intentional break between phases",
		invariants: "stay in same conversation",
		artifacts: "summarized context",
		exit: "continue",
		autoPiRoute: "Pi built-in /compact",
		rationale: "Direct equivalent (built-in).",
	},
	{
		askMattRoute: "grill-me",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "no codebase + grilling requested",
		invariants: "stateless, saves nothing locally",
		artifacts: "sharpened plan",
		exit: "resume planning",
		autoPiRoute: "planning-workflow no-codebase grilling branch",
		rationale: "Direct equivalent (no-codebase branch).",
	},
	{
		askMattRoute: "research",
		sourceCommit: "ed37663",
		disposition: "equivalent",
		trigger: "need cited findings from primary sources",
		invariants: "high-trust primary sources",
		artifacts: "cited markdown file",
		exit: "/plan or /build",
		autoPiRoute: "research-workflow",
		rationale: "Direct equivalent.",
	},
	{
		askMattRoute: "teach",
		sourceCommit: "ed37663",
		disposition: "intentional-standalone",
		trigger: "learn a concept",
		invariants: "multi-session workspace",
		artifacts: "learned concept",
		exit: "—",
		autoPiRoute: "/palette",
		rationale: "Learning tool, not SDLC.",
	},
	{
		askMattRoute: "writing-great-skills",
		sourceCommit: "ed37663",
		disposition: "intentional-standalone",
		trigger: "write/edit skills",
		invariants: "skill vocabulary",
		artifacts: "skill file",
		exit: "—",
		autoPiRoute: "/palette",
		rationale: "Reference, not SDLC.",
	},
	{
		askMattRoute: "setup-matt-pocock-skills",
		sourceCommit: "ed37663",
		disposition: "intentional-standalone",
		trigger: "first engineering flow",
		invariants: "configure issue tracker",
		artifacts: "tracker config",
		exit: "—",
		autoPiRoute: "/palette",
		rationale: "One-time setup.",
	},
];

// ─── Ask-matt source metadata ──────────────────────────────────────────────
export const ASK_MATT_SOURCE = {
	repoHeadChecked: "2ab9580",
	skillBaseCommit: "ed37663",
	sha256: "b1a134ada29cbfded84bc9a7f93356ab7a3d7f800edf1f541a2a964118ad45a7",
	repo: "https://github.com/mattpocock/skills.git",
	path: "skills/engineering/ask-matt/SKILL.md",
};

// The exact set of ask-matt routes expected from the upstream skill content
// at commit ed37663. If upstream adds a route, this set must be updated.
export const EXPECTED_ASK_MATT_ROUTES = [
	"grill-with-docs",
	"prototype",
	"to-spec",
	"to-tickets",
	"implement",
	"tdd",
	"code-review",
	"triage",
	"diagnosing-bugs",
	"wayfinder",
	"improve-codebase-architecture",
	"domain-modeling",
	"codebase-design",
	"handoff",
	"compact",
	"grill-me",
	"research",
	"teach",
	"writing-great-skills",
	"setup-matt-pocock-skills",
];
