// loop-journal.ts — State persistence axis.
//
// Per-run journaling for loop resume: every phase result is recorded to a
// JSONL file so a crash or compaction loses at most the final partial line.
// A later run replays cached results for matching calls and only re-dispatches
// sub-agents for new or changed phases.
//
// Cache semantics are a multiset (hash → queue of results in completion
// order), not a strict sequence — parallel reviews complete in nondeterministic
// order, so position-based matching would spuriously bust the cache.
//
// Inspired by pi-dynamic-workflow (milanglacier).

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export interface JournalEntry {
	hash: string;
	phase: string;
	label: string;
	result: Record<string, unknown>;
}

export interface RunJournal {
	runId: string;
	name: string;
	entries: JournalEntry[];
}

export class Journal {
	private readonly name: string;
	private readonly filePath: string;
	private cache: Map<string, JournalEntry[]> | null = null;

	constructor(dir: string, name: string) {
		this.name = name;
		this.filePath = path.join(dir, `${name}.jsonl`);
	}

	append(entry: JournalEntry): void {
		// Append-only write — crash-safe (at most last line is partial)
		const line = JSON.stringify(entry) + "\n";
		fs.appendFileSync(this.filePath, line, "utf-8");
		// Invalidate cache so next read/replay reloads
		this.cache = null;
	}

	read(): RunJournal {
		const entries: JournalEntry[] = [];
		if (fs.existsSync(this.filePath)) {
			const raw = fs.readFileSync(this.filePath, "utf-8");
			for (const line of raw.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				try {
					entries.push(JSON.parse(trimmed) as JournalEntry);
				} catch {
					// Skip partial/corrupt lines (crash mid-write)
				}
			}
		}
		return { runId: this.name, name: this.name, entries };
	}

	replay(hash: string): JournalEntry | null {
		if (this.cache === null) {
			const { entries } = this.read();
			const map = new Map<string, JournalEntry[]>();
			for (const entry of entries) {
				const queue = map.get(entry.hash) ?? [];
				queue.push(entry);
				map.set(entry.hash, queue);
			}
			this.cache = map;
		}

		const queue = this.cache.get(hash);
		if (!queue || queue.length === 0) return null;
		return queue.shift()!;
	}

	computeHash(prompt: string, options: Record<string, unknown>): string {
		const key = JSON.stringify({ prompt, options });
		return crypto
			.createHash("sha256")
			.update(key)
			.digest("hex")
			.substring(0, 16);
	}
}

// No-op Pi extension factory — this file is a library module imported by loop.ts,
// not a standalone extension. Pi requires a default export to load without error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (_pi: any) { /* library module — no hooks */ }
