// Tests for `useTool`'s one-off strokes: Paint here, Erase here and Pick this tile
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { useTool } from './useTool';

describe('useTool().once', () => {
	const view = levelView();

	it('paints the brush on one cell without changing the tool', () => {
		const { result } = renderHook(() => useTool(view));
		act(() => result.current.setTool('erase'));
		let outcome!: ReturnType<typeof result.current.once>;
		act(() => {
			outcome = result.current.once('paint', { x: 3, y: 4 });
		});
		expect(outcome.edits.length).toBeGreaterThan(0);
		expect(outcome.pick).toBeNull();
		expect(result.current.tool).toBe('erase');
	});

	it('erases one cell and reports the cell it covered', () => {
		const { result } = renderHook(() => useTool(view));
		let outcome!: ReturnType<typeof result.current.once>;
		act(() => {
			outcome = result.current.once('erase', { x: 2, y: 0 });
		});
		expect(outcome.edits.length).toBeGreaterThan(0);
		expect(outcome.erased).toEqual([{ x: 2, y: 0 }]);
	});

	it('reads the tile under the cell as a pick and edits nothing', () => {
		const { result } = renderHook(() => useTool(view));
		let outcome!: ReturnType<typeof result.current.once>;
		act(() => {
			outcome = result.current.once('pick', { x: 2, y: 0 });
		});
		expect(outcome.edits).toEqual([]);
		expect(outcome.pick).toEqual({ group: 'tile', kind: 'fill' });
	});

	it('keeps Select’s rectangle', () => {
		const { result } = renderHook(() => useTool(view));
		act(() => result.current.setTool('select'));
		act(() => {
			result.current.stroke('down', { x: 1, y: 1 });
		});
		act(() => {
			result.current.stroke('up', { x: 3, y: 2 });
		});
		const kept = result.current.selection;
		act(() => {
			result.current.once('paint', { x: 5, y: 5 });
		});
		expect(kept).not.toBeNull();
		expect(result.current.selection).toEqual(kept);
	});
});
