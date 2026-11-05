// Tests for the editor screen against the in-memory level client
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import crater from '../../../../fixtures/fizz1/raster/levels-crater.json';
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

function mount() {
	const snapshot = levelSnapshot();
	const client = new FakeLevelClient(snapshot);
	render(<EditorScreen snapshot={snapshot} client={client} />);
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

describe('EditorScreen', () => {
	it('composes the canvas, tools and panels', () => {
		mount();
		expect(screen.getByRole('group', { name: 'Level editor' })).toBeInTheDocument();
		expect(screen.getByRole('application')).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Tools' })).toBeInTheDocument();
		expect(screen.getByRole('list', { name: 'Script text' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
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
		render(<EditorScreen snapshot={snapshot} client={new FakeLevelClient(snapshot)} />);
		expect(screen.getByRole('application')).toHaveAccessibleName(
			'Level canvas, Crater Fields, 192 by 28 cells',
		);
	});

	it('sends a one-row stroke as one applyEdit sharing a merge key, then ends the step', async () => {
		const { client, canvas } = mount();
		const endStep = vi.spyOn(client, 'endStep');
		await userEvent.click(screen.getByRole('button', { name: /^Tile:/ }));
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
		const { client, canvas } = mount();
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
		const { client, canvas } = mount();
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

	it('paints at the keyboard cursor with Space', async () => {
		const user = userEvent.setup();
		const { client, canvas } = mount();
		canvas.focus();
		await user.keyboard('{ArrowRight}{ArrowUp} ');
		await waitFor(() => expect(client.applied).toHaveLength(1));
		expect(client.applied[0]?.edit).toMatchObject({ kind: 'paint', x: [[2, 2]], y: [[2, 2]] });
	});

	it('places the chosen item with the Stamp tool', async () => {
		const user = userEvent.setup();
		const { client, canvas } = mount();
		await user.click(screen.getByRole('button', { name: 'Stamp' }));
		await user.click(screen.getByRole('button', { name: /^Item:/ }));
		await user.click(screen.getByRole('option', { name: 'soda' }));
		stroke(canvas, [[5, 5]]);
		await waitFor(() =>
			expect(client.snapshot().view.items).toEqual([{ kind: 'soda', x: 5, y: 5 }]),
		);
	});

	it('ignores a snapshot at or below the revision it has, and takes a newer one', async () => {
		const { client } = mount();
		const stale = levelSnapshot({ revision: 1n, text: 'stale text\n' });
		act(() => client.emit(stale));
		expect(screen.queryByText('stale text')).not.toBeInTheDocument();

		const older = levelSnapshot({ revision: 0n, text: 'older text\n' });
		act(() => client.emit(older));
		expect(screen.queryByText('older text')).not.toBeInTheDocument();

		const fresh = levelSnapshot({ revision: 2n, text: 'fresh text\n', edited_outside: true });
		act(() => client.emit(fresh));
		expect(screen.getByText('fresh text')).toBeInTheDocument();
		expect(screen.getByText('This level was changed outside the studio.')).toBeInTheDocument();

		act(() => client.emit(levelSnapshot({ revision: 2n, text: 'same revision\n' })));
		expect(screen.queryByText('same revision')).not.toBeInTheDocument();
		expect(screen.getByText('fresh text')).toBeInTheDocument();
	});

	it('shows the flat-view note for a Fizz 2 level and not for a Fizz 1 one', () => {
		const two = levelSnapshot({ target: 'fizz2', banner: 'level.flatFallback' });
		const { unmount } = render(<EditorScreen snapshot={two} client={new FakeLevelClient(two)} />);
		expect(screen.getByRole('note')).toHaveTextContent(
			'The game’s own drawing of this level is not available yet, so this is the flat view.',
		);
		unmount();
		const one = levelSnapshot();
		render(<EditorScreen snapshot={one} client={new FakeLevelClient(one)} />);
		expect(screen.queryByRole('note')).toBeNull();
	});

	it('shows nothing for a banner key the catalogue lacks', () => {
		const odd = levelSnapshot({ banner: 'level.nonsense' });
		render(<EditorScreen snapshot={odd} client={new FakeLevelClient(odd)} />);
		expect(screen.queryByRole('note')).toBeNull();
	});

	it('shows no banner for a level nobody edited outside', () => {
		mount();
		expect(
			screen.queryByText('This level was changed outside the studio.'),
		).not.toBeInTheDocument();
	});

	it('says so when the level moved on under an edit', async () => {
		const { client, canvas } = mount();
		// The backend moves ahead without telling the screen, so its next edit is based on a stale revision.
		await client.applyEdit('level-1', { kind: 'clear', x: [[0, 0]], y: [[0, 0]] }, 1n);
		stroke(canvas, [[2, 2]]);
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'The level changed first, so that edit was not applied. Try it again.',
		);
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

	function mountWithWords() {
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
		render(<EditorScreen snapshot={snapshot} client={client} />);
		return client;
	}

	it('chooses a tool with its key and ignores the key while a field has focus', async () => {
		const user = userEvent.setup();
		mountWithWords();
		screen.getByRole('application').focus();
		await user.keyboard('e');
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'true');
		(await screen.findByRole('combobox', { name: 'Script line' })).focus();
		await user.keyboard('p');
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('chooses a palette tile for Paint and an item for Stamp', async () => {
		const user = userEvent.setup();
		mountWithWords();
		const region = await screen.findByRole('region', { name: 'Palette' });
		await user.click(screen.getByRole('button', { name: 'Stamp' }));
		await user.click(within(region).getByRole('button', { name: 'grass' }));
		expect(screen.getByRole('button', { name: /^Paint/ })).toHaveAttribute('aria-pressed', 'true');
		expect(within(region).getByRole('button', { name: 'grass' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.getByRole('button', { name: 'Tile: grass' })).toBeInTheDocument();
		await user.click(await within(region).findByRole('button', { name: 'soda' }));
		expect(screen.getByRole('button', { name: /^Stamp/ })).toHaveAttribute('aria-pressed', 'true');
	});

	it('offers paint for pa in the Script panel from the backend words', async () => {
		const user = userEvent.setup();
		mountWithWords();
		const field = await screen.findByRole('combobox', { name: 'Script line' });
		await user.type(field, 'pa');
		expect(await screen.findByRole('option', { name: /^paint/ })).toBeInTheDocument();
		await user.keyboard('{Tab}');
		expect(field).toHaveValue('paint');
	});

	it("lists Claude's pending proposals from the backend", async () => {
		mountWithWords();
		expect(await screen.findByText('A ledge')).toBeInTheDocument();
		expect(screen.getByRole('switch')).toBeChecked();
	});
});
