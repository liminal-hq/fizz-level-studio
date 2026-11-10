// Tests for the classic toolbar: its buttons run commands through the registry and follow the facts
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
	CommandBridgeContext,
	createCommandBridge,
	perPanel,
	type CommandBridge,
} from '../commands/commandBridge';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { AppToolbar } from './AppToolbar';

function setup(prepare?: (bridge: CommandBridge) => void, end?: React.ReactNode) {
	const bridge = createCommandBridge();
	const handlers = {
		'file.new': vi.fn(),
		'file.save': vi.fn(),
		'edit.undo': vi.fn(),
		'view.panel.script': vi.fn(),
		'panel.palette.show': vi.fn(),
	};
	bridge.setHandlers(handlers);
	bridge.setFacts({
		hasLevel: true,
		editorOpen: true,
		brush: { group: 'tile', kind: 'grass' },
		panels: { ...perPanel(false), script: true },
	});
	prepare?.(bridge);
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<AppToolbar end={end} />
		</CommandBridgeContext.Provider>,
	);
	return { bridge, handlers, row: screen.getByRole('toolbar', { name: 'Commands' }) };
}

describe('AppToolbar', () => {
	it('is a named toolbar with the file buttons first', () => {
		const { row } = setup();
		const buttons = within(row).getAllByRole('button');
		expect(buttons[0]).toHaveAccessibleName('New level…');
		expect(within(row).getByRole('button', { name: 'Close level' })).toBeInTheDocument();
	});

	it('runs a button’s command through the handler the screen published', async () => {
		const user = userEvent.setup();
		const { row, handlers } = setup();
		await user.click(within(row).getByRole('button', { name: 'Save' }));
		expect(handlers['file.save']).toHaveBeenCalledOnce();
		await user.click(within(row).getByRole('button', { name: 'New level…' }));
		expect(handlers['file.new']).toHaveBeenCalledOnce();
	});

	it('dims Undo until there is a step to take back, and follows the facts', () => {
		const { bridge, row } = setup();
		expect(within(row).getByRole('button', { name: 'Undo' })).toBeDisabled();
		act(() => bridge.setFacts({ canUndo: true }));
		expect(within(row).getByRole('button', { name: 'Undo' })).toBeEnabled();
	});

	it('shows the brush chip, with the spacing for an item, and opens the Palette from it', async () => {
		const user = userEvent.setup();
		const { bridge, row, handlers } = setup();
		const chip = within(row).getByRole('button', { name: /Brush: grass/ });
		await user.click(chip);
		expect(handlers['panel.palette.show']).toHaveBeenCalledOnce();
		act(() => bridge.setFacts({ brush: { group: 'item', kind: 'soda' }, spacing: 3 }));
		expect(
			within(row).getByRole('button', { name: /Brush: soda, Every 3 cells/ }),
		).toBeInTheDocument();
	});

	it('has no brush chip before an editor publishes a brush', () => {
		const { row } = setup((bridge) => bridge.setFacts({ brush: null }));
		expect(within(row).queryByRole('button', { name: /Brush:/ })).toBeNull();
	});

	it('has a toggle for each panel at the end, pressed while it shows, running the panel command', async () => {
		const user = userEvent.setup();
		const { row, handlers } = setup();
		const group = within(row).getByRole('group', { name: 'Panels' });
		expect(within(group).getByRole('button', { name: 'Script' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(within(group).getByRole('button', { name: 'History' })).toHaveAttribute(
			'aria-pressed',
			'false',
		);
		await user.click(within(group).getByRole('button', { name: 'Script' }));
		expect(handlers['view.panel.script']).toHaveBeenCalledOnce();
	});

	it('draws what it is given at its far end after the panel toggles', () => {
		const { row } = setup(undefined, <span data-testid="far" />);
		const toggles = within(row).getByRole('group', { name: 'Panels' });
		const far = screen.getByTestId('far');
		expect(toggles.compareDocumentPosition(far) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('draws no panel toggles while no editor is open', () => {
		const { row } = setup((bridge) => bridge.setFacts({ editorOpen: false }));
		expect(within(row).queryByRole('group', { name: 'Panels' })).toBeNull();
	});

	it('tells each button’s label and keys from the registry in an in-app tooltip, with no native title', () => {
		const { row } = setup();
		const buttons = within(row).getAllByRole('button');
		for (const b of buttons) expect(b).not.toHaveAttribute('title');
		const save = within(row).getByRole('button', { name: 'Save' });
		act(() => save.focus());
		expect(screen.getByRole('tooltip')).toHaveTextContent('SaveCtrlS');
		const undo = within(row).getByRole('button', { name: 'Undo' });
		fireEvent.pointerLeave(save);
		fireEvent.pointerEnter(undo, { pointerType: 'mouse' });
		expect(screen.getAllByRole('tooltip')).toHaveLength(1);
		expect(screen.getByRole('tooltip').textContent).toMatch(/^Undo/);
	});

	it('tells why a disabled button cannot be used', () => {
		const { row } = setup((bridge) => bridge.setFacts({ hasLevel: false, editorOpen: false }));
		const save = within(row).getByRole('button', { name: 'Save' });
		expect(save).toBeDisabled();
		vi.useFakeTimers();
		fireEvent.pointerEnter(save, { pointerType: 'mouse' });
		act(() => void vi.advanceTimersByTime(600));
		vi.useRealTimers();
		expect(screen.getByRole('tooltip').textContent).toMatch(/^Save/);
		expect(screen.getByRole('tooltip').textContent!.length).toBeGreaterThan('SaveCtrlS'.length);
	});
});
