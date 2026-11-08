// Tests for the context menu host: what opens, what is blocked, and how focus and the keyboard behave
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCommandBridge, type CommandBridge } from '../commands/commandBridge';
import type { ClipboardClient } from '../services/clipboardClient';
import type { NativeMenuClient } from '../services/nativeMenuClient';
import { CONTEXT_BUSY } from './contextBusy';
import { ContextMenuHost } from './ContextMenuHost';
import { useContextMenuTrigger } from './useContextMenu';

/** A surface that has a menu (the zoom pill's) and a plain one that has none. */
function Surface() {
	const trigger = useContextMenuTrigger<HTMLDivElement>(() => ({ kind: 'zoom' }));
	return (
		<div>
			<div data-testid="zoom" tabIndex={0} {...trigger}>
				zoom
			</div>
			<div data-testid="plain" tabIndex={0}>
				plain
			</div>
			<input aria-label="Name" defaultValue="hello" />
			<input aria-label="Locked" defaultValue="fixed" readOnly />
			<input aria-label="Tick" type="checkbox" />
			<div className="cm-editor">
				<div className="cm-content" data-testid="cm" tabIndex={0} />
			</div>
		</div>
	);
}

function zoomFacts(bridge: CommandBridge) {
	bridge.setFacts({
		editorOpen: true,
		hasLevel: true,
		zoom: { level: 2, canIn: true, canOut: true },
	});
	bridge.setHandlers({
		'view.zoomIn': vi.fn(),
		'view.zoomOut': vi.fn(),
		'view.zoomFit': vi.fn(),
	});
}

function setup(options: { native?: boolean; clipboard?: ClipboardClient } = {}) {
	const bridge = createCommandBridge();
	zoomFacts(bridge);
	const nativeMenu: NativeMenuClient = { allowed: async () => options.native === true };
	const clipboard: ClipboardClient = options.clipboard ?? { readText: async () => null };
	render(
		<ContextMenuHost bridge={bridge} nativeMenu={nativeMenu} clipboard={clipboard}>
			<Surface />
		</ContextMenuHost>,
	);
	return { bridge, clipboard };
}

/** Lets the host's first promise (Rust's answer) settle. */
const settle = () => act(async () => {});

describe('ContextMenuHost', () => {
	beforeEach(() => {
		Object.defineProperty(document, 'execCommand', {
			value: vi.fn(() => true),
			configurable: true,
		});
	});
	afterEach(() => {
		document.documentElement.removeAttribute(CONTEXT_BUSY);
		vi.useRealTimers();
	});

	it('blocks the native menu on a surface that has no menu, and opens nothing', async () => {
		setup();
		await settle();
		expect(fireEvent.contextMenu(screen.getByTestId('plain'))).toBe(false);
		expect(fireEvent.contextMenu(document.body)).toBe(false);
		expect(fireEvent.contextMenu(screen.getByLabelText('Tick'))).toBe(false);
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it("opens a surface's own menu, once, with the rows of its target", async () => {
		setup();
		await settle();
		expect(fireEvent.contextMenu(screen.getByTestId('zoom'), { clientX: 30, clientY: 40 })).toBe(
			false,
		);
		const menu = await screen.findByRole('menu', { name: 'Zoom menu' });
		expect(screen.getAllByRole('menu')).toHaveLength(1);
		expect(menu).toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: /Zoom in/ })).toBeInTheDocument();
	});

	it('runs a row as its command and closes', async () => {
		const { bridge } = setup();
		await settle();
		fireEvent.contextMenu(screen.getByTestId('zoom'));
		fireEvent.click(await screen.findByRole('menuitem', { name: /Zoom in/ }));
		expect(bridge.getSnapshot().handlers['view.zoomIn']).toHaveBeenCalledOnce();
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('returns the focus to the surface on Escape', async () => {
		setup();
		await settle();
		const zoom = screen.getByTestId('zoom');
		zoom.focus();
		fireEvent.contextMenu(zoom);
		await screen.findByRole('menu');
		fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(zoom);
	});

	it('gives a text field the text menu, with its rows dimmed by what the field allows', async () => {
		setup();
		await settle();
		const field = screen.getByLabelText('Name') as HTMLInputElement;
		field.focus();
		field.setSelectionRange(0, 0);
		expect(fireEvent.contextMenu(field)).toBe(false);
		await screen.findByRole('menu', { name: 'Text menu' });
		const row = (name: string) => screen.getByRole('menuitem', { name: new RegExp(`^${name}`) });
		expect(row('Cut')).toHaveAttribute('aria-disabled', 'true');
		expect(row('Copy')).toHaveAttribute('aria-disabled', 'true');
		expect(row('Paste')).not.toHaveAttribute('aria-disabled', 'true');
		expect(row('Select all')).not.toHaveAttribute('aria-disabled', 'true');
	});

	it('dims what a read-only field cannot do', async () => {
		setup();
		await settle();
		const field = screen.getByLabelText('Locked') as HTMLInputElement;
		field.focus();
		field.select();
		fireEvent.contextMenu(field);
		await screen.findByRole('menu');
		expect(screen.getByRole('menuitem', { name: /^Copy/ })).not.toHaveAttribute('aria-disabled');
		for (const name of ['Cut', 'Paste', 'Undo', 'Redo']) {
			expect(screen.getByRole('menuitem', { name: new RegExp(`^${name}`) })).toHaveAttribute(
				'aria-disabled',
				'true',
			);
		}
	});

	it('copies and selects through the webview, and gives the focus back to the field', async () => {
		setup();
		await settle();
		const field = screen.getByLabelText('Name') as HTMLInputElement;
		field.focus();
		field.setSelectionRange(0, 5);
		fireEvent.contextMenu(field);
		fireEvent.click(await screen.findByRole('menuitem', { name: /^Copy/ }));
		expect(document.execCommand).toHaveBeenCalledWith('copy');
		expect(document.activeElement).toBe(field);
	});

	it('pastes the clipboard text through insertText', async () => {
		const readText = vi.fn(async () => 'pasted');
		setup({ clipboard: { readText } });
		await settle();
		const field = screen.getByLabelText('Name') as HTMLInputElement;
		field.focus();
		fireEvent.contextMenu(field);
		fireEvent.click(await screen.findByRole('menuitem', { name: /^Paste/ }));
		await settle();
		expect(readText).toHaveBeenCalledOnce();
		expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'pasted');
	});

	it('pastes nothing when the clipboard has no text', async () => {
		setup();
		await settle();
		const field = screen.getByLabelText('Name') as HTMLInputElement;
		fireEvent.contextMenu(field);
		fireEvent.click(await screen.findByRole('menuitem', { name: /^Paste/ }));
		await settle();
		expect(document.execCommand).not.toHaveBeenCalledWith('insertText', false, expect.anything());
	});

	it('gives the script editor the script menu (its rows are dimmed until the panel publishes them)', async () => {
		const { bridge } = setup();
		bridge.setHandlers({ 'script.copy': vi.fn(), 'script.find': vi.fn() });
		await settle();
		expect(fireEvent.contextMenu(screen.getByTestId('cm'))).toBe(false);
		await screen.findByRole('menu', { name: 'Script menu' });
		expect(screen.getByRole('menuitem', { name: /^Copy/ })).toHaveAttribute(
			'aria-disabled',
			'true',
		);
		expect(screen.getByRole('menuitem', { name: /Find/ })).not.toHaveAttribute('aria-disabled');
	});

	it('lets Shift+right-click through to the native menu only when Rust allows it', async () => {
		setup({ native: true });
		await settle();
		expect(fireEvent.contextMenu(screen.getByTestId('zoom'), { shiftKey: true })).toBe(true);
		expect(fireEvent.contextMenu(screen.getByLabelText('Name'), { shiftKey: true })).toBe(true);
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('blocks Shift+right-click as it blocks every other right-click in a release build', async () => {
		setup({ native: false });
		await settle();
		expect(fireEvent.contextMenu(screen.getByTestId('zoom'), { shiftKey: true })).toBe(false);
		await screen.findByRole('menu');
	});

	it('opens nothing while a stroke, a pan or a drag is going', async () => {
		setup();
		await settle();
		document.documentElement.setAttribute(CONTEXT_BUSY, '');
		expect(fireEvent.contextMenu(screen.getByTestId('zoom'))).toBe(false);
		expect(fireEvent.contextMenu(screen.getByLabelText('Name'))).toBe(false);
		await settle();
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('opens at the focused surface from Shift+F10 and the Menu key, with the first row focused', async () => {
		setup();
		await settle();
		const zoom = screen.getByTestId('zoom');
		zoom.focus();
		fireEvent.keyDown(zoom, { key: 'F10', shiftKey: true });
		await screen.findByRole('menu');
		expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0]);
	});

	it('opens a text field from the keyboard', async () => {
		setup();
		await settle();
		const field = screen.getByLabelText('Name');
		field.focus();
		fireEvent.keyDown(field, { key: 'ContextMenu' });
		await screen.findByRole('menu', { name: 'Text menu' });
		expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0]);
	});

	it('only prevents the contextmenu event the browser fires after a keyboard open', async () => {
		setup();
		await settle();
		const zoom = screen.getByTestId('zoom');
		zoom.focus();
		fireEvent.keyDown(zoom, { key: 'F10', shiftKey: true });
		await screen.findByRole('menu');
		// WebView2 follows the key with a contextmenu event: it must not open a second menu or move this one.
		expect(fireEvent.contextMenu(zoom, { shiftKey: true })).toBe(false);
		await settle();
		expect(screen.getAllByRole('menu')).toHaveLength(1);
	});

	it('runs `view.contextMenu` for the focused field', async () => {
		const { bridge } = setup();
		await settle();
		const field = screen.getByLabelText('Name');
		field.focus();
		act(() => bridge.getSnapshot().handlers['view.contextMenu']!());
		await screen.findByRole('menu', { name: 'Text menu' });
	});

	it('does nothing for a target that has no rows', async () => {
		const { bridge } = setup();
		bridge.setFacts({ zoom: null });
		await settle();
		fireEvent.contextMenu(screen.getByTestId('zoom'));
		await settle();
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('closes the menu on a press outside it', async () => {
		setup();
		await settle();
		fireEvent.contextMenu(screen.getByTestId('zoom'));
		await screen.findByRole('menu');
		fireEvent.pointerDown(screen.getByTestId('plain'));
		expect(screen.queryByRole('menu')).toBeNull();
	});
});
