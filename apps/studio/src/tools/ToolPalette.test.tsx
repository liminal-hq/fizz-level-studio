// Tests for the tool palette, the shortcut keys and the useTool hook
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { ReactNode } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { PalettePanel } from '../panels/PalettePanel';
import { toolForKey } from './shortcuts';
import { ToolPalette } from './ToolPalette';
import { useTool } from './useTool';

function Harness({ palette, lead }: { palette: string[]; lead?: ReactNode }) {
	const handle = useTool(levelView(4, 4, { palette }));
	return (
		<>
			<ToolPalette handle={handle} lead={lead} />
			<PalettePanel
				tiles={palette}
				words={[]}
				brush={handle.brush}
				onBrush={handle.setBrush}
				spacing={handle.spacing}
				onSpacing={handle.setSpacing}
			/>
			<p data-testid="state">{`${handle.tool}|${handle.brush.group}:${handle.brush.kind}`}</p>
		</>
	);
}

describe('toolForKey', () => {
	it('maps B, E, I, S and T and ignores modified keys', () => {
		const plain = { ctrlKey: false, metaKey: false, altKey: false };
		expect(toolForKey({ key: 'b', ...plain })).toBe('paint');
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
		expect(paint).toHaveAttribute('aria-keyshortcuts', 'B');
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

	it('chooses the one brush from the palette and shows it in a chip', async () => {
		const user = userEvent.setup();
		render(<Harness palette={['empty', 'fill', 'grass']} />);
		expect(screen.queryByRole('combobox')).toBeNull();
		expect(screen.getByRole('status')).toHaveTextContent('Brush: fill');
		await user.click(screen.getByRole('option', { name: 'grass' }));
		expect(screen.getByRole('status')).toHaveTextContent('Brush: grass');
		await user.click(screen.getByRole('option', { name: 'soda' }));
		expect(screen.getByTestId('state')).toHaveTextContent('paint|item:soda');
		await user.click(screen.getByRole('option', { name: 'drone' }));
		expect(screen.getByTestId('state')).toHaveTextContent('paint|enemy:drone');
	});

	it('goes back to Paint when a palette entry is chosen from another tool', async () => {
		const user = userEvent.setup();
		render(<Harness palette={['empty', 'fill', 'grass']} />);
		await user.click(screen.getByRole('button', { name: 'Erase' }));
		await user.click(screen.getByRole('option', { name: 'grass' }));
		expect(screen.getByTestId('state')).toHaveTextContent('paint|tile:grass');
		expect(screen.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('keeps a keyboard-operable spacing control with the Treats, live for item brushes only', async () => {
		const user = userEvent.setup();
		render(<Harness palette={['empty', 'fill']} />);
		const group0 = screen.getByRole('group', { name: 'Item spacing' });
		expect(group0).toContainElement(
			screen.getByRole('button', { name: 'Place items further apart' }),
		);
		expect(screen.getByRole('button', { name: 'Place items further apart' })).toBeDisabled();
		await user.click(screen.getByRole('option', { name: 'cheezie' }));
		const group = screen.getByRole('group', { name: 'Item spacing' });
		expect(group).toHaveTextContent('Every cell');
		expect(screen.getByRole('status')).toHaveTextContent('Brush: cheezie, Every cell');
		const further = screen.getByRole('button', { name: 'Place items further apart' });
		further.focus();
		await user.keyboard('{Enter}{Enter}');
		expect(group).toHaveTextContent('Every 3 cells');
		expect(screen.getByRole('status')).toHaveTextContent('Brush: cheezie, Every 3 cells');
		const closer = screen.getByRole('button', { name: 'Place items closer together' });
		await user.click(closer);
		expect(group).toHaveTextContent('Every 2 cells');
		for (let n = 0; n < 9; n++) await user.click(further);
		expect(group).toHaveTextContent('Every 8 cells');
		expect(further).toBeDisabled();
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
		expect(result.current.brush).toEqual({ group: 'tile', kind: 'fill' });
	});

	it('previews exactly the spaced cells an item stroke writes', () => {
		const view = levelView(12, 4);
		const { result } = renderHook(() => useTool(view));
		act(() => result.current.setBrush({ group: 'item', kind: 'cheezie' }));
		act(() => result.current.setSpacing(3));
		act(() => {
			result.current.pointer('down', { x: 1, y: 2 });
		});
		act(() => {
			result.current.pointer('move', { x: 8, y: 2 });
		});
		expect(result.current.preview).toEqual([
			{ x: 1, y: 2 },
			{ x: 4, y: 2 },
			{ x: 7, y: 2 },
		]);
		let edits: LevelEdit[] = [];
		act(() => {
			edits = result.current.pointer('up', { x: 8, y: 2 });
		});
		expect(edits).toEqual([{ kind: 'row', item: 'cheezie', x: [1, 7], y: 2, by: 3 }]);
	});

	it('copies the outlined area when Stamp is chosen and pastes it', () => {
		const view = levelView(12, 6);
		const { result } = renderHook(() => useTool(view));
		act(() => result.current.setTool('select'));
		act(() => {
			result.current.pointer('down', { x: 0, y: 0 });
		});
		act(() => {
			result.current.pointer('up', { x: 2, y: 0 });
		});
		expect(result.current.clip).toBeNull();
		act(() => result.current.setTool('stamp'));
		expect(result.current.clip).toMatchObject({ width: 3, height: 1 });
		let edits: LevelEdit[] = [];
		act(() => {
			edits = result.current.pointer('down', { x: 5, y: 3 });
		});
		expect(edits).toEqual([{ kind: 'paint', tile: 'fill', x: [[5, 7]], y: [[3, 3]] }]);
	});
});

describe('the tool row lead', () => {
	it('puts the leading controls first, then a divider, then the tools', () => {
		render(<Harness palette={['block']} lead={<button type="button">Lead</button>} />);
		const row = screen.getByRole('group', { name: 'Tools' });
		const children = [...row.children];
		expect(children[0]).toContainElement(screen.getByRole('button', { name: 'Lead' }));
		expect(children[1]).toHaveAttribute('aria-hidden', 'true');
		expect(children[2]).toContainElement(screen.getByRole('button', { name: /Paint/ }));
	});

	it('draws no divider without a lead', () => {
		render(<Harness palette={['block']} />);
		const row = screen.getByRole('group', { name: 'Tools' });
		expect(row.firstElementChild).toContainElement(screen.getByRole('button', { name: /Paint/ }));
	});
});
