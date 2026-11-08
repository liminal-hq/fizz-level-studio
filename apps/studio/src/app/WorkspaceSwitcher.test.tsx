// Tests for the workspace switcher and the command search button
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { CommandSearchButton, WorkspaceSwitcher } from './WorkspaceSwitcher';

function setup() {
	const bridge = createCommandBridge();
	const handlers = {
		'workspace.paint': vi.fn(),
		'workspace.script': vi.fn(),
		'workspace.review': vi.fn(),
		'view.commandPalette': vi.fn(),
	};
	bridge.setHandlers(handlers);
	bridge.setFacts({
		editorOpen: true,
		hasLevel: true,
		workspace: { active: 'Paint', names: ['Paint', 'Review', 'Script'] },
	});
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<WorkspaceSwitcher />
			<CommandSearchButton />
		</CommandBridgeContext.Provider>,
	);
	return { bridge, handlers };
}

describe('WorkspaceSwitcher', () => {
	it('is a named group of Paint, Script and Review, with the active one pressed', () => {
		setup();
		const group = screen.getByRole('group', { name: 'Workspace' });
		expect(
			within(group)
				.getAllByRole('button')
				.map((b) => b.textContent),
		).toEqual(['Paint', 'Script', 'Review']);
		expect(within(group).getByRole('button', { name: 'Paint' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(within(group).getByRole('button', { name: 'Script' })).toHaveAttribute(
			'aria-pressed',
			'false',
		);
	});

	it('runs the workspace command of a choice, and follows the active workspace', async () => {
		const user = userEvent.setup();
		const { bridge, handlers } = setup();
		await user.click(screen.getByRole('button', { name: 'Review' }));
		expect(handlers['workspace.review']).toHaveBeenCalledOnce();
		act(() =>
			bridge.setFacts({ workspace: { active: 'Review', names: ['Paint', 'Review', 'Script'] } }),
		);
		expect(screen.getByRole('button', { name: 'Review' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'false');
	});

	it('leaves out a workspace the settings do not have, and draws nothing with no editor', () => {
		const { bridge } = setup();
		act(() => bridge.setFacts({ workspace: { active: 'Paint', names: ['Paint'] } }));
		const group = screen.getByRole('group', { name: 'Workspace' });
		expect(within(group).getAllByRole('button')).toHaveLength(1);
		act(() => bridge.setFacts({ editorOpen: false }));
		expect(screen.queryByRole('group', { name: 'Workspace' })).toBeNull();
	});
});

describe('CommandSearchButton', () => {
	it('shows the keys, and opens the command palette through its command', async () => {
		const user = userEvent.setup();
		const { handlers } = setup();
		const button = screen.getByRole('button', { name: /Search commands/ });
		expect(button).toHaveTextContent('Ctrl+Shift+P');
		expect(button).not.toHaveAttribute('title');
		act(() => button.focus());
		expect(screen.getByRole('tooltip')).toHaveTextContent('Search commandsCtrlShiftP');
		expect(button).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
		await user.click(button);
		expect(handlers['view.commandPalette']).toHaveBeenCalledOnce();
	});
});
