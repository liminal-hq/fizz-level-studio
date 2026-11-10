// Tests for the Script panel's tabs in the editor: in the header, dirty, closing, narrow and away
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';
import { choosePanelMenu, fakeDockClient, openDock } from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { fakePanelWindows } from '../test/panelWindowFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

async function mount(snapshot: LevelSnapshot = levelSnapshot()) {
	const client = new FakeLevelClient(snapshot);
	const windows = fakePanelWindows();
	const bridge = createCommandBridge();
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<EditorScreen
				snapshot={snapshot}
				client={client}
				docks={fakeDockClient(openDock())}
				panelWindows={windows.client}
			/>
		</CommandBridgeContext.Provider>,
	);
	await screen.findByRole('region', { name: 'Bottom dock' });
	return { bridge, windows };
}

describe('the Script panel’s tabs', () => {
	it('sit in the Script header, naming the level’s file, in place of the title text', async () => {
		await mount();
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		const tab = within(bottom).getByRole('tab', { name: 'test.fizz' });
		expect(tab).toHaveAttribute('aria-selected', 'true');
		expect(tab).toHaveAttribute('aria-controls', 'panel-body-script');
		expect(document.getElementById('panel-body-script')).not.toBeNull();
		// The heading is still there for a screen reader, and the panel keeps its menu.
		expect(within(bottom).getByRole('heading', { name: 'Script' })).toBeInTheDocument();
		expect(within(bottom).getByRole('button', { name: 'Script menu' })).toBeInTheDocument();
		// No other panel's header has tabs.
		expect(within(screen.getByRole('region', { name: 'Left dock' })).queryByRole('tab')).toBeNull();
	});

	it('turn the close button into a dot while the level has unsaved changes', async () => {
		await mount(levelSnapshot({ revision: 3n, saved_revision: 2n }));
		expect(
			screen.getByRole('button', { name: 'Close test.fizz, unsaved changes' }),
		).toBeInTheDocument();
	});

	it('close by hiding the Script panel, and never the level', async () => {
		const user = userEvent.setup();
		const { bridge } = await mount();
		await user.click(screen.getByRole('button', { name: 'Close test.fizz' }));
		await waitFor(() => expect(bridge.getSnapshot().facts.panels.script).toBe(false));
		expect(screen.queryByRole('tab', { name: 'test.fizz' })).toBeNull();
		expect(screen.getByRole('application')).toBeInTheDocument();
		// The command does the same, and the tab command brings it back.
		await waitFor(() =>
			expect(bridge.getSnapshot().handlers['script.tab.level.activate']).toBeDefined(),
		);
		expect(runCommand('script.tab.level.activate', bridge.getSnapshot())).toBe(true);
		expect(await screen.findByRole('tab', { name: 'test.fizz' })).toBeInTheDocument();
		await waitFor(() => expect(bridge.getSnapshot().facts.panels.script).toBe(true));
		expect(runCommand('script.tab.level.close', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(screen.queryByRole('tab', { name: 'test.fizz' })).toBeNull());
	});

	it('are narrow in a side dock, and wide in the bottom one', async () => {
		const user = userEvent.setup();
		await mount();
		const strip = () => screen.getByRole('tablist', { name: 'Scripts' }).parentElement!;
		expect(strip()).not.toHaveAttribute('data-narrow');
		await choosePanelMenu(
			user,
			screen.getByRole('region', { name: 'Bottom dock' }),
			'Script',
			'Dock right',
		);
		const right = await screen.findByRole('region', { name: 'Right dock' });
		await within(right).findByRole('tab', { name: 'test.fizz' });
		expect(strip()).toHaveAttribute('data-narrow');
	});

	it('mark the script as away when its panel is in a window of its own, and bring the window forward', async () => {
		const user = userEvent.setup();
		const { windows } = await mount();
		await choosePanelMenu(
			user,
			screen.getByRole('region', { name: 'Bottom dock' }),
			'Script',
			'Tear off',
		);
		await waitFor(() => expect(windows.client.tearOff).toHaveBeenCalledTimes(1));
		const tab = await screen.findByRole('tab', {
			name: 'test.fizz',
		});
		expect(tab).not.toHaveAttribute('title');
		act(() => tab.focus());
		expect(screen.getByRole('tooltip')).toHaveTextContent(
			'test.fizz, open in its own window; choose to bring it forward',
		);
		await user.click(tab);
		await waitFor(() => expect(windows.client.tearOff).toHaveBeenCalledTimes(2));
	});
});
