// Tests for the editor's right-click rule on the canvas, and the commands the menus run
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeDockClient, floatingDock } from '../test/dockFixtures';
import { levelSections, levelSnapshot, levelView } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';
import { EditorScreen } from './EditorScreen';
import { ContextMenuContext, type ContextMenuApi } from './useContextMenu';

// The fallback canvas is 640 by 384 pixels at 4x; a 12 by 8 level sits centred in it.
const at = (x: number, y: number) => ({
	clientX: (640 - 12 * 16) / 2 + x * 16 + 1,
	clientY: (384 - 8 * 16) / 2 + (7 - y) * 16 + 1,
});

const text = ['script fizz1 0', 'start 1,1', 'treats', 'soda x=4 y=3', 'enemies', 'gloop x=8'].join(
	'\n',
);
const view = () =>
	levelView(12, 8, {
		items: [{ kind: 'soda', x: 4, y: 3, generator: null, line: 4 }],
		spawns: [{ kind: 'gloop', x: 8, y: null, dir: null, ride: false, on_ground: true, line: 6 }],
		sections: levelSections(),
	});

async function mount() {
	const user = userEvent.setup();
	const snapshot = levelSnapshot({ text }, view());
	const client = new FakeLevelClient(snapshot);
	const bridge = createCommandBridge();
	const menu: ContextMenuApi = { open: vi.fn(), update: vi.fn(), close: vi.fn() };
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<ContextMenuContext.Provider value={menu}>
				<EditorScreen snapshot={snapshot} client={client} docks={fakeDockClient(floatingDock())} />
			</ContextMenuContext.Provider>
		</CommandBridgeContext.Provider>,
	);
	await screen.findByRole('region', { name: 'History' });
	const canvas = screen.getByRole('application');
	const rightClick = (x: number, y: number) => {
		const event = createEvent.contextMenu(canvas, { button: 2, ...at(x, y) });
		fireEvent(canvas, event);
		return event;
	};
	return { user, client, bridge, menu, canvas, rightClick };
}

describe('right-clicking the canvas', () => {
	it('selects the thing under the pointer, moves the cursor, and never paints', async () => {
		const { client, menu, canvas, rightClick } = await mount();
		const event = rightClick(4, 3);
		expect(event.defaultPrevented).toBe(true);
		expect(canvas).toHaveAttribute('data-inspected', '4,3');
		expect(screen.getByText(/^Cell 4, 3/)).toBeInTheDocument();
		expect(menu.open).toHaveBeenCalledTimes(1);
		expect(menu.open).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'canvas',
				cell: { x: 4, y: 3 },
				inRect: false,
				thing: expect.objectContaining({ kind: 'item', name: 'soda', line: 4 }),
			}),
			{ x: at(4, 3).clientX, y: at(4, 3).clientY },
			expect.objectContaining({ keyboard: false, returnFocusTo: canvas }),
		);
		await Promise.resolve();
		expect(client.applied).toHaveLength(0);
	});

	it('selects an empty cell as the cell itself, and asks for its line to fill the header', async () => {
		const { client, menu, canvas, rightClick } = await mount();
		client.cellLines.set('7,5', 5);
		rightClick(7, 5);
		expect(canvas).toHaveAttribute('data-inspected', '7,5');
		const target = vi.mocked(menu.open).mock.calls[0]![0];
		expect(target).toMatchObject({
			kind: 'canvas',
			thing: { kind: 'cell', name: 'empty' },
			line: null,
		});
		await waitFor(() =>
			expect(menu.update).toHaveBeenCalledWith(
				expect.objectContaining({ kind: 'canvas', line: 5 }),
			),
		);
	});

	it('does not look for a line for a thing, which carries its own', async () => {
		const { menu, rightClick } = await mount();
		rightClick(4, 3);
		await Promise.resolve();
		expect(menu.update).not.toHaveBeenCalled();
	});

	it('leaves the selection alone on the thing that is already selected', async () => {
		const { menu, canvas, bridge, rightClick } = await mount();
		rightClick(4, 3);
		await waitFor(() => expect(bridge.getSnapshot().facts.selection.kind).toBe('item'));
		const facts = bridge.getSnapshot().facts.selection;
		rightClick(4, 3);
		expect(menu.open).toHaveBeenCalledTimes(2);
		expect(canvas).toHaveAttribute('data-inspected', '4,3');
		expect(bridge.getSnapshot().facts.selection).toBe(facts);
	});

	it('moves the selection to the next thing, and to a cell', async () => {
		const { canvas, bridge, rightClick } = await mount();
		rightClick(4, 3);
		rightClick(8, 1);
		await waitFor(() => expect(bridge.getSnapshot().facts.selection.kind).toBe('enemy'));
		expect(canvas).toHaveAttribute('data-inspected', '8,1');
		rightClick(2, 6);
		await waitFor(() => expect(bridge.getSnapshot().facts.selection.kind).toBe('cell'));
	});

	it('keeps Select’s rectangle and the selection when the click is inside it, and says so', async () => {
		const { user, menu, canvas, rightClick } = await mount();
		canvas.focus();
		await user.keyboard('s');
		fireEvent.pointerDown(canvas, { button: 0, ...at(2, 2) });
		fireEvent.pointerUp(canvas, at(6, 5));
		rightClick(3, 3);
		expect(canvas).not.toHaveAttribute('data-inspected');
		expect(menu.open).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'canvas', cell: { x: 3, y: 3 }, inRect: true }),
			expect.anything(),
			expect.anything(),
		);
		// Outside the rectangle the click selects as usual.
		rightClick(10, 6);
		expect(canvas).toHaveAttribute('data-inspected', '10,6');
		expect(vi.mocked(menu.open).mock.calls[1]![0]).toMatchObject({ inRect: false });
	});

	it('has no menu on the margin round the level', async () => {
		const { menu, canvas } = await mount();
		const event = createEvent.contextMenu(canvas, { button: 2, clientX: 4, clientY: 4 });
		fireEvent(canvas, event);
		expect(menu.open).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});
});

describe('the commands the canvas menu runs', () => {
	const run = async (id: string, bridge: ReturnType<typeof createCommandBridge>) =>
		act(async () => {
			runCommand(id, bridge.getSnapshot());
			await Promise.resolve();
		});

	it('Paint here paints the brush on the cursor’s cell whatever the tool is', async () => {
		const { user, client, bridge, canvas, rightClick } = await mount();
		await user.click(screen.getByRole('option', { name: 'grass' }));
		rightClick(2, 5);
		await waitFor(() => expect(bridge.getSnapshot().facts.cursor.inside).toBe(true));
		canvas.focus();
		await user.keyboard('e');
		await run('canvas.paintHere', bridge);
		await waitFor(() => expect(client.applied).toHaveLength(1));
		expect(client.applied[0]?.edit).toMatchObject({ kind: 'paint', tile: 'grass' });
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('Erase here erases the cursor’s cell', async () => {
		const { client, bridge, rightClick } = await mount();
		rightClick(2, 0);
		await waitFor(() => expect(bridge.getSnapshot().facts.cursor.tile).toBe('fill'));
		await run('canvas.eraseHere', bridge);
		await waitFor(() => expect(client.applied.length).toBeGreaterThan(0));
		expect(client.applied[0]?.edit).toMatchObject({ kind: expect.stringMatching(/clear|erase/) });
	});

	it('Pick this tile makes the tile under the cursor the brush', async () => {
		const { bridge, rightClick } = await mount();
		rightClick(2, 0);
		await waitFor(() => expect(bridge.getSnapshot().facts.cursor.tile).toBe('fill'));
		await run('canvas.pickHere', bridge);
		await waitFor(() =>
			expect(bridge.getSnapshot().facts.brush).toEqual({ group: 'tile', kind: 'fill' }),
		);
	});

	it('Show in script on a selected cell shows the line that set it, once known', async () => {
		const { client, bridge, rightClick } = await mount();
		client.cellLines.set('7,5', 5);
		rightClick(7, 5);
		await waitFor(() => expect(bridge.getSnapshot().facts.selection.hasLine).toBe(true));
		const script = screen.getByRole('textbox', { name: 'Script text' });
		await run('selection.showInScript', bridge);
		await waitFor(() => expect(script.querySelector('.cm-revealedLine')).not.toBeNull());
	});

	it('Show on the canvas moves the cursor to the selected thing', async () => {
		const { bridge, rightClick } = await mount();
		rightClick(8, 1);
		await waitFor(() => expect(bridge.getSnapshot().facts.selection.kind).toBe('enemy'));
		rightClick(2, 6);
		rightClick(8, 1);
		await run('selection.reveal', bridge);
		expect(screen.getByText(/^Cell 8, 1/)).toBeInTheDocument();
	});

	it('the layer commands hide, show only, lock and reveal', async () => {
		const { client, bridge } = await mount();
		await waitFor(() => expect(bridge.getSnapshot().facts.layers.length).toBe(5));
		await run('layers.hide.treats', bridge);
		await waitFor(() => expect(bridge.getSnapshot().facts.hiddenLayers).toEqual(['treats']));
		await run('layers.hide.treats', bridge);
		await waitFor(() => expect(bridge.getSnapshot().facts.hiddenLayers).toEqual([]));
		await run('layers.only.treats', bridge);
		await waitFor(() =>
			expect(bridge.getSnapshot().facts.hiddenLayers).toEqual([
				'terrain',
				'blocks',
				'markers',
				'enemies',
			]),
		);
		await run('layers.lock.enemies', bridge);
		await waitFor(() => expect(client.locked).toEqual(['enemies']));
	});
});
