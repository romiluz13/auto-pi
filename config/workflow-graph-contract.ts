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

export interface Outcome {
	predicate: string; // the condition for this outcome
	handoff?: { command: string; argPlaceholder?: string };
	terminal: boolean;
	evidenceFields: string[]; // state fields that must be set for this outcome
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
}

export interface WorkflowDef {
	name: string;
	promptPin: string;
	phases: PhaseDef[];
	stateFields: string[];
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
			"spec",
			"tickets",
			"frontier",
		],
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
						requiredOnExit: [
							"brainstorming",
							"grilling",
							"grill-me",
							"not-applicable",
						],
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
						handoff: { command: "build", argPlaceholder: "<frontier>" },
						terminal: true,
						evidenceFields: ["spec", "tickets", "frontier"],
					},
					{
						predicate: "mode=foggy && outcome=map-charted",
						handoff: { command: "plan", argPlaceholder: "<map>" },
						terminal: true,
						evidenceFields: ["map", "wayfind frontier", "outcome"],
					},
					{
						predicate: "mode=foggy && outcome=decision-resolved",
						handoff: { command: "plan", argPlaceholder: "<map>" },
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
				// Procedure scope: Phases 1-4 only (not Phase 5 — fix happens in tdd)
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
				// Procedure scope: Phases 1-4 only (not Phase 5 — fix happens in /build)
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
						handoff: { command: "build", argPlaceholder: "<fix>" },
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

export interface TriageOutcome {
	outcome: string;
	handoff?: { command: string; argPlaceholder?: string };
	terminal: boolean;
}

export const TRIAGE_OUTCOMES: TriageOutcome[] = [
	{
		outcome: "ready-for-agent",
		handoff: { command: "build", argPlaceholder: "<issue ref>" },
		terminal: true,
	},
	{ outcome: "needs-info", terminal: true },
	{ outcome: "ready-for-human", terminal: true },
	{ outcome: "wontfix", terminal: true },
	{ outcome: "needs-triage", terminal: false },
	{ outcome: "list-query", terminal: true },
];

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
{ skill: "agent-browser", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:agent-browser", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/agent-browser/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/agent-browser/SKILL.md", shadowedPaths: [] },
  { skill: "agents-sdk", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:agents-sdk", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/agents-sdk/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/agents-sdk/SKILL.md", shadowedPaths: [] },
  { skill: "ask-matt", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:ask-matt", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/ask-matt/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/ask-matt/SKILL.md", shadowedPaths: [] },
  { skill: "batch-grill-me", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:batch-grill-me", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/batch-grill-me/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/batch-grill-me/SKILL.md", shadowedPaths: [] },
  { skill: "bearings", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:bearings", rationale: "community skill, available on-demand", physicalPaths: ["skills/bearings/SKILL.md", "/Users/rom.iluz/.agents/skills/bearings/SKILL.md"], selectedPath: "skills/bearings/SKILL.md", shadowedPaths: ["/Users/rom.iluz/.agents/skills/bearings/SKILL.md"] },
  { skill: "brainstorming", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["skills/brainstorming/SKILL.md", "/Users/rom.iluz/.agents/skills/brainstorming/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/brainstorming/SKILL.md", shadowedPaths: ["skills/brainstorming/SKILL.md"] },
  { skill: "bright-data-best-practices", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:bright-data-best-practices", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/bright-data-best-practices/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/bright-data-best-practices/SKILL.md", shadowedPaths: [] },
  { skill: "brightdata-cli", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:brightdata-cli", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/brightdata-cli/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/brightdata-cli/SKILL.md", shadowedPaths: [] },
  { skill: "build-workflow", invocationSurfaces: ["workflow-prompt-pin"], productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator", physicalPaths: ["skills/build-workflow/SKILL.md", "/Users/rom.iluz/.agents/skills/build-workflow/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/build-workflow/SKILL.md", shadowedPaths: ["skills/build-workflow/SKILL.md"] },
  { skill: "claude-handoff", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:claude-handoff", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/claude-handoff/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/claude-handoff/SKILL.md", shadowedPaths: [] },
  { skill: "cloudflare", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/cloudflare/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/cloudflare/SKILL.md", shadowedPaths: [] },
  { skill: "cloudflare-email-service", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-email-service", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/cloudflare-email-service/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/cloudflare-email-service/SKILL.md", shadowedPaths: [] },
  { skill: "cloudflare-one", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-one", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/cloudflare-one/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/cloudflare-one/SKILL.md", shadowedPaths: [] },
  { skill: "cloudflare-one-migrations", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-one-migrations", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/cloudflare-one-migrations/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/cloudflare-one-migrations/SKILL.md", shadowedPaths: [] },
  { skill: "code-review", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["skills/code-review/SKILL.md", "/Users/rom.iluz/.agents/skills/code-review/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/code-review/SKILL.md", shadowedPaths: ["skills/code-review/SKILL.md"] },
  { skill: "codebase-design", invocationSurfaces: ["catalog-only"], productRole: "standalone-utility", discoveryRoute: "/palette + /skill:codebase-design", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)", physicalPaths: ["/Users/rom.iluz/.agents/skills/codebase-design/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/codebase-design/SKILL.md", shadowedPaths: [] },
  { skill: "codebase-hygiene", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:codebase-hygiene", rationale: "community skill, available on-demand", physicalPaths: ["skills/codebase-hygiene/SKILL.md", "/Users/rom.iluz/.agents/skills/codebase-hygiene/SKILL.md"], selectedPath: "skills/codebase-hygiene/SKILL.md", shadowedPaths: ["/Users/rom.iluz/.agents/skills/codebase-hygiene/SKILL.md"] },
  { skill: "commit", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["/Users/rom.iluz/.agents/skills/commit/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/commit/SKILL.md", shadowedPaths: [] },
  { skill: "compact-safe", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:compact-safe", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/compact-safe/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/compact-safe/SKILL.md", shadowedPaths: [] },
  { skill: "data-feeds", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:data-feeds", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/data-feeds/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/data-feeds/SKILL.md", shadowedPaths: [] },
  { skill: "debug-workflow", invocationSurfaces: ["workflow-prompt-pin"], productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator", physicalPaths: ["skills/debug-workflow/SKILL.md", "/Users/rom.iluz/.agents/skills/debug-workflow/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/debug-workflow/SKILL.md", shadowedPaths: ["skills/debug-workflow/SKILL.md"] },
  { skill: "decision-hold-lifecycle", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:decision-hold-lifecycle", rationale: "community skill, available on-demand", physicalPaths: ["skills/decision-hold-lifecycle/SKILL.md", "/Users/rom.iluz/.agents/skills/decision-hold-lifecycle/SKILL.md"], selectedPath: "skills/decision-hold-lifecycle/SKILL.md", shadowedPaths: ["/Users/rom.iluz/.agents/skills/decision-hold-lifecycle/SKILL.md"] },
  { skill: "deploy-to-vercel", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:deploy-to-vercel", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/deploy-to-vercel/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/deploy-to-vercel/SKILL.md", shadowedPaths: [] },
  { skill: "design-an-interface", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:design-an-interface", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/design-an-interface/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/design-an-interface/SKILL.md", shadowedPaths: [] },
  { skill: "design-heuristic-evaluation", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:design-heuristic-evaluation", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/design-heuristic-evaluation/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/design-heuristic-evaluation/SKILL.md", shadowedPaths: [] },
  { skill: "diagnosing-bugs", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["skills/diagnosing-bugs/SKILL.md", "/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md", shadowedPaths: ["skills/diagnosing-bugs/SKILL.md"] },
  { skill: "diff-driven-docs", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["skills/diff-driven-docs/SKILL.md", "/Users/rom.iluz/.agents/skills/diff-driven-docs/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/diff-driven-docs/SKILL.md", shadowedPaths: ["skills/diff-driven-docs/SKILL.md"] },
  { skill: "discover-api", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:discover-api", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/discover-api/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/discover-api/SKILL.md", shadowedPaths: [] },
  { skill: "domain-modeling", invocationSurfaces: ["workflow-phase-read"], productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches", physicalPaths: ["/Users/rom.iluz/.agents/skills/domain-modeling/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/domain-modeling/SKILL.md", shadowedPaths: [] },
  { skill: "durable-objects", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:durable-objects", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/durable-objects/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/durable-objects/SKILL.md", shadowedPaths: [] },
  { skill: "edit-article", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:edit-article", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/edit-article/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/edit-article/SKILL.md", shadowedPaths: [] },
  { skill: "find-skills", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:find-skills", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/find-skills/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/find-skills/SKILL.md", shadowedPaths: [] },
  { skill: "frontend-design", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:frontend-design", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/frontend-design/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/frontend-design/SKILL.md", shadowedPaths: [] },
  { skill: "git-guardrails-claude-code", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:git-guardrails-claude-code", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/git-guardrails-claude-code/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/git-guardrails-claude-code/SKILL.md", shadowedPaths: [] },
  { skill: "github", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["/Users/rom.iluz/.agents/skills/github/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/github/SKILL.md", shadowedPaths: [] },
  { skill: "grill-me", invocationSurfaces: ["workflow-phase-read"], productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches", physicalPaths: ["/Users/rom.iluz/.agents/skills/grill-me/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/grill-me/SKILL.md", shadowedPaths: [] },
  { skill: "grill-with-docs", invocationSurfaces: ["catalog-only"], productRole: "superseded", discoveryRoute: "/palette only (expert/manual use)", rationale: "superseded by grilling + domain-modeling decomposition", physicalPaths: ["/Users/rom.iluz/.agents/skills/grill-with-docs/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/grill-with-docs/SKILL.md", shadowedPaths: [] },
  { skill: "grilling", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["skills/grilling/SKILL.md", "/Users/rom.iluz/.agents/skills/grilling/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/grilling/SKILL.md", shadowedPaths: ["skills/grilling/SKILL.md"] },
  { skill: "handoff", invocationSurfaces: ["extension-command"], productRole: "standalone-utility", discoveryRoute: "/handoff extension command", rationale: "extension-backed cross-session transfer", physicalPaths: ["/Users/rom.iluz/.agents/skills/handoff/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/handoff/SKILL.md", shadowedPaths: [] },
  { skill: "herdr", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:herdr", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/herdr/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/herdr/SKILL.md", shadowedPaths: [] },
  { skill: "hyperadar-stack-gotchas", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:hyperadar-stack-gotchas", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/hyperadar-stack-gotchas/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/hyperadar-stack-gotchas/SKILL.md", shadowedPaths: [] },
  { skill: "impeccable", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:impeccable", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/impeccable/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/impeccable/SKILL.md", shadowedPaths: [] },
  { skill: "implement", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:implement", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/implement/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/implement/SKILL.md", shadowedPaths: [] },
  { skill: "improve-codebase-architecture", invocationSurfaces: ["catalog-only"], productRole: "standalone-utility", discoveryRoute: "/palette + /skill:improve-codebase-architecture", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)", physicalPaths: ["/Users/rom.iluz/.agents/skills/improve-codebase-architecture/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/improve-codebase-architecture/SKILL.md", shadowedPaths: [] },
  { skill: "live-heuristic-evaluation", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:live-heuristic-evaluation", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/live-heuristic-evaluation/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/live-heuristic-evaluation/SKILL.md", shadowedPaths: [] },
  { skill: "live-research", invocationSurfaces: ["workflow-phase-read"], productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/live-research/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/live-research/SKILL.md", shadowedPaths: [] },
  { skill: "loop-me", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:loop-me", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/loop-me/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/loop-me/SKILL.md", shadowedPaths: [] },
  { skill: "memory-compounding", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:memory-compounding", rationale: "community skill, available on-demand", physicalPaths: ["skills/memory-compounding/SKILL.md", "/Users/rom.iluz/.agents/skills/memory-compounding/SKILL.md"], selectedPath: "skills/memory-compounding/SKILL.md", shadowedPaths: ["/Users/rom.iluz/.agents/skills/memory-compounding/SKILL.md"] },
  { skill: "migrate-to-shoehorn", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:migrate-to-shoehorn", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/migrate-to-shoehorn/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/migrate-to-shoehorn/SKILL.md", shadowedPaths: [] },
  { skill: "mongodb-atlas-stream-processing", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-atlas-stream-processing", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/mongodb-atlas-stream-processing/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/mongodb-atlas-stream-processing/SKILL.md", shadowedPaths: [] },
  { skill: "mongodb-connection", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-connection", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/mongodb-connection/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/mongodb-connection/SKILL.md", shadowedPaths: [] },
  { skill: "mongodb-mcp-cluster-per-project", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-mcp-cluster-per-project", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/mongodb-mcp-cluster-per-project/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/mongodb-mcp-cluster-per-project/SKILL.md", shadowedPaths: [] },
  { skill: "mongodb-mcp-setup", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-mcp-setup", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/mongodb-mcp-setup/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/mongodb-mcp-setup/SKILL.md", shadowedPaths: [] },
  { skill: "mongodb-natural-language-querying", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-natural-language-querying", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/mongodb-natural-language-querying/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/mongodb-natural-language-querying/SKILL.md", shadowedPaths: [] },
  { skill: "mongodb-query-optimizer", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-query-optimizer", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/mongodb-query-optimizer/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/mongodb-query-optimizer/SKILL.md", shadowedPaths: [] },
  { skill: "mongodb-schema-design", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-schema-design", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/mongodb-schema-design/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/mongodb-schema-design/SKILL.md", shadowedPaths: [] },
  { skill: "mongodb-search-and-ai", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-search-and-ai", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/mongodb-search-and-ai/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/mongodb-search-and-ai/SKILL.md", shadowedPaths: [] },
  { skill: "obsidian-vault", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:obsidian-vault", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/obsidian-vault/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/obsidian-vault/SKILL.md", shadowedPaths: [] },
  { skill: "octocode", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:octocode", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/octocode/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/octocode/SKILL.md", shadowedPaths: [] },
  { skill: "octocode-brainstorming", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:octocode-brainstorming", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/octocode-brainstorming/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/octocode-brainstorming/SKILL.md", shadowedPaths: [] },
  { skill: "octocode-research", invocationSurfaces: ["workflow-phase-read"], productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches", physicalPaths: ["/Users/rom.iluz/.agents/skills/octocode-research/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/octocode-research/SKILL.md", shadowedPaths: [] },
  { skill: "octocode-rfc-generator", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:octocode-rfc-generator", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/octocode-rfc-generator/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/octocode-rfc-generator/SKILL.md", shadowedPaths: [] },
  { skill: "octocode-roast", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:octocode-roast", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/octocode-roast/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/octocode-roast/SKILL.md", shadowedPaths: [] },
  { skill: "pi-hermes-memory-cleanup", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:pi-hermes-memory-cleanup", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/pi-hermes-memory-cleanup/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/pi-hermes-memory-cleanup/SKILL.md", shadowedPaths: [] },
  { skill: "pi-update-cache-bypass", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:pi-update-cache-bypass", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/pi-update-cache-bypass/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/pi-update-cache-bypass/SKILL.md", shadowedPaths: [] },
  { skill: "planning-workflow", invocationSurfaces: ["workflow-prompt-pin"], productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator", physicalPaths: ["skills/planning-workflow/SKILL.md", "/Users/rom.iluz/.agents/skills/planning-workflow/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/planning-workflow/SKILL.md", shadowedPaths: ["skills/planning-workflow/SKILL.md"] },
  { skill: "port-api-blueprint-creation", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:port-api-blueprint-creation", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/port-api-blueprint-creation/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/port-api-blueprint-creation/SKILL.md", shadowedPaths: [] },
  { skill: "prototype", invocationSurfaces: ["workflow-phase-read"], productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches", physicalPaths: ["/Users/rom.iluz/.agents/skills/prototype/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/prototype/SKILL.md", shadowedPaths: [] },
  { skill: "qa", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:qa", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/qa/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/qa/SKILL.md", shadowedPaths: [] },
  { skill: "rag-pipeline", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:rag-pipeline", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/rag-pipeline/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/rag-pipeline/SKILL.md", shadowedPaths: [] },
  { skill: "receiving-code-review", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["skills/receiving-code-review/SKILL.md", "/Users/rom.iluz/.agents/skills/receiving-code-review/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/receiving-code-review/SKILL.md", shadowedPaths: ["skills/receiving-code-review/SKILL.md"] },
  { skill: "request-refactor-plan", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:request-refactor-plan", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/request-refactor-plan/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/request-refactor-plan/SKILL.md", shadowedPaths: [] },
  { skill: "research", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:research", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/research/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/research/SKILL.md", shadowedPaths: [] },
  { skill: "research-workflow", invocationSurfaces: ["workflow-prompt-pin"], productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator", physicalPaths: ["skills/research-workflow/SKILL.md", "/Users/rom.iluz/.agents/skills/research-workflow/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/research-workflow/SKILL.md", shadowedPaths: ["skills/research-workflow/SKILL.md"] },
  { skill: "resolving-merge-conflicts", invocationSurfaces: ["workflow-phase-read"], productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches", physicalPaths: ["/Users/rom.iluz/.agents/skills/resolving-merge-conflicts/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/resolving-merge-conflicts/SKILL.md", shadowedPaths: [] },
  { skill: "review-workflow", invocationSurfaces: ["workflow-prompt-pin"], productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator", physicalPaths: ["skills/review-workflow/SKILL.md", "/Users/rom.iluz/.agents/skills/review-workflow/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/review-workflow/SKILL.md", shadowedPaths: ["skills/review-workflow/SKILL.md"] },
  { skill: "sandbox-sdk", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:sandbox-sdk", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/sandbox-sdk/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/sandbox-sdk/SKILL.md", shadowedPaths: [] },
  { skill: "scaffold-exercises", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:scaffold-exercises", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/scaffold-exercises/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/scaffold-exercises/SKILL.md", shadowedPaths: [] },
  { skill: "scrape", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:scrape", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/scrape/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/scrape/SKILL.md", shadowedPaths: [] },
  { skill: "search", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:search", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.pi/agent/skills/search/SKILL.md"], selectedPath: "/Users/rom.iluz/.pi/agent/skills/search/SKILL.md", shadowedPaths: [] },
  { skill: "session-handoff", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:session-handoff", rationale: "community skill, available on-demand", physicalPaths: ["skills/session-handoff/SKILL.md", "/Users/rom.iluz/.agents/skills/session-handoff/SKILL.md"], selectedPath: "skills/session-handoff/SKILL.md", shadowedPaths: ["/Users/rom.iluz/.agents/skills/session-handoff/SKILL.md"] },
  { skill: "setup-maintenance", invocationSurfaces: ["workflow-prompt-pin"], productRole: "standalone-utility", discoveryRoute: "Coach menu + direct prompt pin", rationale: "direct-pinned self-contained state machine", physicalPaths: ["skills/setup-maintenance/SKILL.md", "/Users/rom.iluz/.agents/skills/setup-maintenance/SKILL.md"], selectedPath: "skills/setup-maintenance/SKILL.md", shadowedPaths: ["/Users/rom.iluz/.agents/skills/setup-maintenance/SKILL.md"] },
  { skill: "setup-matt-pocock-skills", invocationSurfaces: ["catalog-only"], productRole: "standalone-utility", discoveryRoute: "/palette + /skill:setup-matt-pocock-skills", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)", physicalPaths: ["skills/setup-matt-pocock-skills/SKILL.md", "/Users/rom.iluz/.agents/skills/setup-matt-pocock-skills/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/setup-matt-pocock-skills/SKILL.md", shadowedPaths: ["skills/setup-matt-pocock-skills/SKILL.md"] },
  { skill: "setup-pre-commit", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:setup-pre-commit", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/setup-pre-commit/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/setup-pre-commit/SKILL.md", shadowedPaths: [] },
  { skill: "setup-ts-deep-modules", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:setup-ts-deep-modules", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/setup-ts-deep-modules/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/setup-ts-deep-modules/SKILL.md", shadowedPaths: [] },
  { skill: "ship-workflow", invocationSurfaces: ["workflow-prompt-pin"], productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator", physicalPaths: ["skills/ship-workflow/SKILL.md", "/Users/rom.iluz/.agents/skills/ship-workflow/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/ship-workflow/SKILL.md", shadowedPaths: ["skills/ship-workflow/SKILL.md"] },
  { skill: "tdd", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["/Users/rom.iluz/.agents/skills/tdd/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/tdd/SKILL.md", shadowedPaths: [] },
  { skill: "teach", invocationSurfaces: ["catalog-only"], productRole: "standalone-utility", discoveryRoute: "/palette + /skill:teach", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)", physicalPaths: ["/Users/rom.iluz/.agents/skills/teach/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/teach/SKILL.md", shadowedPaths: [] },
  { skill: "to-questionnaire", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:to-questionnaire", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/to-questionnaire/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/to-questionnaire/SKILL.md", shadowedPaths: [] },
  { skill: "to-spec", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["/Users/rom.iluz/.agents/skills/to-spec/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/to-spec/SKILL.md", shadowedPaths: [] },
  { skill: "to-tickets", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["/Users/rom.iluz/.agents/skills/to-tickets/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/to-tickets/SKILL.md", shadowedPaths: [] },
  { skill: "triage", invocationSurfaces: ["workflow-prompt-pin"], productRole: "standalone-utility", discoveryRoute: "Coach menu + direct prompt pin", rationale: "direct-pinned self-contained state machine", physicalPaths: ["/Users/rom.iluz/.agents/skills/triage/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/triage/SKILL.md", shadowedPaths: [] },
  { skill: "turnstile-spin", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:turnstile-spin", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/turnstile-spin/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/turnstile-spin/SKILL.md", shadowedPaths: [] },
  { skill: "ubiquitous-language", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:ubiquitous-language", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/ubiquitous-language/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/ubiquitous-language/SKILL.md", shadowedPaths: [] },
  { skill: "upgrade-advisor", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:upgrade-advisor", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/upgrade-advisor/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/upgrade-advisor/SKILL.md", shadowedPaths: [] },
  { skill: "uv", invocationSurfaces: ["workflow-phase-read"], productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches", physicalPaths: ["/Users/rom.iluz/.agents/skills/uv/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/uv/SKILL.md", shadowedPaths: [] },
  { skill: "vercel-composition-patterns", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-composition-patterns", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/vercel-composition-patterns/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/vercel-composition-patterns/SKILL.md", shadowedPaths: [] },
  { skill: "vercel-optimize", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-optimize", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/vercel-optimize/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/vercel-optimize/SKILL.md", shadowedPaths: [] },
  { skill: "vercel-react-best-practices", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-react-best-practices", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/vercel-react-best-practices/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/vercel-react-best-practices/SKILL.md", shadowedPaths: [] },
  { skill: "verification-before-completion", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["skills/verification-before-completion/SKILL.md", "/Users/rom.iluz/.agents/skills/verification-before-completion/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/verification-before-completion/SKILL.md", shadowedPaths: ["skills/verification-before-completion/SKILL.md"] },
  { skill: "wayfinder", invocationSurfaces: ["workflow-phase-read"], productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary", physicalPaths: ["/Users/rom.iluz/.agents/skills/wayfinder/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/wayfinder/SKILL.md", shadowedPaths: [] },
  { skill: "web-design-guidelines", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:web-design-guidelines", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/web-design-guidelines/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/web-design-guidelines/SKILL.md", shadowedPaths: [] },
  { skill: "web-perf", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:web-perf", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/web-perf/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/web-perf/SKILL.md", shadowedPaths: [] },
  { skill: "wizard", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:wizard", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/wizard/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/wizard/SKILL.md", shadowedPaths: [] },
  { skill: "workers-best-practices", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:workers-best-practices", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/workers-best-practices/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/workers-best-practices/SKILL.md", shadowedPaths: [] },
  { skill: "wrangler", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:wrangler", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/wrangler/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/wrangler/SKILL.md", shadowedPaths: [] },
  { skill: "writing-awesome-readmes", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-awesome-readmes", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/writing-awesome-readmes/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/writing-awesome-readmes/SKILL.md", shadowedPaths: [] },
  { skill: "writing-beats", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-beats", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/writing-beats/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/writing-beats/SKILL.md", shadowedPaths: [] },
  { skill: "writing-fragments", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-fragments", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/writing-fragments/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/writing-fragments/SKILL.md", shadowedPaths: [] },
  { skill: "writing-great-skills", invocationSurfaces: ["catalog-only"], productRole: "standalone-utility", discoveryRoute: "/palette + /skill:writing-great-skills", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)", physicalPaths: ["/Users/rom.iluz/.agents/skills/writing-great-skills/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/writing-great-skills/SKILL.md", shadowedPaths: [] },
  { skill: "writing-shape", invocationSurfaces: ["catalog-only"], productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-shape", rationale: "community skill, available on-demand", physicalPaths: ["/Users/rom.iluz/.agents/skills/writing-shape/SKILL.md"], selectedPath: "/Users/rom.iluz/.agents/skills/writing-shape/SKILL.md", shadowedPaths: [] },
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
