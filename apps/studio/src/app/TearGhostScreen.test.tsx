// Tests for the tear-off ghost's card
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
	getPayload: vi.fn(),
	onPayload: vi.fn(),
}));
vi.mock('@liminal-hq/plugin-window-tearoff', () => plugin);

import { TearGhostScreen } from './TearGhostScreen';

let send: (raw: unknown) => void = () => {};
const unlisten = vi.fn();

beforeEach(() => {
	unlisten.mockReset();
	plugin.getPayload.mockReset().mockResolvedValue(null);
	plugin.onPayload.mockReset().mockImplementation(async (handler: (raw: unknown) => void) => {
		send = handler;
		return unlisten;
	});
});

describe('the tear-off ghost', () => {
	it('draws nothing between drags', async () => {
		const { container } = render(<TearGhostScreen />);
		await waitFor(() => expect(plugin.onPayload).toHaveBeenCalled());
		expect(container).toBeEmptyDOMElement();
	});

	it('draws a card with the panel, its name and what a release does', async () => {
		render(<TearGhostScreen />);
		await waitFor(() => expect(plugin.onPayload).toHaveBeenCalled());
		act(() =>
			send({
				kind: 'panel',
				panel: 'layers',
				source: 'header',
				title: 'Layers',
				label: 'Release to tear off',
			}),
		);
		const card = screen.getByTestId('tear-ghost-card');
		expect(card).toHaveTextContent('Layers');
		expect(card).toHaveTextContent('Release to tear off');
		expect(card.querySelector('svg')).not.toBeNull();
	});

	it('follows the payload as the drag changes it, and clears when the drag ends', async () => {
		render(<TearGhostScreen />);
		await waitFor(() => expect(plugin.onPayload).toHaveBeenCalled());
		act(() =>
			send({ kind: 'panel', panel: 'script', title: 'Script', label: 'Drag onto the editor' }),
		);
		act(() =>
			send({ kind: 'panel', panel: 'script', title: 'Script', label: 'Release to dock here' }),
		);
		expect(screen.getByTestId('tear-ghost-card')).toHaveTextContent('Release to dock here');
		act(() => send(null));
		expect(screen.queryByTestId('tear-ghost-card')).toBeNull();
	});

	it('reads a drag that began before the page loaded', async () => {
		plugin.getPayload.mockResolvedValue({ kind: 'panel', panel: 'objects', title: 'Objects' });
		render(<TearGhostScreen />);
		expect(await screen.findByTestId('tear-ghost-card')).toHaveTextContent('Objects');
	});

	it('draws nothing for a payload that is not a panel drag', async () => {
		render(<TearGhostScreen />);
		await waitFor(() => expect(plugin.onPayload).toHaveBeenCalled());
		act(() => send({ title: 'something else' }));
		expect(screen.queryByTestId('tear-ghost-card')).toBeNull();
	});

	it('stops listening when it goes away', async () => {
		const { unmount } = render(<TearGhostScreen />);
		await waitFor(() => expect(plugin.onPayload).toHaveBeenCalled());
		await act(async () => {});
		unmount();
		expect(unlisten).toHaveBeenCalledTimes(1);
	});
});
