// Tests for the panel bridge: envelopes, addressing and the in-memory hub tests use
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { createBridgeHub } from './fakePanelBridge';
import { EVERY_PANEL, addressedTo, isEnvelope, type BridgeEnvelope } from './panelBridge';

const envelope = (to: string, from = 'main-1'): BridgeEnvelope => ({
	from,
	to,
	topic: 'hello',
	payload: null,
});

describe('envelopes', () => {
	it('recognises the shape and nothing else', () => {
		expect(isEnvelope(envelope('main-1'))).toBe(true);
		for (const bad of [
			null,
			3,
			'x',
			{},
			{ from: 'a', to: 'b' },
			{ from: 1, to: 'b', topic: 'x' },
		]) {
			expect(isEnvelope(bad)).toBe(false);
		}
	});

	it('addresses a window by label and every panel window by the broadcast address', () => {
		expect(addressedTo(envelope('panel-script-1'), 'panel-script-1', true)).toBe(true);
		expect(addressedTo(envelope('panel-script-1'), 'panel-objects-1', true)).toBe(false);
		expect(addressedTo(envelope(EVERY_PANEL), 'panel-objects-1', true)).toBe(true);
		expect(addressedTo(envelope(EVERY_PANEL), 'main-1', false)).toBe(false);
		expect(addressedTo(envelope('main-1', 'main-1'), 'main-1', false)).toBe(false);
	});
});

describe('the in-memory hub', () => {
	it('delivers by topic to the addressed windows only, and stops after unsubscribe', () => {
		const hub = createBridgeHub();
		const main = hub.bridgeFor('main-1');
		const script = hub.bridgeFor('panel-script-1');
		const objects = hub.bridgeFor('panel-objects-1');
		const heardScript = vi.fn();
		const heardObjects = vi.fn();
		const stop = script.on('script/show', heardScript);
		objects.on('script/show', heardObjects);
		main.send('panel-script-1', 'script/show', { line: 4 });
		expect(heardScript).toHaveBeenCalledWith({ line: 4 }, 'main-1');
		expect(heardObjects).not.toHaveBeenCalled();
		main.send(EVERY_PANEL, 'script/show', { line: 5 });
		expect(heardObjects).toHaveBeenCalledWith({ line: 5 }, 'main-1');
		stop();
		main.send('panel-script-1', 'script/show', { line: 6 });
		expect(heardScript).toHaveBeenCalledTimes(2);
		expect(hub.sent).toHaveLength(3);
	});
});
