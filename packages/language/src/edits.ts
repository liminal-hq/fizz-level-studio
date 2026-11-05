// Appending studio edits to a script without touching any line already written.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Ast, Body, Node, Range } from './ast.ts';

export type Edit =
	| { op: 'paint'; tile: string; xs: Range[]; ys: Range[] }
	| { op: 'clear'; xs: Range[]; ys: Range[] }
	| { op: 'place'; kind: string; xs: Range[]; ys: Range[] }
	| { op: 'row'; kind: string; x: Range; y: number; by: number };

function toBody(e: Edit): Body {
	switch (e.op) {
		case 'paint':
			return { type: 'paint', tile: e.tile, xs: e.xs, ys: e.ys };
		case 'clear':
			return { type: 'clear', xs: e.xs, ys: e.ys };
		case 'place':
			return { type: 'place', kind: e.kind, xs: e.xs, ys: e.ys };
		case 'row':
			return { type: 'row', kind: e.kind, x: e.x, y: e.y, by: e.by };
	}
}

/**
 * Returns a new AST with `edits` added at the end of the edits block, creating the block (after one
 * blank line) when there is none. Existing nodes are shared, never copied or changed, so hand-written
 * lines print exactly as before. Trailing blank lines stay at the end of the file.
 */
export function appendEdits(ast: Ast, edits: Edit[]): Ast {
	if (edits.length === 0) return ast;
	let last = ast.nodes.length - 1;
	while (last >= 0 && ast.nodes[last].type === 'blank') last--;
	const at = last + 1;
	const hasBlock = ast.nodes.some((n) => n.type === 'section' && n.name === 'edits');
	const added: Body[] = [];
	if (!hasBlock) {
		added.push({ type: 'blank' }, { type: 'section', name: 'edits' });
	}
	added.push(...edits.map(toBody));
	const fresh: Node[] = added.map((b, i) => ({ ...b, line: at + i + 1, raw: null, comment: null }) as Node);
	const nodes = [...ast.nodes.slice(0, at), ...fresh];
	for (const n of ast.nodes.slice(at)) nodes.push({ ...n, line: nodes.length + 1 });
	return { nodes };
}
