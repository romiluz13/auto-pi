// Compatibility and reachability catalog for auto-pi.
//
// Runtime lifecycle authority lives in config/workflow-machine.ts. This file
// keeps pinned ask-matt provenance, specialist provenance, and
// reachability metadata used by drift/catalog tests. It is not a second
// transition graph.
//
// Architecture: Coach entry → workflow machine/interpreter → ask-matt route →
// orchestration-layer procedure → specialist → evidence-backed transition.

export {
	allowedCapabilities,
	createWorkflowRun,
	effectiveAllowedEvents,
	PUBLIC_WORKFLOW_ENTRIES,
	transitionWorkflow,
	validateWorkflowMachine,
	WORKFLOW_MACHINE,
	WORKFLOW_PHASES,
} from "./workflow-machine.ts";

// ─── Phase definitions ─────────────────────────────────────────────────────

export interface ConditionalSpecialist {
	skill: string;
	predicate: string;
}

export interface StateConstraint {
	field: string;
	requiredOnEntry?: string[];
	requiredOnExit?: string[];
}

export interface PhaseDef {
	name: string;
	specialists: string[];
	conditionalSpecialists?: ConditionalSpecialist[];
	stateConstraints?: StateConstraint[];
	procedureScope?: string;
	evidenceFields?: string[];
}

// ─── Orchestration-layer phases (the unique auto-pi value) ──────────────────
//
// ask-matt's main flow is: grill → spec → tickets → implement(tdd+code-review) → commit
// auto-pi adds these phases that ask-matt does NOT have:
//   - ship (separate from implement's inline commit)
//   - review-disposition (4 dispositions, not just code-review)
//   - verification (evidence-block discipline)
//   - security (3rd review axis)
//   - diagnose (build-on-RED + debug, with Phase 5/6 handling)

export const ORCHESTRATION_LAYER_PHASES: PhaseDef[] = [
	{
		name: "ship",
		specialists: [
			"verification-before-completion",
			"diff-driven-docs",
			"commit",
		],
		conditionalSpecialists: [
			{
				skill: "github",
				predicate: "interpreter publication policy requests a branch push/PR",
			},
		],
	},
	{
		name: "review-disposition",
		specialists: ["receiving-code-review"],
		evidenceFields: ["finding", "disposition", "reason"],
	},
	{
		name: "verification",
		specialists: ["verification-before-completion"],
		evidenceFields: ["verification command", "exit code", "output excerpt"],
	},
	{
		name: "security",
		specialists: ["security-review"],
		evidenceFields: ["security findings", "severity per finding"],
	},
	{
		name: "diagnose",
		specialists: ["diagnosing-bugs"],
		procedureScope:
			"Phases 1-4 (skip Phase 5; execute Phase 6 after fix in tdd)",
		stateConstraints: [
			{ field: "diagnosis", requiredOnExit: ["root-cause identified"] },
		],
	},
];

// ask-matt's route graph is intentionally not copied here. The pinned source
// and SHA below are the authority; workflow workers read that source directly.

// ─── Reachability (two axes, non-overlapping) ───────────────────────────────

export interface ReachabilityEntry {
	skill: string;
	invocationSurfaces: string[];
	productRole:
		| "workflow-orchestrator"
		| "normal-path-specialist"
		| "conditional-specialist"
		| "direct-pinned"
		| "standalone-utility"
		| "catalog-only"
		| "superseded";
	discoveryRoute: string;
	rationale: string;
	sourcePaths: string[];
	runtimePhysicalPaths: string[];
	selectedRuntimePath: string;
	shadowedRuntimePaths: string[];
}

// ─── auto-pi repo skills (16 — the skills we own + maintain) ────────────────

const AUTO_PI_REPO_SKILLS: ReachabilityEntry[] = [
	{
		skill: "orchestration-layer",
		invocationSurfaces: ["prompt-pin"],
		productRole: "workflow-orchestrator",
		discoveryRoute: "Every Coach entry prompt pins orchestration-layer",
		rationale:
			"The procedure layer around ask-matt; deterministic state, evidence, persistence, and continuation are owned by workflow-machine + workflow-interpreter",
		sourcePaths: ["skills/orchestration-layer/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/orchestration-layer/SKILL.md"),
		],
		selectedRuntimePath: joinHome(
			".agents/skills/orchestration-layer/SKILL.md",
		),
		shadowedRuntimePaths: [],
	},
	{
		skill: "security-review",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "orchestration-layer SECURITY phase reads security-review",
		rationale:
			"The 3rd review axis (injection, auth, secrets, etc.) — auto-pi original",
		sourcePaths: ["skills/security-review/SKILL.md"],
		runtimePhysicalPaths: [joinHome(".agents/skills/security-review/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/security-review/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "code-review",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "orchestration-layer review phase reads code-review",
		rationale:
			"Two-axis review (Standards + Spec) — local fork with AI-agent guards",
		sourcePaths: ["skills/code-review/SKILL.md"],
		runtimePhysicalPaths: [joinHome(".agents/skills/code-review/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/code-review/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "diagnosing-bugs",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "orchestration-layer diagnose phase reads diagnosing-bugs",
		rationale: "6-phase bug diagnosis — local fork with AI-agent guards",
		sourcePaths: ["skills/diagnosing-bugs/SKILL.md"],
		runtimePhysicalPaths: [joinHome(".agents/skills/diagnosing-bugs/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/diagnosing-bugs/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "brainstorming",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute:
			"ask-matt routes to brainstorming (grill-with-docs primitive)",
		rationale: "Collaborative design interview — auto-pi original",
		sourcePaths: ["skills/brainstorming/SKILL.md"],
		runtimePhysicalPaths: [joinHome(".agents/skills/brainstorming/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/brainstorming/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "grilling",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "ask-matt routes to grilling (grill-with-docs primitive)",
		rationale: "Relentless interview primitive — matches Matt Pocock upstream",
		sourcePaths: ["skills/grilling/SKILL.md"],
		runtimePhysicalPaths: [joinHome(".agents/skills/grilling/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/grilling/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "receiving-code-review",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute:
			"orchestration-layer review-disposition phase reads receiving-code-review",
		rationale:
			"Disposition flow (verified-fix, verified-defer, rejected, needs-user-decision)",
		sourcePaths: ["skills/receiving-code-review/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/receiving-code-review/SKILL.md"),
		],
		selectedRuntimePath: joinHome(
			".agents/skills/receiving-code-review/SKILL.md",
		),
		shadowedRuntimePaths: [],
	},
	{
		skill: "verification-before-completion",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "orchestration-layer verification + ship phases read it",
		rationale:
			"Evidence-block discipline — no completion claims without fresh verification",
		sourcePaths: ["skills/verification-before-completion/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/verification-before-completion/SKILL.md"),
		],
		selectedRuntimePath: joinHome(
			".agents/skills/verification-before-completion/SKILL.md",
		),
		shadowedRuntimePaths: [],
	},
	{
		skill: "diff-driven-docs",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "orchestration-layer ship phase reads diff-driven-docs",
		rationale: "3-layer impact classifier (business/technical/audit)",
		sourcePaths: ["skills/diff-driven-docs/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/diff-driven-docs/SKILL.md"),
		],
		selectedRuntimePath: joinHome(".agents/skills/diff-driven-docs/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "decision-hold-lifecycle",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "orchestration-layer planning + review phases reference it",
		rationale: "Persist unresolved decisions to ~/.pi/agent/decisions.json",
		sourcePaths: ["skills/decision-hold-lifecycle/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/decision-hold-lifecycle/SKILL.md"),
		],
		selectedRuntimePath: joinHome(
			".agents/skills/decision-hold-lifecycle/SKILL.md",
		),
		shadowedRuntimePaths: [],
	},
	{
		skill: "memory-compounding",
		invocationSurfaces: ["layer-phase-read"],
		productRole: "normal-path-specialist",
		discoveryRoute: "orchestration-layer ship-complete phase references it",
		rationale: "Post-work memory hygiene (review + sharpen persistent memory)",
		sourcePaths: ["skills/memory-compounding/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/memory-compounding/SKILL.md"),
		],
		selectedRuntimePath: joinHome(".agents/skills/memory-compounding/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "session-handoff",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:session-handoff + /handoff ext cmd",
		rationale:
			"Standalone utility — the /handoff ext cmd is the real implementation; mentioned in compaction recovery",
		sourcePaths: ["skills/session-handoff/SKILL.md"],
		runtimePhysicalPaths: [joinHome(".agents/skills/session-handoff/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/session-handoff/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "bearings",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /bearings ext cmd",
		rationale:
			"Standalone utility — the /bearings ext cmd reads STATUS_FILE directly",
		sourcePaths: ["skills/bearings/SKILL.md"],
		runtimePhysicalPaths: [joinHome(".agents/skills/bearings/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/bearings/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "setup-maintenance",
		invocationSurfaces: ["prompt-pin"],
		productRole: "direct-pinned",
		discoveryRoute: "/setup-audit direct prompt pin (not in Coach menu)",
		rationale: "Maintain + improve a Pi coding agent setup",
		sourcePaths: ["skills/setup-maintenance/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/setup-maintenance/SKILL.md"),
		],
		selectedRuntimePath: joinHome(".agents/skills/setup-maintenance/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "setup-matt-pocock-skills",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:setup-matt-pocock-skills",
		rationale:
			"One-time repo config for issue tracker + triage labels + doc layout",
		sourcePaths: ["skills/setup-matt-pocock-skills/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/setup-matt-pocock-skills/SKILL.md"),
		],
		selectedRuntimePath: joinHome(
			".agents/skills/setup-matt-pocock-skills/SKILL.md",
		),
		shadowedRuntimePaths: [],
	},
	{
		skill: "codebase-hygiene",
		invocationSurfaces: ["catalog-only"],
		productRole: "standalone-utility",
		discoveryRoute: "/palette + /skill:codebase-hygiene",
		rationale:
			"Find semantic duplicates + shallow modules (advisory, routes to /build)",
		sourcePaths: ["skills/codebase-hygiene/SKILL.md"],
		runtimePhysicalPaths: [
			joinHome(".agents/skills/codebase-hygiene/SKILL.md"),
		],
		selectedRuntimePath: joinHome(".agents/skills/codebase-hygiene/SKILL.md"),
		shadowedRuntimePaths: [],
	},
];

// ─── ask-matt (pinned external dependency — the routing brain) ──────────────

const ASK_MATT_ENTRY: ReachabilityEntry = {
	skill: "ask-matt",
	invocationSurfaces: ["layer-read-on-entry"],
	productRole: "superseded",
	discoveryRoute:
		"orchestration-layer reads ask-matt on entry (read-on-entry fallback)",
	rationale:
		"The routing brain — pinned with provenance, not a repo skill. Superseded as a standalone router (the layer wraps it).",
	sourcePaths: [],
	runtimePhysicalPaths: [joinHome(".agents/skills/ask-matt/SKILL.md")],
	selectedRuntimePath: joinHome(".agents/skills/ask-matt/SKILL.md"),
	shadowedRuntimePaths: [],
};

// ─── Community specialists (ask-matt routes to these) ───────────────────────

const COMMUNITY_SPECIALISTS: ReachabilityEntry[] = [
	"tdd",
	"to-spec",
	"to-tickets",
	"wayfinder",
	"prototype",
	"domain-modeling",
	"codebase-design",
	"improve-codebase-architecture",
	"commit",
	"github",
	"research",
	"resolving-merge-conflicts",
	"grill-me",
	"triage",
].map((name) => ({
	skill: name,
	invocationSurfaces: ["layer-phase-read"],
	productRole: "normal-path-specialist" as const,
	discoveryRoute: `ask-matt routes to ${name}`,
	rationale:
		"Community specialist (Matt Pocock upstream) — ask-matt routes to it",
	sourcePaths: [] as string[],
	runtimePhysicalPaths: [joinHome(`.agents/skills/${name}/SKILL.md`)],
	selectedRuntimePath: joinHome(`.agents/skills/${name}/SKILL.md`),
	shadowedRuntimePaths: [],
}));

// ─── Superseded skills (replaced by auto-pi architecture) ───────────────────

const SUPERSEDED_SKILLS: ReachabilityEntry[] = [
	{
		skill: "implement",
		invocationSurfaces: ["catalog-only"],
		productRole: "superseded",
		discoveryRoute: "/palette + /skill:implement",
		rationale:
			"Superseded by ask-matt's implement route + orchestration-layer's build/ship phases",
		sourcePaths: [],
		runtimePhysicalPaths: [joinHome(".agents/skills/implement/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/implement/SKILL.md"),
		shadowedRuntimePaths: [],
	},
	{
		skill: "grill-with-docs",
		invocationSurfaces: ["catalog-only"],
		productRole: "superseded",
		discoveryRoute: "/palette + /skill:grill-with-docs",
		rationale:
			"Superseded — decomposed into grilling + domain-modeling (auto-pi uses them independently)",
		sourcePaths: [],
		runtimePhysicalPaths: [joinHome(".agents/skills/grill-with-docs/SKILL.md")],
		selectedRuntimePath: joinHome(".agents/skills/grill-with-docs/SKILL.md"),
		shadowedRuntimePaths: [],
	},
];

// ─── Full reachability catalog ──────────────────────────────────────────────

export const REACHABILITY_ENTRIES: ReachabilityEntry[] = [
	...AUTO_PI_REPO_SKILLS,
	ASK_MATT_ENTRY,
	...COMMUNITY_SPECIALISTS,
	...SUPERSEDED_SKILLS,
];

// ─── ask-matt source metadata (provenance + integrity) ──────────────────────

export const ASK_MATT_SOURCE = {
	repoHeadChecked: "84fdeff",
	skillBaseCommit: "84fdeff",
	sha256: "3d38910535f5f01e15bc5fd7f6ca8880d628cd248741f08e6780dd7c1828e832",
	repo: "https://github.com/mattpocock/skills.git",
	path: "skills/engineering/ask-matt/SKILL.md",
};

// ─── Helper (path resolution) ───────────────────────────────────────────────

function joinHome(relativePath: string): string {
	const home = process.env.HOME || process.cwd();
	return `${home}/${relativePath}`;
}
