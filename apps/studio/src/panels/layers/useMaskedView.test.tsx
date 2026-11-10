// Tests for the hook that asks Rust for the level without the hidden tile layers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { levelSnapshot } from '../../test/levelFixtures';
import { FakeLevelClient } from '../../worlds/fakeLevelClient';
import { useMaskedView } from './useMaskedView';

function setup(hidden: string[], revision = 1n) {
	const client = new FakeLevelClient(levelSnapshot());
	const view = renderHook(
		(props: { hidden: string[]; revision: bigint }) =>
			useMaskedView(client, 'level-1', props.revision, props.hidden),
		{ initialProps: { hidden, revision } },
	);
	return { client, ...view };
}

describe('useMaskedView', () => {
	it('asks for nothing while no tile layer is hidden', () => {
		const { result, client } = setup([]);
		expect(result.current).toBeNull();
		expect(client.masked).toEqual([]);
	});

	it('asks Rust for the level without the hidden layers and answers its view', async () => {
		const { result, client } = setup(['terrain']);
		await waitFor(() => expect(result.current).not.toBeNull());
		expect(client.masked).toEqual([{ id: 'level-1', hidden: ['terrain'] }]);
		expect(result.current!.cells.every((cell) => cell === 0)).toBe(true);
	});

	it('asks again when the level moves on or another layer is hidden, and lets go when none is', async () => {
		const { result, client, rerender } = setup(['terrain']);
		await waitFor(() => expect(client.masked).toHaveLength(1));
		rerender({ hidden: ['terrain'], revision: 2n });
		await waitFor(() => expect(client.masked).toHaveLength(2));
		rerender({ hidden: ['terrain', 'blocks'], revision: 2n });
		await waitFor(() => expect(client.masked.at(-1)!.hidden).toEqual(['terrain', 'blocks']));
		rerender({ hidden: [], revision: 2n });
		await waitFor(() => expect(result.current).toBeNull());
	});
});
