// Tests for the Inspector panel: what each kind of selection shows
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { levelSnapshot, levelView } from '../test/levelFixtures';
import type { Thing } from '../tools/tool';
import { InspectorPanel } from './InspectorPanel';
import type { ThingEditApi, ThingEditResult } from './thingEdit';

const view = levelView(12, 8, {
	items: [
		{ kind: 'soda', x: 3, y: 1, generator: null, line: 5 },
		{ kind: 'cookie', x: 6, y: 2, generator: 'pogo-cache', line: 8 },
	],
	spawns: [
		{ kind: 'gloop', x: 5, y: null, dir: null, ride: false, on_ground: true, line: 11 },
		{ kind: 'drone', x: 8.5, y: 4, dir: 1, ride: false, on_ground: false, line: 12 },
		{ kind: 'ent', x: 9, y: 3, dir: null, ride: true, on_ground: false, line: 13 },
	],
	start: { x: 2, y: 1, line: 3 },
});
const snapshot = levelSnapshot({}, view);

const thing = (over: Partial<Thing>): Thing => ({
	kind: 'item',
	name: 'soda',
	x: 3,
	y: 1,
	layer: 'objects',
	index: 0,
	line: 5,
	...over,
});

const words = [
	{
		word: 'soda',
		kind: 'item',
		syntax: 'soda x=N y=N',
		example: '',
		note: 'A soda restores health.',
	},
];

function show(selected: Thing | null, over: Partial<Parameters<typeof InspectorPanel>[0]> = {}) {
	const onShowLine = vi.fn();
	render(
		<InspectorPanel
			snapshot={snapshot}
			thing={selected}
			words={words}
			onShowLine={onShowLine}
			{...over}
		/>,
	);
	return { onShowLine };
}

describe('the Inspector panel', () => {
	it('says how to select something when nothing is selected', () => {
		show(null);
		expect(screen.getByRole('group', { name: 'Selected thing' })).toBeInTheDocument();
		expect(
			screen.getByText(
				'Nothing selected. Inspect (Q) a thing on the level, or choose one in Objects.',
			),
		).toBeInTheDocument();
	});

	it('shows an item’s name and kind, position, line and quick help', () => {
		show(thing({}));
		expect(screen.getByRole('heading', { name: 'Soda · treat' })).toBeInTheDocument();
		expect(screen.getByText('A soda restores health.')).toBeInTheDocument();
		const fields = screen.getByRole('group', { name: 'Selected thing' });
		expect(within(fields).getByText('x').nextElementSibling).toHaveTextContent('3');
		expect(within(fields).getByText('y').nextElementSibling).toHaveTextContent('1');
		expect(screen.getByText('Line 5')).toBeInTheDocument();
		expect(screen.queryByText('Facing')).toBeNull();
	});

	it('shows an enemy with no row standing on the ground, at the row it rests on', () => {
		show(thing({ kind: 'enemy', name: 'gloop', index: 0, line: 11, x: 5, y: 1 }));
		expect(screen.getByRole('heading', { name: 'Gloop · enemy' })).toBeInTheDocument();
		expect(screen.getByText('y').nextElementSibling).toHaveTextContent('1');
		expect(screen.getByText(/Stands on the ground/)).toBeInTheDocument();
		// The Builder's default facing is left.
		expect(screen.getByText('Facing').nextElementSibling).toHaveTextContent('Left');
	});

	it('shows an enemy’s facing and its fractional column as written', () => {
		show(thing({ kind: 'enemy', name: 'drone', index: 1, line: 12, x: 8, y: 4 }));
		expect(screen.getByText('x').nextElementSibling).toHaveTextContent('8.5');
		expect(screen.getByText('Facing').nextElementSibling).toHaveTextContent('Right');
		expect(screen.queryByText(/Stands on the ground/)).toBeNull();
	});

	it('says a rider has no facing', () => {
		show(thing({ kind: 'enemy', name: 'ent', index: 2, line: 13, x: 9, y: 3 }));
		expect(screen.getByText('Facing').nextElementSibling).toHaveTextContent(
			'A rider has no facing',
		);
	});

	it('shows the start by its own name, with its place and line', () => {
		show(thing({ kind: 'start', name: 'start', index: 0, line: 3, x: 2, y: 1 }));
		expect(screen.getByRole('heading', { name: 'Start' })).toBeInTheDocument();
		expect(screen.getByText('Line 3')).toBeInTheDocument();
		expect(screen.queryByText('Facing')).toBeNull();
	});

	it('names what made a generated item and sends the person to its line', async () => {
		const user = userEvent.setup();
		const { onShowLine } = show(thing({ name: 'cookie', index: 1, x: 6, y: 2, line: 8 }));
		expect(
			screen.getByText('Made by the pogo-cache on line 8: edit that line in the script.'),
		).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Show in script' }));
		expect(onShowLine).toHaveBeenCalledWith(8);
	});

	it('shows a cell with its tile and the line that last set it', async () => {
		const lookup = vi.fn().mockResolvedValue(7);
		const { onShowLine } = show(
			thing({ kind: 'cell', name: 'fill', x: 4, y: 0, layer: 'tiles', line: null }),
			{ lookupCellLine: lookup },
		);
		expect(screen.getByRole('heading', { name: 'Cell 4, 0 · fill' })).toBeInTheDocument();
		expect(screen.getByText('Tiles are painted, not edited here.')).toBeInTheDocument();
		expect(await screen.findByText('Line 7')).toBeInTheDocument();
		expect(lookup).toHaveBeenCalledWith(4, 0);
		await userEvent.setup().click(screen.getByRole('button', { name: 'Show in script' }));
		expect(onShowLine).toHaveBeenCalledWith(7);
	});

	it('shows no line for a cell no statement set', async () => {
		const lookup = vi.fn().mockResolvedValue(null);
		show(thing({ kind: 'cell', name: 'empty', x: 4, y: 5, layer: 'tiles', line: null }), {
			lookupCellLine: lookup,
		});
		await waitFor(() => expect(lookup).toHaveBeenCalled());
		expect(screen.queryByRole('button', { name: 'Show in script' })).toBeNull();
	});

	it('falls back to the empty state when the entry is no longer in the view', () => {
		show(thing({ index: 9 }));
		expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
	});

	it('says a Fizz 2 level’s things are changed in its script', () => {
		const fizz2 = levelSnapshot({ target: 'fizz2' }, view);
		show(thing({ kind: 'start', name: 'start', index: 0, line: 3 }), { snapshot: fizz2 });
		expect(
			screen.getByText('Things in a Fizz 2 level are changed in its script for now.'),
		).toBeInTheDocument();
	});
});

describe('the Inspector panel’s controls', () => {
	function editable(
		selected: Thing | null,
		answer: ThingEditResult = { ok: true },
		over: Partial<Parameters<typeof InspectorPanel>[0]> = {},
	) {
		const apply = vi.fn().mockResolvedValue(answer);
		const endStep = vi.fn();
		const edit: ThingEditApi = { apply, endStep };
		const ui = (current: Thing | null, deleted: string | null = null) => (
			<InspectorPanel
				snapshot={snapshot}
				thing={current}
				words={words}
				onShowLine={() => {}}
				edit={edit}
				deleted={deleted}
				{...over}
			/>
		);
		const view = render(ui(selected));
		return {
			apply,
			endStep,
			rerender: (t: Thing | null, deleted?: string | null) => view.rerender(ui(t, deleted)),
		};
	}
	const soda = thing({});
	const gloop = thing({ kind: 'enemy', name: 'gloop', index: 0, line: 11, x: 5, y: 1 });
	const drone = thing({ kind: 'enemy', name: 'drone', index: 1, line: 12, x: 8, y: 4 });

	it('moves an item with the x and y steppers, keeping the other axis', async () => {
		const user = userEvent.setup();
		const { apply } = editable(soda);
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		expect(apply).toHaveBeenLastCalledWith({ op: 'move', x: 4, y: 1 }, expect.any(String));
		await user.click(screen.getByRole('button', { name: 'Decrease y' }));
		expect(apply).toHaveBeenLastCalledWith({ op: 'move', x: 3, y: 0 }, expect.any(String));
	});

	it('keeps an enemy on the ground when x moves, and pins it when y is edited', async () => {
		const user = userEvent.setup();
		const { apply } = editable(gloop);
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		expect(apply).toHaveBeenLastCalledWith({ op: 'move', x: 6, y: null }, expect.any(String));
		await user.click(screen.getByRole('button', { name: 'Increase y' }));
		expect(apply).toHaveBeenLastCalledWith({ op: 'move', x: 5, y: 2 }, expect.any(String));
		expect(screen.getByText('Stands on the ground')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'On the ground' })).toBeNull();
	});

	it('puts a pinned enemy back on the ground', async () => {
		const user = userEvent.setup();
		const { apply } = editable(drone);
		await user.click(screen.getByRole('button', { name: 'On the ground' }));
		expect(apply).toHaveBeenLastCalledWith({ op: 'move', x: 8.5, y: null }, expect.any(String));
	});

	it('steps a fractional column and keeps the fraction', async () => {
		const user = userEvent.setup();
		const { apply } = editable(drone);
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		expect(apply).toHaveBeenLastCalledWith({ op: 'move', x: 9.5, y: 4 }, expect.any(String));
	});

	it('shares one merge key across a run of presses, and a new one after the run ends', async () => {
		const user = userEvent.setup();
		const { apply, endStep } = editable(soda);
		const more = screen.getByRole('button', { name: 'Increase x' });
		await user.click(more);
		await user.click(more);
		await user.keyboard('{Tab}{Tab}{Tab}{Tab}{Tab}{Tab}');
		const keys = apply.mock.calls.map(([, key]) => key as string);
		expect(keys[0]).toBe(keys[1]);
		expect(keys[0]).toMatch(/^thing:item:0:move:/);
		expect(endStep).toHaveBeenCalled();
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		expect(apply.mock.calls.at(-1)![1]).not.toBe(keys[0]);
	});

	it('shows the facing as pressed keycaps and turns the enemy', async () => {
		const user = userEvent.setup();
		const { apply } = editable(drone);
		const group = screen.getByRole('group', { name: 'Facing' });
		expect(within(group).getByRole('button', { name: 'Right' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(within(group).getByRole('button', { name: 'Left' })).toHaveAttribute(
			'aria-pressed',
			'false',
		);
		await user.click(within(group).getByRole('button', { name: 'Left' }));
		expect(apply).toHaveBeenLastCalledWith({ op: 'face', facing: 'left' }, expect.any(String));
	});

	it('offers no facing keycaps for a rider, only the reason', () => {
		editable(thing({ kind: 'enemy', name: 'ent', index: 2, line: 13, x: 9, y: 3 }));
		expect(screen.queryByRole('group', { name: 'Facing' })).toBeNull();
		expect(screen.getByText('A rider has no facing')).toBeInTheDocument();
	});

	it('deletes the thing, says so after, and offers no facing or position for it any more', async () => {
		const user = userEvent.setup();
		const { apply, rerender } = editable(soda);
		await user.click(screen.getByRole('button', { name: 'Delete' }));
		expect(apply).toHaveBeenLastCalledWith({ op: 'delete' }, expect.any(String));
		await waitFor(() => expect(apply).toHaveResolved());
		// The editor lets go of the selection once Rust has applied the delete.
		rerender(null, 'soda');
		expect(await screen.findByText('Deleted soda. Ctrl+Z puts it back.')).toBeInTheDocument();
		expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
	});

	it('disables Delete for the start, with the reason', () => {
		editable(thing({ kind: 'start', name: 'start', index: 0, line: 3, x: 2, y: 1 }));
		expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
		expect(screen.getByText('A level needs a start.')).toBeInTheDocument();
		expect(screen.queryByRole('group', { name: 'Facing' })).toBeNull();
	});

	it('shows a generated item with its reason and no way to change it', () => {
		editable(thing({ name: 'cookie', index: 1, x: 6, y: 2, line: 8 }));
		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
		expect(screen.getByText(/Made by the pogo-cache/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show in script' })).toBeEnabled();
	});

	it('shows a refusal under the fields and clears it on the next try', async () => {
		const user = userEvent.setup();
		const { apply } = editable(soda, {
			ok: false,
			problem: { id: 'level.locked', values: { layers: 'Treats' } },
		});
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Treats is locked. Unlock it in Layers to change it.',
		);
		apply.mockResolvedValueOnce({ ok: false, problem: { text: 'x is out of bounds' } });
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('x is out of bounds');
		apply.mockResolvedValueOnce({ ok: true });
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
	});

	it('warns, without refusing, when another thing is on the same cell', () => {
		const crowded = levelSnapshot(
			{},
			levelView(12, 8, {
				items: [
					{ kind: 'soda', x: 3, y: 1, generator: null, line: 5 },
					{ kind: 'cheezie', x: 3, y: 1, generator: null, line: 6 },
				],
			}),
		);
		editable(soda, { ok: true }, { snapshot: crowded });
		expect(screen.getByText('Another thing is on this cell.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Increase x' })).toBeEnabled();
	});

	it('only shows a Fizz 2 level’s start, with no controls', () => {
		editable(thing({ kind: 'start', name: 'start', index: 0, line: 3, x: 2, y: 1 }), undefined, {
			snapshot: levelSnapshot({ target: 'fizz2' }, view),
		});
		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
	});

	it('ends the undo step when the selection goes away, but only when a change opened one', async () => {
		const { endStep, rerender } = editable(soda);
		rerender(null);
		expect(endStep).not.toHaveBeenCalled();
		rerender(soda);
		await userEvent.setup().click(screen.getByRole('button', { name: 'Increase x' }));
		rerender(null);
		expect(endStep).toHaveBeenCalledTimes(1);
	});
});
