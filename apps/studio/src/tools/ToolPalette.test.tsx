// Tests for the tool palette, the shortcut keys and the useTool hook
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { toolForKey } from './shortcuts';
import { ToolPalette } from './ToolPalette';
import { useTool } from './useTool';

function Harness({ palette }: { palette: string[] }) {
	const handle = useTool(levelView(4, 4, { palette }));
	return (
		<>
			<ToolPalette handle={handle} palette={palette} />
			<output data-testid="state">{`${handle.tool}|${handle.tile}|${handle.item}`}</output>
		</>
	);
}

describe('toolForKey', () => {
	it('maps P, E, I, S and T and ignores modified keys', () => {
		const plain = { ctrlKey: false, metaKey: false, altKey: false };
		expect(toolForKey({ key: 'p', ...plain })).toBe('paint');
		expect(toolForKey({ key: 'E', ...plain })).toBe('erase');
		expect(toolForKey({ key: 'i', ...plain })).toBe('pick');
		expect(toolForKey({ key: 's', ...plain })).toBe('select');
		expect(toolForKey({ key: 't', ...plain })).toBe('stamp');
		expect(toolForKey({ key: 's', ...plain, ctrlKey: true })).toBeNull();
		expect(toolForKey({ key: 'x', ...plain })).toBeNull();
	});
});

describe('ToolPalette', () => {
	it('names every tool as a toggle button and marks the current one', async () => {
		const user = userEvent.setup();
		render(<Harness palette={['empty', 'fill', 'grass']} />);
		const paint = screen.getByRole('button', { name: 'Paint' });
		expect(paint).toHaveAttribute('aria-pressed', 'true');
		expect(paint).toHaveAttribute('aria-keyshortcuts', 'P');
		await user.click(screen.getByRole('button', { name: 'Erase' }));
		expect(screen.getByTestId('state')).toHaveTextContent('erase|');
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'true');
		expect(paint).toHaveAttribute('aria-pressed', 'false');
		for (const name of ['Pick', 'Select', 'Stamp']) {
			expect(screen.getByRole('button', { name })).toBeInTheDocument();
		}
	});

	it('is operable from the keyboard', async () => {
		const user = userEvent.setup();
		render(<Harness palette={['empty', 'fill']} />);
		await user.tab();
		expect(screen.getByRole('button', { name: 'Paint' })).toHaveFocus();
		await user.tab();
		await user.keyboard('{Enter}');
		expect(screen.getByTestId('state')).toHaveTextContent('erase|');
	});

	it('chooses the tile from the level palette and the item from the constant list', async () => {
		const user = userEvent.setup();
		render(<Harness palette={['empty', 'fill', 'grass']} />);
		expect(screen.getByRole('combobox', { name: 'Tile' })).toHaveValue('fill');
		await user.selectOptions(screen.getByRole('combobox', { name: 'Tile' }), 'grass');
		await user.selectOptions(screen.getByRole('combobox', { name: 'Item' }), 'soda');
		expect(screen.getByTestId('state')).toHaveTextContent('paint|grass|soda');
	});
});

describe('useTool', () => {
	it('sends a stroke on release and switches to Paint after a pick', () => {
		const view = levelView(6, 4);
		const { result } = renderHook(() => useTool(view));
		let edits: LevelEdit[] = [];
		act(() => {
			edits = result.current.pointer('down', { x: 1, y: 2 });
		});
		expect(edits).toEqual([]);
		act(() => {
			result.current.pointer('move', { x: 3, y: 2 });
		});
		expect(result.current.preview.length).toBeGreaterThan(0);
		act(() => {
			edits = result.current.pointer('up', { x: 3, y: 2 });
		});
		expect(edits).toEqual([{ kind: 'paint', tile: 'fill', x: [[1, 3]], y: [[2, 2]] }]);
		expect(result.current.preview).toEqual([]);

		act(() => result.current.setTool('pick'));
		act(() => {
			result.current.pointer('down', { x: 0, y: 0 });
		});
		act(() => {
			result.current.pointer('up', { x: 0, y: 0 });
		});
		expect(result.current.tool).toBe('paint');
		expect(result.current.tile).toBe('fill');
	});
});
