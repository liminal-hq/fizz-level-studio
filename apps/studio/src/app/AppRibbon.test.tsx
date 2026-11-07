// Tests for the ribbon: its tabs, the contextual Script tab, folding and running commands
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import {
	CommandBridgeContext,
	createCommandBridge,
	perPanel,
	type CommandBridge,
} from '../commands/commandBridge';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { allCommands } from '../commands/registry';
import { NO_FACTS } from '../commands/commandBridge';
import { AppRibbon } from './AppRibbon';

function setup(prepare?: (bridge: CommandBridge) => void, end?: React.ReactNode) {
	const bridge = createCommandBridge();
	const handlers: Record<string, Mock<(argument?: string) => void>> = Object.fromEntries(
		allCommands(NO_FACTS).map((def) => [def.id, vi.fn<(argument?: string) => void>()]),
	);
	bridge.setHandlers(handlers);
	bridge.setFacts({
		hasLevel: true,
		editorOpen: true,
		tool: 'paint',
		brush: { group: 'tile', kind: 'grass' },
		panels: perPanel(true),
		toolbar: 'ribbon',
	});
	prepare?.(bridge);
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<AppRibbon end={end} />
		</CommandBridgeContext.Provider>,
	);
	return { bridge, handlers };
}

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

describe('AppRibbon', () => {
	it('is a named ribbon with Home, Level and View tabs, Home chosen, and a File button', () => {
		setup();
		expect(screen.getByRole('group', { name: 'Ribbon' })).toBeInTheDocument();
		expect(tabNames()).toEqual(['Home', 'Level', 'View']);
		expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('button', { name: 'File' })).toHaveAttribute('aria-haspopup', 'menu');
		expect(screen.queryByRole('radiogroup')).toBeNull();
	});

	it('runs a button’s command through the handler the screen published', async () => {
		const user = userEvent.setup();
		const { handlers } = setup();
		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(handlers['file.save']).toHaveBeenCalledOnce();
		await user.click(screen.getByRole('button', { name: 'Erase' }));
		expect(handlers['tool.erase']).toHaveBeenCalledOnce();
	});

	it('lights the tool in use, and names the brush', () => {
		setup();
		expect(screen.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByRole('button', { name: 'Brush: grass' })).toBeInTheDocument();
	});

	it('shows the View tab’s panel toggles and workspaces, running their commands', async () => {
		const user = userEvent.setup();
		const { handlers } = setup((bridge) =>
			bridge.setFacts({
				workspace: { active: 'Paint', names: ['Paint', 'Review', 'Script'] },
				zoom: { level: 4, canIn: true, canOut: true },
			}),
		);
		await user.click(screen.getByRole('tab', { name: 'View' }));
		await user.click(screen.getByRole('button', { name: 'History' }));
		expect(handlers['view.panel.history']).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'true');
		await user.click(screen.getByRole('button', { name: 'Review' }));
		expect(handlers['workspace.review']).toHaveBeenCalledOnce();
		await user.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(handlers['view.zoomIn']).toHaveBeenCalledOnce();
	});

	it('adds the Script tab while the Script panel is in use, without taking the focus from Home', () => {
		const { bridge } = setup();
		expect(tabNames()).not.toContain('Script');
		act(() => bridge.setFacts({ focusedPanel: 'script' }));
		expect(tabNames()).toEqual(['Home', 'Level', 'View', 'Script']);
		expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
		act(() => bridge.setFacts({ focusedPanel: 'history' }));
		expect(tabNames()).not.toContain('Script');
	});

	it('has the fold button, named for what it does, running the fold command', async () => {
		const user = userEvent.setup();
		const { handlers } = setup();
		await user.click(screen.getByRole('button', { name: 'Fold the ribbon to its tabs' }));
		expect(handlers['view.ribbon.fold']).toHaveBeenCalledOnce();
	});

	it('draws only its tabs while folded, and opens a tab’s panel over the level on a click', async () => {
		const user = userEvent.setup();
		setup((bridge) => bridge.setFacts({ ribbonFolded: true }));
		expect(screen.getByRole('button', { name: 'Open the ribbon' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.queryByRole('toolbar', { name: 'Ribbon controls' })).toBeNull();
		await user.click(screen.getByRole('tab', { name: 'Home' }));
		expect(screen.getByRole('toolbar', { name: 'Ribbon controls' })).toBeInTheDocument();
	});

	it('draws what it is given before the fold button', () => {
		setup(undefined, <span data-testid="switcher" />);
		const fold = screen.getByRole('button', { name: 'Fold the ribbon to its tabs' });
		expect(
			screen.getByTestId('switcher').compareDocumentPosition(fold) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it('runs a File menu choice through its command', async () => {
		const user = userEvent.setup();
		const { handlers } = setup();
		await user.click(screen.getByRole('button', { name: 'File' }));
		const menu = await screen.findByRole('menu');
		await user.click(within(menu).getByRole('menuitem', { name: /Preferences/ }));
		// Preferences runs its own action, not a published handler; Quit's does too, so use Save.
		await user.click(screen.getByRole('button', { name: 'File' }));
		await user.click(
			within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Save' }),
		);
		expect(handlers['file.save']).toHaveBeenCalledOnce();
	});
});
