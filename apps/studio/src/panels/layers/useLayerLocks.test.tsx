// Tests for the hook that follows the locked layers of the open level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { levelSnapshot } from '../../test/levelFixtures';
import { FakeLevelClient } from '../../worlds/fakeLevelClient';
import { useLayerLocks } from './useLayerLocks';

function setup(locked: string[] = []) {
	const client = new FakeLevelClient(levelSnapshot());
	client.locked = locked;
	const view = renderHook(() => useLayerLocks(client, 'level-1'));
	return { client, ...view };
}

describe('useLayerLocks', () => {
	it('reads the locks Rust holds when the level opens', async () => {
		const { result } = setup(['treats']);
		await waitFor(() => expect(result.current.locked).toEqual(['treats']));
	});

	it('locks and unlocks through Rust, and unlocks everything at once', async () => {
		const { result, client } = setup();
		await act(async () => result.current.toggle('treats'));
		await waitFor(() => expect(result.current.locked).toEqual(['treats']));
		await act(async () => result.current.toggle('edits'));
		await waitFor(() => expect(result.current.locked).toEqual(['treats', 'edits']));
		await act(async () => result.current.toggle('treats'));
		await waitFor(() => expect(client.locked).toEqual(['edits']));
		await act(async () => result.current.unlockAll());
		await waitFor(() => expect(result.current.locked).toEqual([]));
	});

	it('follows a change another window made', async () => {
		const { result, client } = setup();
		await act(async () => {
			await client.setLayerLocked('level-1', 'enemies', true);
		});
		await waitFor(() => expect(result.current.locked).toEqual(['enemies']));
	});

	it('counts a failure and keeps the locks as they were', async () => {
		const { result, client } = setup(['treats']);
		await waitFor(() => expect(result.current.locked).toEqual(['treats']));
		client.setLayerLocked = async () => {
			throw { kind: 'io', message: 'no' };
		};
		await act(async () => result.current.toggle('edits'));
		await waitFor(() => expect(result.current.failures).toBe(1));
		expect(result.current.locked).toEqual(['treats']);
	});
});
