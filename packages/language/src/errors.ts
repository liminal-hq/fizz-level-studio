// Parse errors for Fizz scripts: a code, a line number, a message and a suggested fix.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export interface FizzError {
	line: number;
	code: string;
	message: string;
	fix: string;
}

/** Thrown inside the parser to abandon one line; the parser records it and moves on. */
export class LineError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly fix: string,
	) {
		super(message);
	}
}

export function fail(code: string, message: string, fix: string): never {
	throw new LineError(code, message, fix);
}

/** Thrown by `parseOrThrow` and `toRust` when a script has errors. */
export class FizzErrors extends Error {
	constructor(public readonly errors: FizzError[]) {
		super(errors.map(formatError).join('\n'));
	}
}

export function formatError(e: FizzError): string {
	return `line ${e.line}: ${e.code} ${e.message} (fix: ${e.fix})`;
}

function distance(a: string, b: string): number {
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let prev = row[0];
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const cur = row[j];
			row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = cur;
		}
	}
	return row[b.length];
}

/** The closest candidate within two edits, for "did you mean" fixes. */
export function closest(word: string, candidates: string[]): string | null {
	let best: string | null = null;
	let bestD = 3;
	for (const c of candidates) {
		const d = distance(word, c);
		if (d < bestD) {
			best = c;
			bestD = d;
		}
	}
	return best;
}

/** A fix sentence for an unknown name: a close match when there is one, else the full list. */
export function suggest(word: string, candidates: string[]): string {
	const c = closest(word, candidates);
	return c ? `did you mean \`${c}\`?` : `use one of: ${candidates.join(', ')}`;
}
