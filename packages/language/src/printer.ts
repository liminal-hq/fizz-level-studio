// Printer for Fizz scripts: parsed lines print as written; nodes built in memory print canonically.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Ast, Node, Range } from './ast.ts';

export function rangeText(r: Range): string {
	return r.lo === r.hi ? String(r.lo) : `${r.lo}..${r.hi}`;
}

export function rangesText(rs: Range[]): string {
	return rs.map(rangeText).join(',');
}

/** The canonical text of a node, for nodes that have no original line. */
export function formatNode(n: Node): string {
	const tail = n.comment ? `  // ${n.comment}` : '';
	const ind = '  ';
	switch (n.type) {
		case 'blank':
			return '';
		case 'comment':
			return `// ${n.comment ?? ''}`.trimEnd();
		case 'error':
			return n.raw ?? '';
		case 'level':
			return `level "${n.name}" ${n.w}x${n.h} ground=${n.ground} id=${n.id}${tail}`;
		case 'theme':
		case 'area':
			return `${n.type} ${n.name}${tail}`;
		case 'start':
			return `start ${n.x.text},${n.y.text}${tail}`;
		case 'arena':
			return `arena x=${rangeText(n.x)} floor=${n.floor.text}${tail}`;
		case 'walls':
			return `walls${tail}`;
		case 'section':
			return `${n.name}${tail}`;
		case 'segs':
			return `${ind}${n.segs.map((s) => `${s.seg} ${s.n}`).join(', ')}${tail}`;
		case 'liquid':
			return `${ind}liquid ${n.tile}${tail}`;
		case 'tile':
			return `${ind}${n.tile} x=${rangeText(n.x)} y=${rangeText(n.y)}${tail}`;
		case 'plat':
			return `${ind}plat x=${rangeText(n.x)} y=${n.y}${tail}`;
		case 'hover':
			return `${ind}hover from=${n.from[0].text},${n.from[1].text} to=${n.to[0].text},${n.to[1].text} speed=${n.speed.text}${n.size ? ` size=${n.size[0].text}x${n.size[1].text}` : ''}${n.dwell ? ` dwell=${n.dwell.text}` : ''}${tail}`;
		case 'channel':
			return `${ind}channel ${n.chs.join(',')} ${n.on ? 'on' : 'off'}${tail}`;
		case 'crystal':
			return `${ind}crystal x=${rangesText(n.xs)}${tail}`;
		case 'rect':
			return `${ind}${n.op} x=${rangeText(n.x)} y=${rangeText(n.y)}${tail}`;
		case 'mural':
			return `${ind}mural x=${n.x} y=${n.y}${tail}`;
		case 'ladder':
			return `${ind}ladder x=${n.x} y=${rangeText(n.y)}${tail}`;
		case 'stairs':
			return `${ind}stairs-${n.side} x=${n.x} y=${n.y} count=${n.count}${tail}`;
		case 'vine-nook':
			return `${ind}vine-nook x=${n.x} foot=${n.foot} shelf=${n.shelf} dir=${n.dir} depth=${n.depth} h=${n.h}${tail}`;
		case 'item':
			return `${ind}${n.kind} x=${rangesText(n.xs)} y=${n.y}${tail}`;
		case 'row':
			return `${ind}row ${n.kind} x=${rangeText(n.x)} y=${n.y}${n.by === 1 ? '' : ` by=${n.by}`}${tail}`;
		case 'pogo-cache':
			return `${ind}pogo-cache x=${rangeText(n.x)} rise=${n.rise}${tail}`;
		case 'spawn': {
			const parts = [`${ind}${n.kind} x=${n.xs.map((x) => x.text).join(',')}`];
			if (n.y) parts.push(`y=${n.y.text}`);
			if (n.dir) parts.push(`dir=${n.dir.text}`);
			if (n.ride) parts.push('ride');
			return parts.join(' ') + tail;
		}
		case 'paint':
			return `${ind}paint ${n.tile} x=${rangesText(n.xs)} y=${rangesText(n.ys)}${tail}`;
		case 'clear':
			return `${ind}clear x=${rangesText(n.xs)} y=${rangesText(n.ys)}${tail}`;
		case 'place':
			return `${ind}place ${n.kind} x=${rangesText(n.xs)} y=${rangesText(n.ys)}${tail}`;
	}
}

/** Script text for an AST. A parsed script prints exactly as it was read, comments and blank lines included. */
export function print(ast: Ast): string {
	return ast.nodes.map((n) => n.raw ?? formatNode(n)).join('\n');
}
