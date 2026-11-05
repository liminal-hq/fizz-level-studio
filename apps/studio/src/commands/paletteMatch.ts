// The command palette's matcher: fuzzy subsequence matching on a label, ranking and highlight ranges
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** A half-open run of label characters that matched the query: `label.slice(start, end)`. */
export interface Range {
	start: number;
	end: number;
}

export interface Match {
	score: number;
	ranges: Range[];
}

const MATCH = 10;
const RUN = 30;
const LABEL_START = 80;
const WORD_START = 50;
const GAP = 3;
const LEADING_GAP = 1;

const isWordChar = (char: string) => /[\p{L}\p{N}]/u.test(char);

/** True where a word begins: the label's start, after a separator, or a capital after a lower case. */
function startsWord(label: string, at: number): boolean {
	if (at === 0) return true;
	const before = label.charAt(at - 1);
	const here = label.charAt(at);
	if (!isWordChar(before)) return true;
	return before === before.toLowerCase() && here !== here.toLowerCase();
}

/**
 * Matches `query` as a subsequence of `label`, ignoring case and any spaces in the query, and
 * chooses the alignment that scores best: characters in a run, at the start of a word, and early
 * in the label score higher, and gaps cost a little. Returns null when the query is not a
 * subsequence. An empty query matches everything with a score of zero and no ranges.
 */
export function matchLabel(query: string, label: string): Match | null {
	const wanted = [...query.toLowerCase()].filter((char) => !/\s/u.test(char));
	if (wanted.length === 0) return { score: 0, ranges: [] };
	const text = label.toLowerCase();
	const n = label.length;
	const m = wanted.length;
	if (text.length !== n || m > n) return null;

	// best[i][j]: the best score with wanted[i] matched at label position j, or -Infinity.
	const best: number[][] = [];
	const from: number[][] = [];
	for (let i = 0; i < m; i++) {
		best.push(new Array<number>(n).fill(-Infinity));
		from.push(new Array<number>(n).fill(-1));
		for (let j = i; j < n; j++) {
			if (text.charAt(j) !== wanted[i]) continue;
			const bonus = j === 0 ? LABEL_START : startsWord(label, j) ? WORD_START : 0;
			const own = MATCH + bonus;
			if (i === 0) {
				best[i]![j] = own - LEADING_GAP * j;
				continue;
			}
			for (let k = i - 1; k < j; k++) {
				const prior = best[i - 1]![k]!;
				if (prior === -Infinity) continue;
				const score = prior + own + (k === j - 1 ? RUN : -GAP * (j - k - 1));
				if (score > best[i]![j]!) {
					best[i]![j] = score;
					from[i]![j] = k;
				}
			}
		}
	}

	let end = -1;
	let top = -Infinity;
	for (let j = 0; j < n; j++) {
		if (best[m - 1]![j]! > top) {
			top = best[m - 1]![j]!;
			end = j;
		}
	}
	if (end < 0) return null;

	const at: number[] = [];
	for (let i = m - 1, j = end; i >= 0; j = from[i]![j]!, i--) at.unshift(j);
	const ranges: Range[] = [];
	for (const position of at) {
		const last = ranges[ranges.length - 1];
		if (last && last.end === position) last.end = position + 1;
		else ranges.push({ start: position, end: position + 1 });
	}
	return { score: top, ranges };
}

export interface Rankable {
	id: string;
	label: string;
}

export interface Ranked<T extends Rankable> {
	item: T;
	ranges: Range[];
	/** True for an entry the empty query lists under Recent. */
	recent: boolean;
}

/**
 * The items that match `query`, best first; equal scores keep the order the items came in. With
 * no query every item is listed: the `recents` (most recent first) lead, then the rest as given.
 */
export function rankItems<T extends Rankable>(
	items: readonly T[],
	query: string,
	recents: readonly string[] = [],
): Ranked<T>[] {
	if (query.trim() === '') {
		const byId = new Map(items.map((item) => [item.id, item]));
		const led = recents.flatMap((id) => {
			const item = byId.get(id);
			return item ? [item] : [];
		});
		const ledIds = new Set(led.map((item) => item.id));
		return [
			...led.map((item) => ({ item, ranges: [], recent: true })),
			...items
				.filter((item) => !ledIds.has(item.id))
				.map((item) => ({ item, ranges: [], recent: false })),
		];
	}
	const scored: { ranked: Ranked<T>; score: number; order: number }[] = [];
	items.forEach((item, order) => {
		const match = matchLabel(query, item.label);
		if (match) {
			scored.push({
				ranked: { item, ranges: match.ranges, recent: false },
				score: match.score,
				order,
			});
		}
	});
	scored.sort((a, b) => b.score - a.score || a.order - b.order);
	return scored.map((entry) => entry.ranked);
}

/** Splits a label into runs, each flagged as matched or not, for drawing the highlights. */
export function segments(
	label: string,
	ranges: readonly Range[],
): { text: string; hit: boolean }[] {
	const out: { text: string; hit: boolean }[] = [];
	let cursor = 0;
	for (const range of ranges) {
		if (range.start > cursor) out.push({ text: label.slice(cursor, range.start), hit: false });
		out.push({ text: label.slice(range.start, range.end), hit: true });
		cursor = range.end;
	}
	if (cursor < label.length) out.push({ text: label.slice(cursor), hit: false });
	return out;
}
