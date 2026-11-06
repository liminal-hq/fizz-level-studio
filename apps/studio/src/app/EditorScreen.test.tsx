// Tests for the editor screen against the in-memory level client
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import crater from '../../../../fixtures/fizz1/raster/levels-crater.json';
import { fakeDockClient, floatingDock } from '../test/dockFixtures';
import { levelSnapshot, levelView } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';
import { newerSnapshot } from './snapshotRule';

// The fallback canvas is 640 by 384 pixels at 4x; a 12 by 8 level sits centred in it.
const at = (x: number, y: number) => ({
	clientX: (640 - 12 * 16) / 2 + x * 16 + 1,
	clientY: (384 - 8 * 16) / 2 + (7 - y) * 16 + 1,
});

function stroke(canvas: HTMLElement, cells: Array<[number, number]>) {
	const [first, ...rest] = cells;
	if (!first) return;
	fireEvent.pointerDown(canvas, { button: 0, ...at(...first) });
	for (const cell of rest) fireEvent.pointerMove(canvas, at(...cell));
	const last = cells[cells.length - 1] ?? first;
	fireEvent.pointerUp(canvas, at(...last));
}

/** These tests are about the panels' content, so the panels float and are all in view. */
const floating = () => fakeDockClient(floatingDock());

async function mount() {
	const snapshot = levelSnapshot();
	const client = new FakeLevelClient(snapshot);
	render(<EditorScreen snapshot={snapshot} client={client} docks={floating()} />);
	// The saved dock arrives a moment after the first render.
	await screen.findByRole('region', { name: 'History' });
	await screen.findByRole('textbox', { name: 'Script text' });
	return { client, canvas: screen.getByRole('application'), snapshot };
}

describe('newerSnapshot', () => {
	const held = levelSnapshot({ revision: 5n });

	it('keeps the held snapshot against one at or below its revision', () => {
		expect(newerSnapshot(held, levelSnapshot({ revision: 5n }))).toBe(held);
		expect(newerSnapshot(held, levelSnapshot({ revision: 4n }))).toBe(held);
	});

	it('takes a newer one, and any snapshot of a different level', () => {
		const newer = levelSnapshot({ revision: 6n });
		expect(newerSnapshot(held, newer)).toBe(newer);
		const other = levelSnapshot({ id: 'level-2', revision: 1n });
		expect(newerSnapshot(held, other)).toBe(other);
	});
});

/** The script editor's content, whose words are split into coloured spans. */
const script = () => screen.getByRole('textbox', { name: 'Script text' });

describe('EditorScreen', () => {
	it('composes the canvas, tools and panels', async () => {
		await mount();
		expect(screen.getByRole('group', { name: 'Level editor' })).toBeInTheDocument();
		expect(screen.getByRole('application')).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Tools' })).toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: 'Script text' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
	});

	it('floats the tools over the map, outside the canvas and above the status line', async () => {
		await mount();
		const tools = screen.getByRole('group', { name: 'Tools' });
		const canvas = screen.getByRole('application');
		expect(tools.parentElement).toBe(canvas.parentElement);
		expect(tools).not.toContainElement(canvas);
		// The status line is below the map, not inside it.
		const status = screen.getByText(/^Cell /);
		expect(tools.parentElement).not.toContainElement(status);
		expect(screen.getByRole('group', { name: 'Editor toolbar' })).not.toContainElement(
			screen.getByRole('button', { name: 'Paint' }),
		);
	});

	it('saves where the tools were moved to in the workspace', async () => {
		const snapshot = levelSnapshot();
		const docks = floating();
		render(
			<EditorScreen snapshot={snapshot} client={new FakeLevelClient(snapshot)} docks={docks} />,
		);
		await screen.findByRole('region', { name: 'History' });
		const grip = screen.getByRole('button', { name: 'Move the tools' });
		fireEvent.pointerDown(grip, { pointerId: 3, button: 0, clientX: 20, clientY: 20 });
		fireEvent.pointerMove(grip, { pointerId: 3, clientX: 120, clientY: 70 });
		fireEvent.pointerUp(grip, { pointerId: 3, clientX: 120, clientY: 70 });
		const tools = screen.getByRole('group', { name: 'Tools' });
		expect(tools.style.getPropertyValue('--fls-picker-x')).toBe('108px');
		expect(tools.style.getPropertyValue('--fls-picker-y')).toBe('58px');
		await waitFor(() => expect(docks.save).toHaveBeenCalled(), { timeout: 3000 });
		const saved = vi.mocked(docks.save).mock.calls.at(-1)![0];
		expect(saved.workspaces[saved.active]!.tool_picker).toEqual({ x: 108, y: 58 });
	});

	it('works on a level built from the Crater Fields fixture', () => {
		const palette = Object.keys(crater.palette);
		const ids = Object.values(crater.palette) as number[];
		const cells = new Array<number>(crater.w * crater.h).fill(0);
		crater.tiles.forEach((row: number[], y: number) =>
			row.forEach((id, x) => {
				cells[y * crater.w + x] = Math.max(0, ids.indexOf(id));
			}),
		);
		const view = levelView(crater.w, crater.h, { palette, cells, name: crater.name });
		const snapshot = levelSnapshot({}, view);
		render(
			<EditorScreen
				snapshot={snapshot}
				client={new FakeLevelClient(snapshot)}
				docks={floating()}
			/>,
		);
		expect(screen.getByRole('application')).toHaveAccessibleName(
			'Level canvas, Crater Fields, 192 by 28 cells',
		);
	});

	it('sends a one-row stroke as one applyEdit sharing a merge key, then ends the step', async () => {
		const { client, canvas } = await mount();
		const endStep = vi.spyOn(client, 'endStep');
		await userEvent.click(screen.getByRole('option', { name: 'grass' }));
		stroke(canvas, [
			[2, 3],
			[3, 3],
			[4, 3],
			[5, 3],
		]);
		await waitFor(() => expect(endStep).toHaveBeenCalledTimes(1));
		expect(client.applied).toHaveLength(1);
		expect(client.applied[0]?.edit).toEqual({
			kind: 'paint',
			tile: 'grass',
			x: [[2, 5]],
			y: [[3, 3]],
		});
		expect(client.applied[0]?.mergeKey).toBeDefined();
		expect(client.snapshot().view.cells[3 * 12 + 4]).toBe(
			client.snapshot().view.palette.indexOf('grass'),
		);
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Undo Paint grass' })).toBeEnabled(),
		);
	});

	it('sends a stroke that is not a rectangle as several edits under one merge key', async () => {
		const { client, canvas } = await mount();
		stroke(canvas, [
			[2, 3],
			[3, 3],
			[3, 4],
		]);
		await waitFor(() => expect(client.applied).toHaveLength(2));
		expect(new Set(client.applied.map((call) => call.mergeKey)).size).toBe(1);
		// Both edits were based on the revision the previous one returned.
		expect(client.applied.map((call) => call.basedOn)).toEqual([1n, 2n]);
		// One undo step, so one undo puts everything back.
		await userEvent.click(await screen.findByRole('button', { name: /^Undo/ }));
		await waitFor(() => expect(client.snapshot().view.cells[3 * 12 + 2]).toBe(0));
		expect(client.snapshot().view.cells[4 * 12 + 3]).toBe(0);
	});

	it('undoes with the button and with Ctrl+Z, and redoes with Ctrl+Shift+Z', async () => {
		const user = userEvent.setup();
		const { client, canvas } = await mount();
		stroke(canvas, [[6, 2]]);
		await waitFor(() => expect(client.snapshot().can_undo).toBe(true));
		const painted = client.snapshot().view.cells[2 * 12 + 6];
		expect(painted).not.toBe(0);

		await user.click(await screen.findByRole('button', { name: /^Undo/ }));
		await waitFor(() => expect(client.snapshot().view.cells[2 * 12 + 6]).toBe(0));
		expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

		canvas.focus();
		await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
		await waitFor(() => expect(client.snapshot().view.cells[2 * 12 + 6]).toBe(painted));

		await user.keyboard('{Control>}z{/Control}');
		await waitFor(() => expect(client.snapshot().view.cells[2 * 12 + 6]).toBe(0));
	});

	it('chooses a tool with its key', async () => {
		const user = userEvent.setup();
		await mount();
		screen.getByRole('application').focus();
		await user.keyboard('e');
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'true');
		await user.keyboard('b');
		expect(screen.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'true');
		await user.keyboard('t');
		expect(screen.getByRole('button', { name: 'Stamp' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('paints at the keyboard cursor with Space', async () => {
		const user = userEvent.setup();
		const { client, canvas } = await mount();
		canvas.focus();
		await user.keyboard('{ArrowRight}{ArrowUp} ');
		await waitFor(() => expect(client.applied).toHaveLength(1));
		expect(client.applied[0]?.edit).toMatchObject({ kind: 'paint', x: [[2, 2]], y: [[2, 2]] });
	});

	it('drops one item per cell along a drag, as one undo step named for the run', async () => {
		const user = userEvent.setup();
		const { client, canvas } = await mount();
		await user.click(screen.getByRole('option', { name: 'cheezie' }));
		stroke(canvas, [
			[2, 4],
			[3, 4],
			[4, 4],
			[5, 4],
		]);
		await waitFor(() => expect(client.applied).toHaveLength(1));
		expect(client.applied[0]?.edit).toEqual({
			kind: 'row',
			item: 'cheezie',
			x: [2, 5],
			y: 4,
			by: 1,
		});
		expect(client.snapshot().view.items).toHaveLength(4);
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Undo Place 4 cheezie' })).toBeEnabled(),
		);
	});

	it('spaces the items by the chosen step and writes it as by=', async () => {
		const user = userEvent.setup();
		const { client, canvas } = await mount();
		await user.click(
			within(screen.getByRole('group', { name: 'Treats' })).getByRole('option', { name: 'choc' }),
		);
		await user.click(screen.getByRole('button', { name: 'Place items further apart' }));
		await user.click(screen.getByRole('button', { name: 'Place items further apart' }));
		stroke(
			canvas,
			[1, 2, 3, 4, 5, 6, 7].map((x) => [x, 5]),
		);
		await waitFor(() => expect(client.applied).toHaveLength(1));
		expect(client.applied[0]?.edit).toEqual({ kind: 'row', item: 'choc', x: [1, 7], y: 5, by: 3 });
		expect(client.snapshot().text).toContain('row choc x=1..7 y=5 by=3');
	});

	it('steps the spacing with the bracket keys', async () => {
		const user = userEvent.setup();
		await mount();
		await user.click(screen.getByRole('option', { name: 'cheezie' }));
		screen.getByRole('application').focus();
		await user.keyboard(']]');
		expect(screen.getByRole('group', { name: 'Item spacing' })).toHaveTextContent('Every 3 cells');
		await user.keyboard('[[');
		expect(screen.getByRole('group', { name: 'Item spacing' })).toHaveTextContent('Every 2 cells');
	});

	it('places one enemy per click and none along a drag', async () => {
		const user = userEvent.setup();
		const { client, canvas } = await mount();
		await user.click(screen.getByRole('option', { name: 'drone' }));
		stroke(canvas, [
			[3, 4],
			[4, 4],
			[5, 4],
		]);
		await waitFor(() => expect(client.applied).toHaveLength(1));
		expect(client.applied[0]?.edit).toEqual({ kind: 'spawn', enemy: 'drone', x: 3, y: 4 });
		expect(client.snapshot().view.spawns).toHaveLength(1);
	});

	it('picks an item into the brush and goes back to Paint', async () => {
		const user = userEvent.setup();
		const snapshot = levelSnapshot({}, levelView(12, 8, { items: [{ kind: 'soda', x: 4, y: 3 }] }));
		render(
			<EditorScreen
				snapshot={snapshot}
				client={new FakeLevelClient(snapshot)}
				docks={floating()}
			/>,
		);
		await user.click(screen.getByRole('button', { name: 'Pick' }));
		stroke(screen.getByRole('application'), [[4, 3]]);
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'true'),
		);
		expect(screen.getByText('Brush: soda, Every cell')).toBeInTheDocument();
	});

	it('copies the outlined area with Stamp and pastes it as one undo step', async () => {
		const user = userEvent.setup();
		const { client, canvas } = await mount();
		await user.click(screen.getByRole('button', { name: 'Select' }));
		stroke(canvas, [
			[0, 0],
			[2, 0],
		]);
		await user.click(screen.getByRole('button', { name: 'Stamp' }));
		stroke(canvas, [[6, 4]]);
		await waitFor(() => expect(client.applied).toHaveLength(1));
		expect(client.applied[0]?.edit).toEqual({
			kind: 'paint',
			tile: 'fill',
			x: [[6, 8]],
			y: [[4, 4]],
		});
		expect(client.snapshot().view.cells[4 * 12 + 7]).toBe(1);
		await waitFor(() => expect(client.snapshot().can_undo).toBe(true));
	});

	it('ignores a snapshot at or below the revision it has, and takes a newer one', async () => {
		const { client } = await mount();
		const stale = levelSnapshot({ revision: 1n, text: 'stale text\n' });
		act(() => client.emit(stale));
		expect(script()).not.toHaveTextContent('stale text');

		const older = levelSnapshot({ revision: 0n, text: 'older text\n' });
		act(() => client.emit(older));
		expect(script()).not.toHaveTextContent('older text');

		const fresh = levelSnapshot({ revision: 2n, text: 'fresh text\n', edited_outside: true });
		act(() => client.emit(fresh));
		expect(script()).toHaveTextContent('fresh text');
		expect(screen.getByText('This level was changed outside the studio.')).toBeInTheDocument();

		act(() => client.emit(levelSnapshot({ revision: 2n, text: 'same revision\n' })));
		expect(script()).not.toHaveTextContent('same revision');
		expect(script()).toHaveTextContent('fresh text');
	});

	it('shows the flat-view note for a Fizz 2 level and not for a Fizz 1 one', async () => {
		const two = levelSnapshot({ target: 'fizz2', banner: 'level.flatFallback' });
		const { unmount } = render(
			<EditorScreen snapshot={two} client={new FakeLevelClient(two)} docks={floating()} />,
		);
		expect(screen.getByRole('note')).toHaveTextContent(
			'The game’s own drawing of this level is not available yet, so this is the flat view.',
		);
		unmount();
		const one = levelSnapshot();
		render(<EditorScreen snapshot={one} client={new FakeLevelClient(one)} docks={floating()} />);
		await screen.findByRole('region', { name: 'History' });
		expect(screen.queryByRole('note')).toBeNull();
	});

	it('shows nothing for a banner key the catalogue lacks', async () => {
		const odd = levelSnapshot({ banner: 'level.nonsense' });
		render(<EditorScreen snapshot={odd} client={new FakeLevelClient(odd)} docks={floating()} />);
		await screen.findByRole('region', { name: 'History' });
		expect(screen.queryByRole('note')).toBeNull();
	});

	it('shows no banner for a level nobody edited outside', async () => {
		await mount();
		expect(
			screen.queryByText('This level was changed outside the studio.'),
		).not.toBeInTheDocument();
	});

	it('says so when the level moved on under an edit', async () => {
		const { client, canvas } = await mount();
		// The backend moves ahead without telling the screen, so its next edit is based on a stale revision.
		await client.applyEdit('level-1', { kind: 'clear', x: [[0, 0]], y: [[0, 0]] }, 1n);
		stroke(canvas, [[2, 2]]);
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'The level changed first, so that edit was not applied. Try it again.',
		);
	});

	it('reveals the script line that set an object when it is chosen in the list', async () => {
		const text = 'line one\nline two\nline three\n';
		const view = levelView(12, 8, { items: [{ kind: 'soda', x: 3, y: 2 }] });
		const snapshot = levelSnapshot({ text }, view);
		const client = new FakeLevelClient(snapshot);
		client.cellLines.set('3,2', 3);
		render(<EditorScreen snapshot={snapshot} client={client} docks={floating()} />);
		await screen.findByRole('region', { name: 'History' });
		await userEvent.click(screen.getByRole('button', { name: 'Item soda at 3, 2' }));
		await waitFor(() =>
			expect(document.querySelector('.cm-revealedLine')).toHaveTextContent('line three'),
		);
	});

	it('reveals the line behind a cell only with Pick or Select, not while painting', async () => {
		const text = 'line one\nline two\nline three\n';
		const snapshot = levelSnapshot({ text });
		const client = new FakeLevelClient(snapshot);
		client.cellLines.set('4,4', 2);
		render(<EditorScreen snapshot={snapshot} client={client} docks={floating()} />);
		await screen.findByRole('region', { name: 'History' });
		const canvas = screen.getByRole('application');
		fireEvent.pointerDown(canvas, { button: 0, ...at(4, 4) });
		fireEvent.pointerUp(canvas, at(4, 4));
		await Promise.resolve();
		expect(document.querySelector('.cm-revealedLine')).toBeNull();
		await userEvent.click(screen.getByRole('button', { name: 'Select' }));
		fireEvent.pointerDown(canvas, { button: 0, ...at(4, 4) });
		fireEvent.pointerUp(canvas, at(4, 4));
		await waitFor(() =>
			expect(document.querySelector('.cm-revealedLine')).toHaveTextContent('line two'),
		);
	});

	it('gives the editor the words the client documents', async () => {
		const snapshot = levelSnapshot();
		const client = new FakeLevelClient(snapshot);
		const words = vi.spyOn(client, 'words');
		render(<EditorScreen snapshot={snapshot} client={client} docks={floating()} />);
		await screen.findByRole('region', { name: 'History' });
		await waitFor(() => expect(words).toHaveBeenCalledTimes(1));
	});
});

describe('EditorScreen panels', () => {
	const word = (w: string, kind: string) => ({
		word: w,
		kind,
		syntax: `${w} <args>`,
		example: w,
		note: '',
	});

	async function mountWithWords() {
		const snapshot = levelSnapshot();
		const client = new FakeLevelClient(snapshot);
		client.wordDocs = [word('paint', 'statement'), word('soda', 'item'), word('gloop', 'enemy')];
		client.ghostProposals = [
			{
				id: 'h1',
				title: 'A ledge',
				why: null,
				lines: ['paint grass x=2 y=2'],
				cells: [{ x: 2, y: 2, op: 'paint', word: 'grass' }],
			},
		];
		render(<EditorScreen snapshot={snapshot} client={client} docks={floating()} />);
		await screen.findByRole('region', { name: 'History' });
		return client;
	}

	it('chooses a tool with its key and ignores the key while a field has focus', async () => {
		const user = userEvent.setup();
		await mountWithWords();
		screen.getByRole('application').focus();
		await user.keyboard('e');
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'true');
		const field = document.createElement('input');
		document.body.append(field);
		field.focus();
		await user.keyboard('p');
		field.remove();
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('chooses a palette tile, then an item, as the one brush for Paint', async () => {
		const user = userEvent.setup();
		await mountWithWords();
		const region = await screen.findByRole('region', { name: 'Palette' });
		await user.click(screen.getByRole('button', { name: 'Stamp' }));
		await user.click(within(region).getByRole('option', { name: 'grass' }));
		expect(screen.getByRole('button', { name: /^Paint/ })).toHaveAttribute('aria-pressed', 'true');
		expect(within(region).getByRole('option', { name: 'grass' })).toHaveAttribute(
			'aria-selected',
			'true',
		);
		expect(screen.getByText('Brush: grass')).toBeInTheDocument();
		await user.click(await within(region).findByRole('option', { name: 'soda' }));
		expect(screen.getByRole('button', { name: /^Paint/ })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText(/^Brush: soda/)).toBeInTheDocument();
	});

	it("lists Claude's pending proposals from the backend", async () => {
		await mountWithWords();
		expect(await screen.findByText('A ledge')).toBeInTheDocument();
		expect(screen.getByRole('switch')).toBeChecked();
	});
});
