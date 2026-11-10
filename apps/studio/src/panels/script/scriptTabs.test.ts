// Tests for the script tab model: the tabs of a level and the keys that move between them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { LEVEL_TAB, fileNameOf, scriptTabsFor, tabAfterKey, type ScriptTab } from './scriptTabs';

const tab = (id: string): ScriptTab => ({
	id,
	title: id,
	kind: id === LEVEL_TAB ? 'level' : 'behaviour',
	dirty: false,
	away: false,
});

describe('scriptTabsFor', () => {
	it('is one tab, the level script, named after its file', () => {
		expect(scriptTabsFor({ path: '/levels/Crater Fields.fizz', dirty: true, away: false })).toEqual(
			[{ id: 'level', title: 'Crater Fields.fizz', kind: 'level', dirty: true, away: false }],
		);
	});

	it('reads a Windows path too, and marks a script in its own window', () => {
		const [only] = scriptTabsFor({ path: 'C:\\levels\\crater.fizz', dirty: false, away: true });
		expect(only).toMatchObject({ title: 'crater.fizz', away: true });
		expect(fileNameOf('crater.fizz')).toBe('crater.fizz');
	});
});

describe('tabAfterKey', () => {
	const tabs = [tab('level'), tab('gloop'), tab('spit')];

	it('steps with the arrows and wraps at the ends', () => {
		expect(tabAfterKey(tabs, 'level', 'ArrowRight')).toBe('gloop');
		expect(tabAfterKey(tabs, 'spit', 'ArrowRight')).toBe('level');
		expect(tabAfterKey(tabs, 'level', 'ArrowLeft')).toBe('spit');
	});

	it('goes to the first and last with Home and End, and ignores other keys', () => {
		expect(tabAfterKey(tabs, 'gloop', 'Home')).toBe('level');
		expect(tabAfterKey(tabs, 'gloop', 'End')).toBe('spit');
		expect(tabAfterKey(tabs, 'gloop', 'a')).toBeNull();
		expect(tabAfterKey([], 'level', 'Home')).toBeNull();
	});

	it('stays on the only tab', () => {
		expect(tabAfterKey([tab('level')], 'level', 'ArrowRight')).toBe('level');
	});
});
