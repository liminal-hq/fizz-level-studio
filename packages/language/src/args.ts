// Field reading for one statement line: positional words, `key=value` fields and bare flags.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fail } from './errors.ts';
import type { Num, Range } from './ast.ts';

const INT = /^-?\d+$/;
const NUM = /^-?\d+(?:\.\d+)?$/;

export function parseInt10(text: string, what: string): number {
	if (!INT.test(text)) {
		fail('E004', `${what} must be a whole number, found \`${text}\``, 'write digits only, such as 14 or -2');
	}
	return Number(text);
}

export function parseNum(text: string, what: string): Num {
	if (!NUM.test(text)) {
		fail('E004', `${what} must be a number, found \`${text}\``, 'write a decimal such as 7 or 88.5');
	}
	return { value: Number(text), text };
}

/** One list element: `a` or `a..b`, with whole numbers. */
export function parseRange(text: string, what: string): Range {
	const m = /^(-?\d+)(?:\.\.(-?\d+))?$/.exec(text);
	if (!m) {
		fail('E004', `${what} must be a whole number or a range such as 3..7, found \`${text}\``, 'write `a` or `a..b` with whole numbers');
	}
	const lo = Number(m[1]);
	const hi = m[2] === undefined ? lo : Number(m[2]);
	if (lo > hi) {
		fail('E005', `${what} range ${lo}..${hi} runs backwards`, `write it as ${hi}..${lo}`);
	}
	return { lo, hi };
}

export class Args {
	private readonly pos: string[];
	private readonly kv = new Map<string, string>();

	constructor(body: string) {
		this.pos = [];
		const tokens = body.replace(/\s*,\s*/g, ',').split(/\s+/).filter((t) => t !== '');
		for (const t of tokens) {
			const i = t.indexOf('=');
			if (i > 0) {
				const key = t.slice(0, i);
				if (this.kv.has(key)) {
					fail('E009', `field \`${key}=\` is given twice`, `keep one \`${key}=\``);
				}
				this.kv.set(key, t.slice(i + 1));
			} else {
				this.pos.push(t);
			}
		}
	}

	/** Takes the next positional word, or fails naming what was expected. */
	word(what: string, fix: string): string {
		const w = this.pos.shift();
		if (w === undefined) {
			fail('E003', `missing ${what}`, fix);
		}
		return w;
	}

	flag(name: string): boolean {
		const i = this.pos.indexOf(name);
		if (i < 0) return false;
		this.pos.splice(i, 1);
		return true;
	}

	has(key: string): boolean {
		return this.kv.has(key);
	}

	private take(key: string): string | null {
		const v = this.kv.get(key);
		if (v === undefined) return null;
		this.kv.delete(key);
		if (v === '') {
			fail('E003', `field \`${key}=\` has no value`, `write a value after \`${key}=\``);
		}
		return v;
	}

	private need(key: string, example: string): string {
		const v = this.take(key);
		if (v === null) {
			fail('E003', `missing field \`${key}=\``, `add \`${key}=${example}\``);
		}
		return v;
	}

	/** A plain word field such as `id=crater`. */
	text(key: string, example: string): string {
		return this.need(key, example);
	}

	int(key: string, example: string): number {
		return parseInt10(this.need(key, example), `\`${key}=\``);
	}

	optInt(key: string, fallback: number): number {
		const v = this.take(key);
		return v === null ? fallback : parseInt10(v, `\`${key}=\``);
	}

	num(key: string, example: string): Num {
		return parseNum(this.need(key, example), `\`${key}=\``);
	}

	optNum(key: string): Num | null {
		const v = this.take(key);
		return v === null ? null : parseNum(v, `\`${key}=\``);
	}

	/** A field that must be exactly one number or one range. */
	range(key: string, example: string): Range {
		const v = this.need(key, example);
		if (v.includes(',')) {
			fail('E004', `\`${key}=\` takes one value or one range here, found a list \`${v}\``, `write \`${key}=a..b\` or put the lines on separate statements`);
		}
		return parseRange(v, `\`${key}=\``);
	}

	/** A comma list of numbers and ranges. */
	ranges(key: string, example: string): Range[] {
		return this.need(key, example)
			.split(',')
			.map((p) => parseRange(p, `\`${key}=\``));
	}

	/** A comma list of plain decimals, no ranges. */
	nums(key: string, example: string): Num[] {
		return this.need(key, example)
			.split(',')
			.map((p) => parseNum(p, `\`${key}=\``));
	}

	/** Two decimals joined by a comma, such as `103,4.5`. */
	pair(key: string, example: string): [Num, Num] {
		const parts = this.need(key, example).split(',');
		if (parts.length !== 2) {
			fail('E004', `\`${key}=\` takes two numbers, found \`${parts.join(',')}\``, `write \`${key}=${example}\``);
		}
		return [parseNum(parts[0], `\`${key}=\``), parseNum(parts[1], `\`${key}=\``)];
	}

	/** Fails on anything the statement did not consume. */
	finish(allowed: string): void {
		const extra = this.pos[0];
		if (extra !== undefined) {
			fail('E009', `unexpected \`${extra}\``, `this statement takes: ${allowed}`);
		}
		const key = [...this.kv.keys()][0];
		if (key !== undefined) {
			fail('E009', `unknown field \`${key}=\``, `this statement takes: ${allowed}`);
		}
	}
}
