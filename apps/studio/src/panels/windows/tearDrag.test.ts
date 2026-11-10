// Tests for the drag out of the window: the route each desktop gets and what a release does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { createFakeTearoff } from '../../services/fakeTearoffClient';
import type { TearoffFeatures } from '../../services/tearoffClient';
import {
	GHOST_SIZE,
	ghostGrab,
	placementFromDrop,
	startTearDrag,
	type TearDragHooks,
} from './tearDrag';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(features: Partial<TearoffFeatures>, opened: string | null = 'panel-layers-1') {
	const client = createFakeTearoff(features);
	const hooks = {
		tearOff: vi.fn(),
		openHidden: vi.fn(async () => opened),
		discard: vi.fn(),
		say: vi.fn(),
	} satisfies TearDragHooks;
	const finish = vi.fn();
	const exit = startTearDrag({
		client,
		features: client.features_,
		info: {
			id: 'layers',
			point: { x: -10, y: 40 },
			source: 'header',
			start: { x: 30, y: 12 },
			grab: { x: 30, y: 12 },
			finish,
		},
		title: 'Layers',
		windowSize: { width: 260, height: 240 },
		remembered: null,
		hooks,
	});
	return { client, hooks, finish, exit };
}

const ghostDesktop = { ghost: true, cursorFollow: true, hitTest: true, windowPosition: true };

describe('placementFromDrop', () => {
	const report = (cursor: { x: number; y: number } | null, over = {}) => ({
		cursor,
		scaleFactor: 2,
		cursorStale: false,
		hit: null,
		...over,
	});

	it('opens the window with the cursor where the card was held, in physical pixels', () => {
		expect(
			placementFromDrop(
				report({ x: 1000, y: 600 }),
				{ x: 30, y: 12 },
				{ width: 260, height: 240 },
				null,
			),
		).toEqual({ x: 940, y: 576, w: 520, h: 480 });
	});

	it('keeps the size the window last had', () => {
		expect(
			placementFromDrop(
				report({ x: 100, y: 100 }),
				{ x: 0, y: 0 },
				{ width: 260, height: 240 },
				{ x: 5, y: 5, w: 700, h: 500 },
			),
		).toMatchObject({ w: 700, h: 500 });
	});

	it('gives no place when the cursor is unknown or may be out of date', () => {
		const size = { width: 260, height: 240 };
		expect(placementFromDrop(report(null), { x: 0, y: 0 }, size, null)).toBeNull();
		expect(
			placementFromDrop(report({ x: 1, y: 1 }, { cursorStale: true }), { x: 0, y: 0 }, size, null),
		).toBeNull();
	});
});

describe('ghostGrab', () => {
	it('keeps the grab point inside the card, off its edges', () => {
		expect(ghostGrab({ x: 0, y: 0 })).toEqual({ x: 12, y: 12 });
		expect(ghostGrab({ x: 900, y: 900 })).toEqual({
			x: GHOST_SIZE.width - 12,
			y: GHOST_SIZE.height - 12,
		});
		expect(ghostGrab({ x: 40, y: 20 })).toEqual({ x: 40, y: 20 });
	});
});

describe('on a desktop with no way to drag a window out', () => {
	it('finishes the drag, says why and points to the panel menu', () => {
		const { exit, finish, hooks, client } = setup({});
		expect(exit).toBeUndefined();
		expect(finish).toHaveBeenCalledTimes(1);
		expect(hooks.say.mock.calls[0]![0]).toMatch(/Tear off/);
		expect(client.calls).toEqual([]);
	});

	it('does the same where the ghost cannot follow the cursor', () => {
		const { exit, finish } = setup({ ghost: true, cursorFollow: false });
		expect(exit).toBeUndefined();
		expect(finish).toHaveBeenCalled();
	});
});

describe('on X11 or Windows, with the ghost', () => {
	it('shows the ghost with the panel as the payload, held where the press was', async () => {
		const { client } = setup(ghostDesktop);
		await settle();
		expect(client.begun).toHaveLength(1);
		expect(client.begun[0]).toMatchObject({
			payload: { kind: 'panel', panel: 'layers', source: 'header', title: 'Layers' },
			grabOffset: { x: 30, y: 12 },
			size: GHOST_SIZE,
		});
	});

	it('opens the window where the cursor was let go, when it is over no region', async () => {
		const { client, exit, hooks } = setup(ghostDesktop);
		client.dropReport = {
			cursor: { x: 800, y: 500 },
			scaleFactor: 1,
			cursorStale: false,
			hit: null,
		};
		exit!.drop({ x: -50, y: 40 });
		await settle();
		expect(client.ended).toEqual(['drop']);
		expect(hooks.tearOff).toHaveBeenCalledWith({ x: 770, y: 488, w: 260, h: 240 });
		expect(hooks.say.mock.calls.at(-1)![0]).toMatch(/window of its own/);
	});

	it('opens it where it was last when the cursor value cannot be trusted', async () => {
		const { client, exit, hooks } = setup(ghostDesktop);
		client.dropReport = { cursor: { x: 1, y: 1 }, scaleFactor: 1, cursorStale: true, hit: null };
		exit!.drop({ x: -50, y: 40 });
		await settle();
		expect(hooks.tearOff).toHaveBeenCalledWith(null);
	});

	it('does not tear off when the release is over another window of the app', async () => {
		const { client, exit, hooks } = setup(ghostDesktop);
		client.dropReport = {
			cursor: { x: 800, y: 500 },
			scaleFactor: 1,
			cursorStale: false,
			hit: { window: 'main-2', region: 'level', x: 5, y: 5 },
		};
		exit!.drop({ x: -50, y: 40 });
		await settle();
		expect(hooks.tearOff).not.toHaveBeenCalled();
		expect(hooks.say.mock.calls.at(-1)![0]).toMatch(/stays where it was/);
	});

	it('cancels the ghost, and opens nothing, when the drag is cancelled', async () => {
		const { client, exit, hooks } = setup(ghostDesktop);
		await settle();
		exit!.cancel();
		expect(client.ended).toEqual(['cancel']);
		expect(hooks.tearOff).not.toHaveBeenCalled();
	});

	it('cancels a ghost that was still starting when the drag ended', async () => {
		const { client, exit } = setup(ghostDesktop);
		exit!.cancel();
		await settle();
		expect(client.ended).toEqual(['cancel']);
	});

	it('gives up, and says so, where no ghost can be shown', async () => {
		const client = createFakeTearoff(ghostDesktop);
		client.beginResult = 'noGhost';
		const finish = vi.fn();
		const say = vi.fn();
		startTearDrag({
			client,
			features: client.features_,
			info: {
				id: 'script',
				point: { x: -1, y: 1 },
				source: 'scriptTab',
				start: { x: 5, y: 5 },
				grab: { x: 5, y: 5 },
				finish,
			},
			title: 'Script',
			windowSize: { width: 400, height: 300 },
			remembered: null,
			hooks: { tearOff: vi.fn(), openHidden: async () => null, discard: vi.fn(), say },
		});
		await settle();
		expect(finish).toHaveBeenCalledTimes(1);
		expect(say.mock.calls[0]![0]).toMatch(/Tear off/);
	});

	it('ends the drag when the plugin times it out', async () => {
		const { client, finish, hooks } = setup(ghostDesktop);
		await settle();
		client.emit.timeout();
		expect(finish).toHaveBeenCalledTimes(1);
		expect(hooks.say.mock.calls.at(-1)![0]).toMatch(/cancelled/);
	});
});

describe('on Wayland, with the compositor’s window drag', () => {
	const wayland = { toplevelDrag: true };

	it('opens the panel’s window hidden and has the compositor drag it, then finishes the page’s drag', async () => {
		const { client, hooks, finish } = setup(wayland);
		await settle();
		expect(hooks.openHidden).toHaveBeenCalledTimes(1);
		expect(client.toplevel).toHaveLength(1);
		expect(client.toplevel[0]).toMatchObject({
			label: 'panel-layers-1',
			payload: { kind: 'panel', panel: 'layers', title: 'Layers' },
			grabOffset: { x: 30, y: 12 },
		});
		// No ghost: the window itself moves.
		expect(client.begun).toEqual([]);
		expect(finish).toHaveBeenCalledTimes(1);
	});

	it('puts the panel back when the compositor cancels the drag', async () => {
		const { client, hooks } = setup(wayland);
		await settle();
		client.emit.toplevelEnded({
			seq: 1,
			window: 'panel-layers-1',
			source: 'main-1',
			outcome: 'cancelled',
			target: null,
			region: null,
			payload: null,
			reason: null,
		});
		expect(hooks.discard).toHaveBeenCalledTimes(1);
		expect(hooks.say.mock.calls.at(-1)![0]).toMatch(/stays where it was/);
	});

	it('keeps the window where it was dropped outside every window', async () => {
		const { client, hooks } = setup(wayland);
		await settle();
		client.emit.toplevelEnded({
			seq: 1,
			window: 'panel-layers-1',
			source: 'main-1',
			outcome: 'dropped-elsewhere',
			target: null,
			region: null,
			payload: null,
			reason: null,
		});
		expect(hooks.discard).not.toHaveBeenCalled();
		expect(hooks.say.mock.calls.at(-1)![0]).toMatch(/window of its own/);
	});

	it('leaves a drop on a window to the window that took it', async () => {
		const { client, hooks } = setup(wayland);
		await settle();
		client.emit.toplevelEnded({
			seq: 1,
			window: 'panel-layers-1',
			source: 'main-1',
			outcome: 'dropped-on-window',
			target: 'main-1',
			region: 'group:left:0',
			payload: null,
			reason: null,
		});
		expect(hooks.discard).not.toHaveBeenCalled();
	});

	it('closes the window and says why when the compositor will not start the drag', async () => {
		const client = createFakeTearoff(wayland);
		client.toplevelResult = { state: 'unavailable', reason: 'no protocol' };
		const hooks = {
			tearOff: vi.fn(),
			openHidden: async () => 'panel-layers-1',
			discard: vi.fn(),
			say: vi.fn(),
		};
		const finish = vi.fn();
		startTearDrag({
			client,
			features: client.features_,
			info: {
				id: 'layers',
				point: { x: -1, y: 1 },
				source: 'tab',
				start: { x: 5, y: 5 },
				grab: { x: 5, y: 5 },
				finish,
			},
			title: 'Layers',
			windowSize: { width: 260, height: 240 },
			remembered: null,
			hooks,
		});
		await settle();
		expect(hooks.discard).toHaveBeenCalledTimes(1);
		expect(finish).toHaveBeenCalledTimes(1);
		expect(hooks.say.mock.calls[0]![0]).toMatch(/Tear off/);
	});

	it('says why when the window could not be opened', async () => {
		const { hooks, finish, client } = setup(wayland, null);
		await settle();
		expect(client.toplevel).toEqual([]);
		expect(finish).toHaveBeenCalledTimes(1);
		expect(hooks.discard).not.toHaveBeenCalled();
		expect(hooks.say.mock.calls[0]![0]).toMatch(/Tear off/);
	});

	it('closes the window again when the drag ends while it is still opening', async () => {
		const { exit, hooks, client } = setup(wayland);
		exit!.cancel();
		await settle();
		expect(hooks.discard).toHaveBeenCalledTimes(1);
		expect(client.toplevel).toEqual([]);
	});
});
