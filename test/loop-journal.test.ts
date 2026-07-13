import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { Journal, type JournalEntry } from "../extensions/loop-journal.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loop-journal", () => {
	let tmpDir: string;

	after(() => {
		try {
			rmSync(tmpDir, { recursive: true });
		} catch {
			/* cleanup */
		}
	});

	function makeJournal(name = "test-wf"): Journal {
		tmpDir = mkdtempSync(join(tmpdir(), "auto-pi-journal-test-"));
		return new Journal(tmpDir, name);
	}

	it("writes and reads back journal entries", () => {
		const journal = makeJournal();
		const entry: JournalEntry = {
			hash: "abc123",
			phase: "plan",
			label: "plan-1",
			result: { planPath: ".loop-plan.md" } as Record<string, unknown>,
		};
		journal.append(entry);

		const read = journal.read();
		assert.equal(read.entries.length, 1);
		assert.equal(read.entries[0].hash, "abc123");
		assert.equal(read.entries[0].phase, "plan");
		assert.deepEqual(read.entries[0].result, { planPath: ".loop-plan.md" });
	});

	it("replays cached result for matching hash", () => {
		const journal = makeJournal();
		journal.append({
			hash: "hash1",
			phase: "build",
			label: "build-1",
			result: { status: "green", exitCode: 0 } as Record<string, unknown>,
		});

		const cached = journal.replay("hash1");
		assert.ok(cached, "should find cached entry");
		assert.equal(cached!.phase, "build");
		assert.deepEqual(cached!.result, { status: "green", exitCode: 0 });
	});

	it("returns null for non-matching hash on replay", () => {
		const journal = makeJournal();
		journal.append({
			hash: "hash1",
			phase: "build",
			label: "build-1",
			result: { status: "green" } as Record<string, unknown>,
		});

		const cached = journal.replay("nonexistent");
		assert.equal(cached, null);
	});

	it("handles multiple entries with same hash (multiset semantics)", () => {
		const journal = makeJournal();
		journal.append({
			hash: "shared",
			phase: "review",
			label: "review-1",
			result: { verdict: "approve" } as Record<string, unknown>,
		});
		journal.append({
			hash: "shared",
			phase: "review",
			label: "review-2",
			result: { verdict: "changes-requested" } as Record<string, unknown>,
		});

		// First replay pops first entry
		const first = journal.replay("shared");
		assert.ok(first);
		assert.equal(first!.result.verdict, "approve");

		// Second replay pops second entry
		const second = journal.replay("shared");
		assert.ok(second);
		assert.equal(second!.result.verdict, "changes-requested");

		// Third replay returns null (queue exhausted)
		const third = journal.replay("shared");
		assert.equal(third, null);
	});

	it("persists across journal instances (survives compaction/restart)", () => {
		const dir = mkdtempSync(join(tmpdir(), "auto-pi-journal-persist-"));
		try {
			const j1 = new Journal(dir, "persist-wf");
			j1.append({
				hash: "h1",
				phase: "ship",
				label: "ship-1",
				result: { commitHash: "abc123" } as Record<string, unknown>,
			});

			// Simulate restart — new Journal instance reading same dir
			const j2 = new Journal(dir, "persist-wf");
			const read = j2.read();
			assert.equal(read.entries.length, 1);
			assert.equal(read.entries[0].result.commitHash, "abc123");

			const cached = j2.replay("h1");
			assert.ok(cached);
			assert.equal(cached!.result.commitHash, "abc123");
		} finally {
			rmSync(dir, { recursive: true });
		}
	});

	it("computes hash from prompt + options for cache validity", () => {
		const journal = makeJournal();
		const hash1 = journal.computeHash("build the API", { model: "sonnet" });
		const hash2 = journal.computeHash("build the API", { model: "sonnet" });
		const hash3 = journal.computeHash("build the API", { model: "haiku" });

		assert.equal(hash1, hash2, "same prompt + options = same hash");
		assert.notEqual(hash1, hash3, "different options = different hash");
	});
});
