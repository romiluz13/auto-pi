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
			"workflow", "mode", "phase", "design", "style", "domain capture",
			"domain artifacts", "prototype", "prototype question",
			"prototype conclusion", "unresolved design uncertainty",
			"spec", "tickets", "frontier",
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
					{ field: "style", requiredOnExit: ["brainstorming", "grilling", "grill-me", "not-applicable"] },
					{ field: "domain capture", requiredOnExit: ["off", "on", "not-applicable"] },
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
				stateConstraints: [
					{ field: "design", requiredOnExit: ["approved"] },
				],
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
			"workflow", "phase", "verification", "doc disposition",
			"commit hash", "pr url", "ci",
		],
		phases: [
			{
				name: "verify",
				specialists: ["verification-before-completion"],
				next: ["docs"],
				stateConstraints: [
					{ field: "verification", requiredOnExit: ["<command + exit code + output>"] },
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
	{ outcome: "ready-for-agent", handoff: { command: "build", argPlaceholder: "<issue ref>" }, terminal: true },
	{ outcome: "needs-info", terminal: true },
	{ outcome: "ready-for-human", terminal: true },
	{ outcome: "wontfix", terminal: true },
	{ outcome: "needs-triage", terminal: false },
	{ outcome: "list-query", terminal: true },
];

// ─── Reachability (two axes, non-overlapping) ───────────────────────────────

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

// The entries are in the second part of this file (after the ask-matt dispositions).
export const REACHABILITY_ENTRIES: ReachabilityEntry[] = [
  { skill: "planning-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "build-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "review-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "ship-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "research-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "debug-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "setup-maintenance", invocationSurface: "workflow-prompt-pin", productRole: "standalone-utility", discoveryRoute: "Coach menu + direct prompt pin", rationale: "direct-pinned self-contained state machine" },
  { skill: "triage", invocationSurface: "workflow-prompt-pin", productRole: "standalone-utility", discoveryRoute: "Coach menu + direct prompt pin", rationale: "direct-pinned self-contained state machine" },
  { skill: "brainstorming", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "grilling", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "to-spec", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "to-tickets", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "wayfinder", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "tdd", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "diagnosing-bugs", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "code-review", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "receiving-code-review", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "verification-before-completion", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "diff-driven-docs", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "commit", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "github", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "uv", invocationSurface: "workflow-phase-read", productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches" },
  { skill: "prototype", invocationSurface: "workflow-phase-read", productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches" },
  { skill: "domain-modeling", invocationSurface: "workflow-phase-read", productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches" },
  { skill: "grill-me", invocationSurface: "workflow-phase-read", productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches" },
  { skill: "octocode-research", invocationSurface: "workflow-phase-read", productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches" },
  { skill: "live-research", invocationSurface: "workflow-phase-read", productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches" },
  { skill: "resolving-merge-conflicts", invocationSurface: "workflow-phase-read", productRole: "conditional-specialist", discoveryRoute: "workflow phase read (conditional)", rationale: "conditional specialist — read only when predicate matches" },
  { skill: "handoff", invocationSurface: "extension-command", productRole: "standalone-utility", discoveryRoute: "/handoff extension command", rationale: "extension-backed cross-session transfer" },
  { skill: "grill-with-docs", invocationSurface: "catalog-only", productRole: "superseded", discoveryRoute: "/palette only (expert/manual use)", rationale: "superseded by grilling + domain-modeling decomposition" },
  { skill: "improve-codebase-architecture", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:improve-codebase-architecture", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "codebase-design", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:codebase-design", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "teach", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:teach", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "writing-great-skills", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:writing-great-skills", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "setup-matt-pocock-skills", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:setup-matt-pocock-skills", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "agent-browser", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:agent-browser", rationale: "community skill, available on-demand" },
  { skill: "agents-sdk", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:agents-sdk", rationale: "community skill, available on-demand" },
  { skill: "ask-matt", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:ask-matt", rationale: "community skill, available on-demand" },
  { skill: "batch-grill-me", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:batch-grill-me", rationale: "community skill, available on-demand" },
  { skill: "bearings", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:bearings", rationale: "community skill, available on-demand" },
  { skill: "claude-handoff", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:claude-handoff", rationale: "community skill, available on-demand" },
  { skill: "cloudflare", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare", rationale: "community skill, available on-demand" },
  { skill: "cloudflare-email-service", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-email-service", rationale: "community skill, available on-demand" },
  { skill: "cloudflare-one", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-one", rationale: "community skill, available on-demand" },
  { skill: "cloudflare-one-migrations", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-one-migrations", rationale: "community skill, available on-demand" },
  { skill: "codebase-hygiene", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:codebase-hygiene", rationale: "community skill, available on-demand" },
  { skill: "decision-hold-lifecycle", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:decision-hold-lifecycle", rationale: "community skill, available on-demand" },
  { skill: "deploy-to-vercel", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:deploy-to-vercel", rationale: "community skill, available on-demand" },
  { skill: "design-an-interface", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:design-an-interface", rationale: "community skill, available on-demand" },
  { skill: "design-heuristic-evaluation", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:design-heuristic-evaluation", rationale: "community skill, available on-demand" },
  { skill: "durable-objects", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:durable-objects", rationale: "community skill, available on-demand" },
  { skill: "edit-article", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:edit-article", rationale: "community skill, available on-demand" },
  { skill: "find-skills", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:find-skills", rationale: "community skill, available on-demand" },
  { skill: "frontend-design", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:frontend-design", rationale: "community skill, available on-demand" },
  { skill: "git-guardrails-claude-code", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:git-guardrails-claude-code", rationale: "community skill, available on-demand" },
  { skill: "herdr", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:herdr", rationale: "community skill, available on-demand" },
  { skill: "hyperadar-stack-gotchas", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:hyperadar-stack-gotchas", rationale: "community skill, available on-demand" },
  { skill: "implement", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:implement", rationale: "community skill, available on-demand" },
  { skill: "live-heuristic-evaluation", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:live-heuristic-evaluation", rationale: "community skill, available on-demand" },
  { skill: "loop-me", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:loop-me", rationale: "community skill, available on-demand" },
  { skill: "memory-compounding", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:memory-compounding", rationale: "community skill, available on-demand" },
  { skill: "migrate-to-shoehorn", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:migrate-to-shoehorn", rationale: "community skill, available on-demand" },
  { skill: "mongodb-atlas-stream-processing", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-atlas-stream-processing", rationale: "community skill, available on-demand" },
  { skill: "mongodb-connection", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-connection", rationale: "community skill, available on-demand" },
  { skill: "mongodb-mcp-setup", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-mcp-setup", rationale: "community skill, available on-demand" },
  { skill: "mongodb-natural-language-querying", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-natural-language-querying", rationale: "community skill, available on-demand" },
  { skill: "mongodb-query-optimizer", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-query-optimizer", rationale: "community skill, available on-demand" },
  { skill: "mongodb-schema-design", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-schema-design", rationale: "community skill, available on-demand" },
  { skill: "mongodb-search-and-ai", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-search-and-ai", rationale: "community skill, available on-demand" },
  { skill: "obsidian-vault", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:obsidian-vault", rationale: "community skill, available on-demand" },
  { skill: "pi-hermes-memory-cleanup", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:pi-hermes-memory-cleanup", rationale: "community skill, available on-demand" },
  { skill: "pi-update-cache-bypass", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:pi-update-cache-bypass", rationale: "community skill, available on-demand" },
  { skill: "port-api-blueprint-creation", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:port-api-blueprint-creation", rationale: "community skill, available on-demand" },
  { skill: "qa", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:qa", rationale: "community skill, available on-demand" },
  { skill: "request-refactor-plan", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:request-refactor-plan", rationale: "community skill, available on-demand" },
  { skill: "research", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:research", rationale: "community skill, available on-demand" },
  { skill: "sandbox-sdk", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:sandbox-sdk", rationale: "community skill, available on-demand" },
  { skill: "scaffold-exercises", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:scaffold-exercises", rationale: "community skill, available on-demand" },
  { skill: "session-handoff", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:session-handoff", rationale: "community skill, available on-demand" },
  { skill: "setup-pre-commit", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:setup-pre-commit", rationale: "community skill, available on-demand" },
  { skill: "setup-ts-deep-modules", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:setup-ts-deep-modules", rationale: "community skill, available on-demand" },
  { skill: "to-questionnaire", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:to-questionnaire", rationale: "community skill, available on-demand" },
  { skill: "turnstile-spin", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:turnstile-spin", rationale: "community skill, available on-demand" },
  { skill: "ubiquitous-language", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:ubiquitous-language", rationale: "community skill, available on-demand" },
  { skill: "vercel-composition-patterns", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-composition-patterns", rationale: "community skill, available on-demand" },
  { skill: "vercel-optimize", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-optimize", rationale: "community skill, available on-demand" },
  { skill: "vercel-react-best-practices", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-react-best-practices", rationale: "community skill, available on-demand" },
  { skill: "web-design-guidelines", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:web-design-guidelines", rationale: "community skill, available on-demand" },
  { skill: "web-perf", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:web-perf", rationale: "community skill, available on-demand" },
  { skill: "wizard", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:wizard", rationale: "community skill, available on-demand" },
  { skill: "workers-best-practices", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:workers-best-practices", rationale: "community skill, available on-demand" },
  { skill: "wrangler", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:wrangler", rationale: "community skill, available on-demand" },
  { skill: "writing-awesome-readmes", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-awesome-readmes", rationale: "community skill, available on-demand" },
  { skill: "writing-beats", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-beats", rationale: "community skill, available on-demand" },
  { skill: "writing-fragments", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-fragments", rationale: "community skill, available on-demand" },
  { skill: "writing-shape", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-shape", rationale: "community skill, available on-demand" },
];

// ─── Ask-matt dispositions (structured harmony evidence) ───────────────────

export interface AskMattDisposition {
	askMattRoute: string;
	disposition: "equivalent" | "deliberate-substitution" | "intentional-standalone" | "intentional-unsupported";
	trigger: string;
	invariants: string;
	artifacts: string;
	exit: string;
	autoPiRoute: string;
	rationale: string;
}

export const ASK_MATT_DISPOSITIONS: AskMattDisposition[] = [
	{ askMattRoute: "grill-with-docs", disposition: "deliberate-substitution", trigger: "bounded work needing durable domain record", invariants: "collaborative approval + durable domain capture", artifacts: "approved design + CONTEXT.md/ADR", exit: "spec phase", autoPiRoute: "planning-workflow setup + brainstorm (grilling + domain-modeling)", rationale: "Decomposed — loading grill-with-docs would re-couple the dimensions we separated." },
	{ askMattRoute: "prototype", disposition: "equivalent", trigger: "design question needs runnable answer", invariants: "throwaway, one command, no persistence", artifacts: "answer captured", exit: "resume design phase", autoPiRoute: "planning-workflow prototype interrupt", rationale: "Workflow-owned, consented interrupt." },
	{ askMattRoute: "to-spec", disposition: "equivalent", trigger: "bounded, design approved", invariants: "seam confirmation", artifacts: "spec reference", exit: "tickets phase", autoPiRoute: "planning-workflow spec phase", rationale: "Direct equivalent." },
	{ askMattRoute: "to-tickets", disposition: "equivalent", trigger: "spec published", invariants: "ticket-breakdown approval", artifacts: "ticket refs + frontier", exit: "complete → /build", autoPiRoute: "planning-workflow tickets phase", rationale: "Direct equivalent." },
	{ askMattRoute: "implement", disposition: "deliberate-substitution", trigger: "a ticket", invariants: "tdd red-green, fresh context per ticket, review before commit", artifacts: "verification evidence, commit hash", exit: "review → ship", autoPiRoute: "build-workflow + review-workflow + ship-workflow", rationale: "Decomposed for independent observability. Invariants preserved." },
	{ askMattRoute: "tdd", disposition: "equivalent", trigger: "a slice", invariants: "red-green one slice at a time", artifacts: "passing test", exit: "diagnose or complete", autoPiRoute: "build-workflow tdd phase", rationale: "Direct equivalent." },
	{ askMattRoute: "code-review", disposition: "equivalent", trigger: "uncommitted diff", invariants: "standards + spec (+ security)", artifacts: "findings with file:line", exit: "disposition or complete", autoPiRoute: "review-workflow review phase", rationale: "Direct equivalent + Security axis." },
	{ askMattRoute: "triage", disposition: "equivalent", trigger: "incoming raw issues/PRs", invariants: "triage roles, not to-tickets output", artifacts: "agent-ready briefs", exit: "/build when ready-for-agent", autoPiRoute: "/triage prompt (direct pin) + 8th Coach option", rationale: "Direct equivalent." },
	{ askMattRoute: "diagnosing-bugs", disposition: "deliberate-substitution", trigger: "bug", invariants: "feedback loop, root cause (Phases 1-4 only)", artifacts: "root cause diagnosis", exit: "/build (fix with TDD)", autoPiRoute: "debug-workflow (diagnose) + build-workflow (fix)", rationale: "Split — diagnosis only, fix in /build via TDD." },
	{ askMattRoute: "wayfinder", disposition: "equivalent", trigger: "foggy", invariants: "decisions, not deliverables", artifacts: "map reference + outcome", exit: "resume or route", autoPiRoute: "planning-workflow wayfind phase", rationale: "Direct equivalent." },
	{ askMattRoute: "improve-codebase-architecture", disposition: "intentional-standalone", trigger: "spare moment for codebase health", invariants: "surfaces deepening opportunities", artifacts: "ideas", exit: "/plan", autoPiRoute: "/palette + AGENTS.md", rationale: "Upkeep, not feature work." },
	{ askMattRoute: "domain-modeling", disposition: "equivalent", trigger: "domain terms/ADRs need capture", invariants: "glossary when resolved, ADR when hard-to-reverse", artifacts: "CONTEXT.md/ADR", exit: "resume planning", autoPiRoute: "planning-workflow domain-modeling underlay", rationale: "Trigger-based underlay." },
	{ askMattRoute: "codebase-design", disposition: "intentional-standalone", trigger: "module shape design", invariants: "deep-module vocabulary", artifacts: "design", exit: "—", autoPiRoute: "/palette + AGENTS.md", rationale: "Vocabulary, on-demand." },
	{ askMattRoute: "handoff", disposition: "equivalent", trigger: "session full / branch off", invariants: "preserve context", artifacts: "HANDOFF.md", exit: "fresh session", autoPiRoute: "handoff.ts extension", rationale: "Direct equivalent." },
	{ askMattRoute: "compact", disposition: "equivalent", trigger: "intentional break between phases", invariants: "stay in same conversation", artifacts: "summarized context", exit: "continue", autoPiRoute: "Pi built-in /compact", rationale: "Direct equivalent (built-in)." },
	{ askMattRoute: "grill-me", disposition: "equivalent", trigger: "no codebase + grilling requested", invariants: "stateless, saves nothing locally", artifacts: "sharpened plan", exit: "resume planning", autoPiRoute: "planning-workflow no-codebase grilling branch", rationale: "Direct equivalent (no-codebase branch)." },
	{ askMattRoute: "research", disposition: "equivalent", trigger: "need cited findings from primary sources", invariants: "high-trust primary sources", artifacts: "cited markdown file", exit: "/plan or /build", autoPiRoute: "research-workflow", rationale: "Direct equivalent." },
	{ askMattRoute: "teach", disposition: "intentional-standalone", trigger: "learn a concept", invariants: "multi-session workspace", artifacts: "learned concept", exit: "—", autoPiRoute: "/palette", rationale: "Learning tool, not SDLC." },
	{ askMattRoute: "writing-great-skills", disposition: "intentional-standalone", trigger: "write/edit skills", invariants: "skill vocabulary", artifacts: "skill file", exit: "—", autoPiRoute: "/palette", rationale: "Reference, not SDLC." },
	{ askMattRoute: "setup-matt-pocock-skills", disposition: "intentional-standalone", trigger: "first engineering flow", invariants: "configure issue tracker", artifacts: "tracker config", exit: "—", autoPiRoute: "/palette", rationale: "One-time setup." },
];

