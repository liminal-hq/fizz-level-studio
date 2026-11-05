// Tests for snapping floating panels to the area, its margin and each other
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { isResetLayoutKey, snapMove, snapMoveWithin, snapResize } from './snap';

const area = { w: 1000, h: 600 };
const min = { w: 200, h: 120 };
const panel = { x: 300, y: 200, w: 200, h: 150 };

describe('snapMove', () => {
	it('leaves a panel alone when nothing is within 8 px', () => {
		const out = snapMove(panel, 150, area, []);
		expect(out.rect).toEqual(panel);
		expect(out.guides).toEqual([]);
	});

	it('locks to the area edge and the margin inside it', () => {
		const edge = snapMove({ ...panel, x: 2 }, 150, area, []);
		expect(edge.rect.x).toBe(0);
		expect(edge.guides).toContainEqual({ axis: 'x', at: 0 });
		const margin = snapMove({ ...panel, x: 12 }, 150, area, []);
		expect(margin.rect.x).toBe(8);
		expect(margin.guides).toContainEqual({ axis: 'x', at: 8 });
	});

	it('locks the right and bottom edges to the far side and its margin', () => {
		const right = snapMove({ ...panel, x: 1000 - 200 - 6 }, 150, area, []);
		expect(right.rect.x + right.rect.w).toBe(992);
		const bottom = snapMove({ ...panel, y: 600 - 150 - 1 }, 150, area, []);
		expect(bottom.rect.y + 150).toBe(600);
	});

	it('uses the shown height for a collapsed panel', () => {
		const out = snapMove({ ...panel, y: 600 - 46 - 3 }, 46, area, []);
		expect(out.rect.y + 46).toBe(600);
	});

	it('locks to other panels’ edges on either side', () => {
		const other = { x: 600, y: 50, w: 100, h: 100 };
		const left = snapMove({ ...panel, x: 603, y: 400 }, 150, area, [other]);
		expect(left.rect.x).toBe(600);
		expect(left.guides).toContainEqual({ axis: 'x', at: 600 });
		const abutting = snapMove({ ...panel, x: 695, y: 400 }, 150, area, [other]);
		expect(abutting.rect.x).toBe(700);
		const above = snapMove({ ...panel, x: 400, y: 154 }, 150, area, [other]);
		expect(above.rect.y).toBe(150);
	});

	it('chooses the nearest target when two are in reach', () => {
		const out = snapMove({ ...panel, x: 4 }, 150, area, [{ x: 7, y: 0, w: 10, h: 10 }]);
		expect(out.rect.x).toBe(7);
	});

	it('snaps each axis on its own', () => {
		const out = snapMove({ ...panel, x: 2, y: 333 }, 150, area, []);
		expect(out.rect).toMatchObject({ x: 0, y: 333 });
		expect(out.guides).toHaveLength(1);
	});
});

describe('snapResize', () => {
	it('locks the right and bottom edges only', () => {
		const out = snapResize({ x: 100, y: 100, w: 890, h: 495 }, area, []);
		expect(out.rect).toEqual({ x: 100, y: 100, w: 892, h: 492 });
	});

	it('locks to another panel’s edge', () => {
		const out = snapResize({ x: 100, y: 100, w: 297, h: 200 }, area, [
			{ x: 400, y: 300, w: 100, h: 100 },
		]);
		expect(out.rect.w).toBe(300);
		expect(out.guides).toContainEqual({ axis: 'x', at: 400 });
	});
});

describe('snapMoveWithin', () => {
	it('keeps a snapped panel inside the area', () => {
		const out = snapMoveWithin({ ...panel, x: -3 }, min, area, [], false);
		expect(out.rect.x).toBe(0);
	});
});

describe('isResetLayoutKey', () => {
	const key = (over: object) => ({
		key: '0',
		code: 'Digit0',
		ctrlKey: true,
		metaKey: false,
		shiftKey: true,
		altKey: false,
		...over,
	});
	it('is Ctrl+Shift+0, or Command on a Mac', () => {
		expect(isResetLayoutKey(key({}))).toBe(true);
		expect(isResetLayoutKey(key({ key: ')' }))).toBe(true);
		expect(isResetLayoutKey(key({ ctrlKey: false, metaKey: true }))).toBe(true);
	});
	it('is not 0 alone, without Shift, or with Alt', () => {
		expect(isResetLayoutKey(key({ ctrlKey: false }))).toBe(false);
		expect(isResetLayoutKey(key({ shiftKey: false }))).toBe(false);
		expect(isResetLayoutKey(key({ altKey: true }))).toBe(false);
	});
});
