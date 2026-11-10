// Tests for the right-click menus of the commands row, the workspace switcher, the zoom pill and History
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createCommandBridge, perPanel, type CommandBridge } from '../commands/commandBridge';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { ZoomControl } from '../canvas/ZoomControl';
import { HistoryPanel } from '../panels/HistoryPanel';
import { AppMenuBar } from './AppMenuBar';
import { AppRibbon } from './AppRibbon';
import { AppToolbar } from './AppToolbar';
import { ContextMenuHost } from './ContextMenuHost';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

const IDS = [
	'view.toolbar.classic',
	'view.toolbar.ribbon',
	'view.toolbar.hidden',
	'view.menuBar',
	'view.ribbon.fold',
	'workspace.paint',
	'workspace.script',
	'workspace.review',
	'view.resetLayout',
	'view.zoomIn',
	'view.zoomOut',
	'view.zoomFit',
	'edit.undo',
	'edit.redo',
	'file.new',
	'view.commandPalette',
];

function setup(node: React.ReactNode, facts: Parameters<CommandBridge['setFacts']>[0] = {}) {
	const bridge = createCommandBridge();
	bridge.setHandlers(Object.fromEntries(IDS.map((id) => [id, vi.fn()])));
	bridge.setFacts({
		hasLevel: true,
		editorOpen: true,
		panels: perPanel(true),
		workspace: { active: 'Paint', names: ['Paint', 'Script', 'Review'] },
		zoom: { level: 4, canIn: true, canOut: true },
		toolbar: 'classic',
		...facts,
	});
	render(
		<ContextMenuHost bridge={bridge} nativeMenu={{ allowed: async () => false }}>
			{node}
		</ContextMenuHost>,
	);
	return bridge;
}

const rows = () => [...screen.getByRole('menu').querySelectorAll('[role^="menuitem"] .label')];
const labels = () => rows().map((row) => row.textContent);

describe('the commands row', () => {
	it('opens the toolbar choice from the toolbar, with the current one ticked', async () => {
		setup(<AppToolbar />);
		const toolbar = screen.getByRole('toolbar', { name: 'Commands' });
		expect(fireEvent.contextMenu(toolbar.parentElement!)).toBe(false);
		await screen.findByRole('menu', { name: 'Commands menu' });
		expect(labels()).toEqual(['Toolbar', 'Ribbon', 'Hide the toolbar and ribbon', 'Menu bar']);
		const classic = screen.getByRole('menuitemcheckbox', { name: /^Toolbar/ });
		expect(classic).toHaveAttribute('aria-checked', 'true');
	});

	it('runs a row: choosing Ribbon runs the command', async () => {
		const bridge = setup(<AppToolbar />);
		fireEvent.contextMenu(screen.getByRole('toolbar', { name: 'Commands' }).parentElement!);
		fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: /^Ribbon/ }));
		expect(bridge.getSnapshot().handlers['view.toolbar.ribbon']).toHaveBeenCalledOnce();
	});

	it('opens the same menu from the ribbon, with its fold row', async () => {
		setup(<AppRibbon />, { toolbar: 'ribbon' });
		fireEvent.contextMenu(document.querySelector('[data-app-ribbon]')!);
		await screen.findByRole('menu', { name: 'Commands menu' });
		expect(labels()).toContain('Fold the ribbon');
	});

	it('opens it from the row of menus, with or without something at its end', async () => {
		setup(<AppMenuBar end={<span>end</span>} />);
		const menubar = screen.getByRole('menubar');
		fireEvent.contextMenu(menubar);
		await screen.findByRole('menu', { name: 'Commands menu' });
	});

	it('opens it from a bare row of menus', async () => {
		setup(<AppMenuBar />);
		fireEvent.contextMenu(screen.getByRole('menubar'));
		await screen.findByRole('menu', { name: 'Commands menu' });
	});
});

describe('the workspace switcher', () => {
	it('lists the workspaces and Reset layout, not the commands row’s menu', async () => {
		setup(<AppToolbar end={<WorkspaceSwitcher />} />);
		fireEvent.contextMenu(
			within(screen.getByRole('group', { name: 'Workspace' })).getByRole('button', {
				name: 'Script',
			}),
		);
		await screen.findByRole('menu', { name: 'Workspace menu' });
		expect(labels()).toEqual(['Paint', 'Script', 'Review', 'Reset layout']);
		expect(screen.getAllByRole('menu')).toHaveLength(1);
	});
});

describe('the zoom pill', () => {
	it('lists zoom in, out and fit', async () => {
		const onZoom = vi.fn();
		const bridge = setup(<ZoomControl zoom={4} canIn canOut onZoom={onZoom} />);
		fireEvent.contextMenu(document.querySelector('[data-zoom-control]')!);
		await screen.findByRole('menu', { name: 'Zoom menu' });
		expect(labels()).toEqual(['Zoom in', 'Zoom out', 'Fit level']);
		fireEvent.click(rows()[2]!);
		expect(bridge.getSnapshot().handlers['view.zoomFit']).toHaveBeenCalledOnce();
	});

	it('is opened from the keyboard on its focused button', async () => {
		setup(<ZoomControl zoom={4} canIn canOut onZoom={() => {}} />);
		const button = screen.getByRole('button', { name: 'Zoom in' });
		button.focus();
		fireEvent.keyDown(button, { key: 'ContextMenu' });
		await screen.findByRole('menu', { name: 'Zoom menu' });
	});
});

describe('History', () => {
	it('lists the Undo history the application menu builds', async () => {
		setup(
			<HistoryPanel
				canUndo
				canRedo={false}
				undoName="Paint grass"
				redoName={null}
				onUndo={() => {}}
				onRedo={() => {}}
			/>,
			{ canUndo: true, undoName: 'Paint grass' },
		);
		fireEvent.contextMenu(screen.getByRole('button', { name: /Undo/ }));
		await screen.findByRole('menu', { name: 'History menu' });
		expect(labels()[0]).toBe('Paint grass');
	});

	it('has no menu in a window that cannot undo', async () => {
		const bridge = createCommandBridge();
		bridge.setFacts({ editorOpen: true, hasLevel: true });
		render(
			<ContextMenuHost bridge={bridge} nativeMenu={{ allowed: async () => false }}>
				<HistoryPanel
					canUndo
					canRedo={false}
					undoName={null}
					redoName={null}
					onUndo={() => {}}
					onRedo={() => {}}
				/>
			</ContextMenuHost>,
		);
		expect(fireEvent.contextMenu(screen.getByRole('button', { name: /Undo/ }))).toBe(false);
		await act(async () => {});
		await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
	});
});
