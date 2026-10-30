// The Fizz script AST: one node per source line, each with its line number and original text.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** A decimal number with its source spelling, so floats print as written. */
export interface Num {
	value: number;
	text: string;
}

/** An inclusive integer range; a single number is `lo === hi`. */
export interface Range {
	lo: number;
	hi: number;
}

export type SectionName = 'terrain' | 'blocks' | 'treats' | 'enemies' | 'edits';

export type Body =
	| { type: 'blank' }
	| { type: 'comment' }
	| { type: 'error'; code: string }
	| { type: 'level'; name: string; w: number; h: number; ground: number; id: string }
	| { type: 'theme'; name: string }
	| { type: 'area'; name: string }
	| { type: 'start'; x: Num; y: Num }
	| { type: 'arena'; x: Range; floor: Num }
	| { type: 'walls' }
	| { type: 'section'; name: SectionName }
	| { type: 'segs'; segs: { seg: string; n: number }[] }
	| { type: 'liquid'; tile: string }
	| { type: 'tile'; tile: string; x: Range; y: Range }
	| { type: 'plat'; x: Range; y: number }
	| { type: 'hover'; from: [Num, Num]; to: [Num, Num]; speed: Num; size: [Num, Num] | null; dwell: Num | null }
	| { type: 'channel'; chs: number[]; on: boolean }
	| { type: 'crystal'; xs: Range[] }
	| { type: 'rect'; op: 'room' | 'secret-room' | 'wall-behind'; x: Range; y: Range }
	| { type: 'mural'; x: number; y: number }
	| { type: 'ladder'; x: number; y: Range }
	| { type: 'stairs'; side: 'right' | 'left'; x: number; y: number; count: number }
	| { type: 'vine-nook'; x: number; foot: number; shelf: number; dir: number; depth: number; h: number }
	| { type: 'item'; kind: string; xs: Range[]; y: number }
	| { type: 'row'; kind: string; x: Range; y: number; by: number }
	| { type: 'pogo-cache'; x: Range; rise: number }
	| { type: 'spawn'; kind: string; xs: Num[]; y: Num | null; dir: Num | null; ride: boolean }
	| { type: 'paint'; tile: string; xs: Range[]; ys: Range[] }
	| { type: 'clear'; xs: Range[]; ys: Range[] }
	| { type: 'place'; kind: string; xs: Range[]; ys: Range[] };

export type Node = Body & {
	/** 1-based line number in the source (for appended nodes, the line they print on). */
	line: number;
	/** The source text of the line, or null for a node built in memory. */
	raw: string | null;
	/** The trailing `// ...` comment, without the slashes, or null. */
	comment: string | null;
};

export interface Ast {
	nodes: Node[];
}

export type NodeOf<T extends Body['type']> = Extract<Node, { type: T }>;
