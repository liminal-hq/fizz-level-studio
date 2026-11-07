// Tests for the zoom in the editor: the floating control and the zoom commands share one path
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';
import { fakeDockClient, openDock } from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

async function mount() {
	const snapshot = levelSnapshot();
	const bridge = createCommandBridge();
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<EditorScreen
				snapshot={snapshot}
				client={new FakeLevelClient(snapshot)}
				docks={fakeDockClient(openDock())}
			/>
		</CommandBridgeContext.Provider>,
	);
	await screen.findByRole('group', { name: 'Canvas zoom' });
	await waitFor(() => expect(bridge.getSnapshot().facts.zoom).not.toBeNull());
	return { bridge, pill: screen.getByRole('group', { name: 'Canvas zoom' }) };
}

describe('the editor’s zoom', () => {
	it('publishes the zoom to the commands, which can then run', async () => {
		const { bridge } = await mount();
		expect(bridge.getSnapshot().facts.zoom).toEqual({ level: 4, canIn: true, canOut: true });
		for (const id of ['view.zoomIn', 'view.zoomOut', 'view.zoomFit']) {
			expect(bridge.getSnapshot().handlers[id], id).toBeDefined();
		}
	});

	it('zooms the canvas from the zoom commands and fits the level', async () => {
		const { bridge, pill } = await mount();
		runCommand('view.zoomIn', bridge.getSnapshot());
		await waitFor(() => expect(pill).toHaveTextContent('5×'));
		await waitFor(() => expect(bridge.getSnapshot().facts.zoom?.level).toBe(5));
		runCommand('view.zoomOut', bridge.getSnapshot());
		await waitFor(() => expect(pill).toHaveTextContent('4×'));
		runCommand('view.zoomFit', bridge.getSnapshot());
		await waitFor(() => expect(bridge.getSnapshot().facts.zoom?.level).not.toBe(4));
	});

	it('runs the same commands from the buttons of the floating control', async () => {
		const user = userEvent.setup();
		const { bridge, pill } = await mount();
		await user.click(within(pill).getByRole('button', { name: 'Zoom in' }));
		await waitFor(() => expect(pill).toHaveTextContent('5×'));
		await waitFor(() => expect(bridge.getSnapshot().facts.zoom?.level).toBe(5));
		await user.click(within(pill).getByRole('button', { name: 'Fit level' }));
		await waitFor(() => expect(bridge.getSnapshot().facts.zoom?.level).not.toBe(5));
	});
});
