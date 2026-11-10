// The running-app checks for the chrome context menus
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Called from run.ts with the shared `check`, once a level is open. In the debug app the webview's own
// menu is not blocked by the plugin, so a `defaultPrevented` `contextmenu` proves the studio's host did it.
// Shift+right-click is the exception: a debug build leaves it to the native menu, so it must NOT be
// prevented. Every event here is synthetic (a real right-click needs a compositor), which is the same
// path the page's own listeners see.

import { type Bridge, sleep, within } from './driver';

export type Check = (name: string, ok: boolean, detail?: string) => void;

interface Opened {
	/** The event came back prevented (the studio's host blocked the native menu). */
	prevented: boolean;
	/** The accessible name of the one open menu, or null when none opened. */
	name: string | null;
	/** How many menus are open. */
	count: number;
	/** The labels of the rows, in order. */
	rows: string[];
}

const ROWS_OF_MENU = `
	const menus = [...document.querySelectorAll('[role=menu]')].filter((m) => !m.parentElement.closest('[role=menu]'));
	const menu = menus[0] ?? null;
	const labelOf = (row) => (row.querySelector('[class*="label"]')?.textContent ?? row.textContent ?? '').trim();
	const rows = menu ? [...menu.querySelectorAll(':scope > [role^="menuitem"], :scope > * > [role^="menuitem"]')].map(labelOf) : [];
	const state = { name: menu ? menu.getAttribute('aria-label') : null, count: menus.length, rows };`;

/** Dispatches a `contextmenu` on the first match of `selector` (at its centre) and reports what opened. */
async function rightClick(
	bridge: Bridge,
	selector: string,
	options: { shift?: boolean; windowId?: string; settle?: number } = {},
): Promise<Opened> {
	const windowId = options.windowId ?? 'main-1';
	const prevented = await bridge.js<boolean | null>(
		`const el = document.querySelector(${JSON.stringify(selector)});
		 if (!el) return null;
		 const r = el.getBoundingClientRect();
		 const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, buttons: 2, shiftKey: ${options.shift === true}, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
		 return !el.dispatchEvent(e);`,
		windowId,
	);
	// The menu opens on the bridge's next update or a frame later; give it a moment either way.
	await sleep(options.settle ?? 350);
	const state = await bridge.js<Omit<Opened, 'prevented'>>(
		`${ROWS_OF_MENU} return state;`,
		windowId,
	);
	return { prevented: prevented === true, ...state };
}

/** Closes any open menu with Escape and waits for it to go. */
async function closeMenus(bridge: Bridge, windowId = 'main-1'): Promise<boolean> {
	await bridge.js<boolean>(
		`const m = document.querySelector('[role=menu]');
		 if (m) m.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		 return true;`,
		windowId,
	);
	return (
		(await within(2000, async () =>
			bridge.js<boolean>(`return document.querySelector('[role=menu]') === null;`, windowId),
		)) !== null
	);
}

/** Chooses the row named `name` of the open menu with a click. */
function chooseRow(bridge: Bridge, name: string, windowId = 'main-1'): Promise<boolean> {
	return bridge.js<boolean>(
		`const row = [...document.querySelectorAll('[role=menu] [role^="menuitem"]')].find((r) => (r.querySelector('[class*="label"]')?.textContent ?? '').trim() === ${JSON.stringify(name)});
		 if (!row) return false;
		 row.click();
		 return true;`,
		windowId,
	);
}

const has = (rows: string[], ...names: string[]) => names.every((name) => rows.includes(name));

/** The title in the header of the first dock group. */
async function firstHeaderTitle(bridge: Bridge, zone: string): Promise<string | null> {
	const found = await bridge.js<{ v: string | null }>(
		`return { v: document.querySelector('[data-slot=${JSON.stringify(zone)}] [data-strip] h2')?.textContent ?? null };`,
	);
	return found.v;
}

export async function contextMenuChromeChecks(bridge: Bridge, check: Check): Promise<void> {
	await closeMenus(bridge);

	// The native menu is blocked everywhere the studio has no menu of its own.
	const blocked: [string, string][] = [
		['a dock resize handle', '[role=separator]'],
		['the level canvas edge area', '[data-level]'],
		['the page body', 'body'],
	];
	for (const [what, selector] of blocked) {
		const hit = await rightClick(bridge, selector, { settle: 200 });
		check(
			`context menu: right-clicking ${what} is blocked and opens nothing`,
			hit.prevented && hit.count === 0,
			JSON.stringify(hit),
		);
		await closeMenus(bridge);
	}

	// Rust decides whether Shift+right-click may reach the native menu: a debug build, which this is.
	const allowed = await bridge.invoke<boolean>('app_native_menu_allowed');
	check(
		'context menu: Rust allows the native menu behind Shift in this debug build',
		allowed === true,
	);
	const shifted = await rightClick(bridge, '[data-rail-item]', { shift: true, settle: 200 });
	check(
		'context menu: Shift+right-click is left to the native menu and opens none of the studio’s',
		!shifted.prevented && shifted.count === 0,
		JSON.stringify(shifted),
	);
	const shiftedField = await rightClick(bridge, 'input[type=search]', { shift: true, settle: 200 });
	check(
		'context menu: Shift+right-click on a text field is left to the native menu too',
		!shiftedField.prevented && shiftedField.count === 0,
		JSON.stringify(shiftedField),
	);

	// Nothing opens while a stroke, a pan or a drag is going.
	await bridge.js<boolean>(
		`document.documentElement.setAttribute('data-context-busy', ''); return true;`,
	);
	const busy = await rightClick(bridge, '[data-rail-item]', { settle: 250 });
	await bridge.js<boolean>(
		`document.documentElement.removeAttribute('data-context-busy'); return true;`,
	);
	check(
		'context menu: nothing opens while data-context-busy is set',
		busy.prevented && busy.count === 0,
		JSON.stringify(busy),
	);

	// A panel's header.
	const zone = (await firstHeaderTitle(bridge, 'right')) !== null ? 'right' : 'left';
	const title = await firstHeaderTitle(bridge, zone);
	const header = await rightClick(bridge, `[data-slot=${JSON.stringify(zone)}] [data-strip]`);
	check(
		'context menu: a panel header opens that panel’s menu',
		header.prevented && header.count === 1 && header.name === `${title} menu`,
		JSON.stringify(header),
	);
	check(
		'context menu: the panel menu is the dock rows, Tear off, Reset layout and Hide',
		has(
			header.rows,
			'Dock left',
			'Dock right',
			'Dock bottom',
			'Float',
			'Tear off',
			'Reset layout',
		) && header.rows.includes(`Hide ${title}`),
		JSON.stringify(header.rows),
	);
	const titled = (
		await bridge.js<{ v: string | null }>(
			`return { v: [...document.querySelectorAll('[role=menu] [role^="menuitem"][aria-disabled=true]')].map((r) => r.getAttribute('title')).find((t) => t) ?? null };`,
		)
	).v;
	check(
		'context menu: a disabled row says why in its title',
		titled === 'Already here',
		String(titled),
	);
	check('context menu: Escape closes the menu', await closeMenus(bridge));

	// The same menu from a rail entry, then a press outside closes it.
	const rail = await rightClick(bridge, '[data-rail-item="layers"]');
	check(
		'context menu: a rail entry opens its panel’s menu',
		rail.prevented && rail.name === 'Layers menu' && rail.rows.includes('Hide Layers'),
		JSON.stringify(rail),
	);
	await bridge.js<boolean>(
		`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 })); return true;`,
	);
	check(
		'context menu: a press outside closes the menu',
		(await within(2000, async () =>
			bridge.js<boolean>(`return document.querySelector('[role=menu]') === null;`),
		)) !== null,
	);

	// The menu is above the tooltips and never scrolls the shell.
	await rightClick(bridge, '[data-rail-item="layers"]');
	const layering = await bridge.js<{ top: boolean; scrolled: boolean }>(
		`const menu = document.querySelector('[role=menu]');
		 const r = menu.getBoundingClientRect();
		 const hit = document.elementFromPoint(r.left + 6, r.top + 6);
		 const root = document.scrollingElement;
		 return { top: !!hit && menu.contains(hit), scrolled: root.scrollTop !== 0 || root.scrollLeft !== 0 || root.scrollHeight > window.innerHeight + 1 };`,
	);
	check('context menu: the menu is the top layer (above the tooltips)', layering.top);
	check('context menu: opening the menu does not make the shell scroll', !layering.scrolled);
	await closeMenus(bridge);

	// From the keyboard: Shift+F10 on a rail entry, focus in the menu, and the `contextmenu` event
	// WebView2 fires right after the key (here, in the same turn) only prevented.
	const keyed = await bridge.js<{
		opened: boolean;
		focusInMenu: boolean;
		prevented: boolean;
		count: number;
	}>(
		`const entry = document.querySelector('[data-rail-item="layers"]');
		 entry.focus();
		 entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
		 const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 0, shiftKey: true, clientX: 5, clientY: 5 });
		 const prevented = !entry.dispatchEvent(e);
		 await new Promise((r) => setTimeout(r, 400));
		 const menus = document.querySelectorAll('[role=menu]');
		 const menu = menus[0];
		 return { opened: !!menu, focusInMenu: !!menu && menu.contains(document.activeElement), prevented, count: menus.length };`,
	);
	check(
		'context menu: Shift+F10 on a rail entry opens its menu with the focus in it',
		keyed.opened && keyed.focusInMenu,
		JSON.stringify(keyed),
	);
	check(
		'context menu: the contextmenu event after a keyboard open is only prevented (one menu)',
		keyed.prevented && keyed.count === 1,
		JSON.stringify(keyed),
	);
	await closeMenus(bridge);
	const refocused = await bridge.js<boolean>(
		`return document.activeElement === document.querySelector('[data-rail-item="layers"]');`,
	);
	check('context menu: Escape returns the focus to the rail entry', refocused);

	await scriptTabChecks(bridge, check);
	await commandsRowChecks(bridge, check);
	await textFieldChecks(bridge, check);
	await scriptEditorChecks(bridge, check);
	await tornOffChecks(bridge, check);
}

async function scriptTabChecks(bridge: Bridge, check: Check): Promise<void> {
	const tab = await rightClick(bridge, '[role=tab][data-script-tab]');
	if (tab.name === null && tab.count === 0) {
		check('context menu: the script tab opens its own menu', false, 'no Script tab on screen');
		return;
	}
	check(
		'context menu: the script tab opens its own menu, not the header’s',
		tab.prevented && tab.count === 1 && tab.name === 'Script tab menu',
		JSON.stringify(tab),
	);
	check(
		'context menu: the script tab menu shows or closes the tab and tears the panel off',
		has(tab.rows, 'Show the level script tab', 'Close the level script tab') &&
			(tab.rows.includes('Tear off') || tab.rows.includes('Dock back')),
		JSON.stringify(tab.rows),
	);
	await closeMenus(bridge);
}

async function commandsRowChecks(bridge: Bridge, check: Check): Promise<void> {
	const row = await rightClick(bridge, '[data-app-toolbar], [data-app-ribbon], [role=menubar]');
	check(
		'context menu: the commands row opens the toolbar choice',
		row.prevented && row.name === 'Commands menu' && has(row.rows, 'Menu bar'),
		JSON.stringify(row),
	);
	check(
		'context menu: the commands menu has Toolbar and Ribbon',
		has(row.rows, 'Toolbar', 'Ribbon'),
		JSON.stringify(row.rows),
	);
	await closeMenus(bridge);

	const workspace = await rightClick(bridge, '[role=group][aria-label=Workspace] button');
	check(
		'context menu: the workspace switcher lists the workspaces and Reset layout',
		workspace.prevented &&
			workspace.name === 'Workspace menu' &&
			has(workspace.rows, 'Paint', 'Script', 'Review', 'Reset layout') &&
			workspace.count === 1,
		JSON.stringify(workspace),
	);
	await closeMenus(bridge);

	const zoom = await rightClick(bridge, '[data-zoom-control]');
	check(
		'context menu: the zoom pill lists zoom in, out and fit',
		zoom.prevented &&
			zoom.name === 'Zoom menu' &&
			has(zoom.rows, 'Zoom in', 'Zoom out', 'Fit level'),
		JSON.stringify(zoom),
	);
	await closeMenus(bridge);

	// History is a panel of its own; show it from its rail entry first.
	const shown = await bridge.js<boolean>(
		`const e = document.querySelector('[data-rail-item="history"]');
		 if (!e) return false;
		 if (e.getAttribute('aria-pressed') !== 'true') e.click();
		 await new Promise((r) => setTimeout(r, 300));
		 return true;`,
	);
	if (shown) {
		const history = await rightClick(bridge, '[data-panel-id="history"] button');
		check(
			'context menu: History opens the Undo history menu',
			history.prevented && history.name === 'History menu' && history.rows.length > 0,
			JSON.stringify(history),
		);
		await closeMenus(bridge);
	} else {
		check('context menu: History opens the Undo history menu', false, 'no History panel');
	}
}

/** Selects the field's text so Copy has something, copies it from the menu, clears the field, and pastes it back from the menu. */
async function textFieldChecks(bridge: Bridge, check: Check): Promise<void> {
	await bridge.js<boolean>(
		`const e = document.querySelector('[data-rail-item="objects"]');
		 if (e && e.getAttribute('aria-pressed') !== 'true') e.click();
		 await new Promise((r) => setTimeout(r, 300));
		 return true;`,
	);
	const field = 'input[type=search][aria-label="Filter things"]';
	const empty = await rightClick(bridge, field);
	check(
		'context menu: a text field opens the text menu',
		empty.prevented &&
			empty.name === 'Text menu' &&
			has(empty.rows, 'Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select all'),
		JSON.stringify(empty),
	);
	const dimmed = await bridge.js<string[]>(
		`return [...document.querySelectorAll('[role=menu] [role^="menuitem"][aria-disabled=true]')].map((r) => r.querySelector('[class*="label"]')?.textContent.trim());`,
	);
	check(
		'context menu: in an empty field Cut, Copy and Select all are dimmed',
		has(dimmed, 'Cut', 'Copy', 'Select all'),
		JSON.stringify(dimmed),
	);
	await closeMenus(bridge);

	// Type, select all, Copy from the menu.
	await bridge.js<boolean>(
		`const i = document.querySelector(${JSON.stringify(field)});
		 i.focus();
		 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'soda');
		 i.dispatchEvent(new Event('input', { bubbles: true }));
		 i.select();
		 return true;`,
	);
	const selected = await rightClick(bridge, field);
	check(
		'context menu: with text selected, Copy and Cut are on offer',
		selected.name === 'Text menu' &&
			(await bridge.js<boolean>(
				`return ![...document.querySelectorAll('[role=menu] [role^="menuitem"][aria-disabled=true]')].some((r) => /^(Cut|Copy)/.test(r.textContent.trim()));`,
			)),
	);
	check('context menu: Copy runs from the text menu', await chooseRow(bridge, 'Copy'));
	await sleep(300);
	const stillFocused = await bridge.js<boolean>(
		`return document.activeElement === document.querySelector(${JSON.stringify(field)});`,
	);
	check('context menu: the field has its focus back after a text menu choice', stillFocused);

	// Clear it, then Paste from the menu (read through the clipboard plugin, inserted with insertText).
	await bridge.js<boolean>(
		`const i = document.querySelector(${JSON.stringify(field)});
		 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '');
		 i.dispatchEvent(new Event('input', { bubbles: true }));
		 return true;`,
	);
	await rightClick(bridge, field);
	check('context menu: Paste runs from the text menu', await chooseRow(bridge, 'Paste'));
	const pasted = await within(3000, async () =>
		bridge.js<boolean>(`return document.querySelector(${JSON.stringify(field)}).value === 'soda';`),
	);
	// The platform clipboard under a virtual display can refuse a read; a miss is reported, not hidden.
	check(
		'context menu: Paste puts the clipboard’s text in the field',
		pasted !== null,
		(
			await bridge.js<{ v: string }>(
				`return { v: document.querySelector(${JSON.stringify(field)}).value };`,
			)
		).v,
	);
	await bridge.js<boolean>(
		`const i = document.querySelector(${JSON.stringify(field)});
		 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '');
		 i.dispatchEvent(new Event('input', { bubbles: true }));
		 return true;`,
	);
}

async function scriptEditorChecks(bridge: Bridge, check: Check): Promise<void> {
	// Show the Script panel's editor if it is folded away.
	await bridge.js<boolean>(
		`if (!document.querySelector('.cm-editor')) {
		   const e = document.querySelector('[data-rail-item="script"]');
		   if (e) e.click();
		   await new Promise((r) => setTimeout(r, 500));
		 }
		 return true;`,
	);
	const text = await rightClick(bridge, '.cm-editor .cm-content');
	check(
		'context menu: the script editor opens the script menu',
		text.prevented &&
			text.name === 'Script menu' &&
			has(text.rows, 'Copy', 'Select all', 'Find', 'Fold all', 'Unfold all'),
		JSON.stringify(text),
	);
	await closeMenus(bridge);
	const gutter = await rightClick(bridge, '.cm-editor .cm-lineNumbers');
	check(
		'context menu: the line numbers open the same menu',
		gutter.name === 'Script menu' && gutter.rows.length === text.rows.length,
		JSON.stringify(gutter),
	);
	await closeMenus(bridge);

	// Select all from the menu selects the whole script.
	await rightClick(bridge, '.cm-editor .cm-content');
	check(
		'context menu: Select all runs from the script menu',
		await chooseRow(bridge, 'Select all'),
	);
	await sleep(300);
	const covered = await bridge.js<boolean>(
		`const sel = window.getSelection(); return !!sel && !sel.isCollapsed && sel.toString().length > 20;`,
	);
	check('context menu: Select all selects the script’s text', covered);
	const withSelection = await rightClick(bridge, '.cm-editor .cm-content');
	const copyDimmed = await bridge.js<boolean>(
		`const row = [...document.querySelectorAll('[role=menu] [role^="menuitem"]')].find((r) => r.textContent.trim().startsWith('Copy')); return row?.getAttribute('aria-disabled') === 'true';`,
	);
	check(
		'context menu: Copy is on offer once the script has a selection',
		withSelection.name === 'Script menu' && !copyDimmed,
		String(copyDimmed),
	);
	await closeMenus(bridge);
	// Collapse the editor's own selection with a key, as a person would.
	await bridge.js<boolean>(
		`const c = document.querySelector('.cm-editor .cm-content');
		 c.focus();
		 c.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
		 await new Promise((r) => setTimeout(r, 200));
		 return true;`,
	);
	const bare = await rightClick(bridge, '.cm-editor .cm-content');
	const copyNow = (
		await bridge.js<{ v: string | null }>(
			`const row = [...document.querySelectorAll('[role=menu] [role^="menuitem"]')].find((r) => r.textContent.trim().startsWith('Copy')); return { v: row?.getAttribute('title') ?? null };`,
		)
	).v;
	check(
		'context menu: Copy is dimmed, with its reason, while nothing is selected',
		bare.name === 'Script menu' && copyNow === 'Select some of the script first.',
		String(copyNow),
	);
	await closeMenus(bridge);
}

/** Tears the Script panel off from its own menu, checks the window's menus, and docks it back from them. */
async function tornOffChecks(bridge: Bridge, check: Check): Promise<void> {
	const label = 'panel-script-1';
	const opened = await rightClick(bridge, '[role=tab][data-script-tab]');
	if (!has(opened.rows, 'Tear off')) {
		check(
			'context menu: the Script panel tears off from its tab menu',
			false,
			JSON.stringify(opened.rows),
		);
		await closeMenus(bridge);
		return;
	}
	await chooseRow(bridge, 'Tear off');
	const up = await within(15_000, async () => (await bridge.windows()).includes(label));
	check('context menu: the Script panel tears off from its tab menu', up !== null);
	if (up === null) return;
	await bridge.ready(label);
	await within(15_000, async () =>
		bridge.js<boolean>(`return !!document.querySelector('.cm-editor');`, label).catch(() => false),
	);

	const editor = await rightClick(bridge, '.cm-editor .cm-content', { windowId: label });
	check(
		'context menu: a torn-off Script window has the script menu',
		editor.prevented &&
			editor.name === 'Script menu' &&
			has(editor.rows, 'Copy', 'Select all', 'Find'),
		JSON.stringify(editor),
	);
	await closeMenus(bridge, label);

	const blocked = await rightClick(bridge, 'body', { windowId: label, settle: 200 });
	check(
		'context menu: the torn-off window blocks the native menu elsewhere',
		blocked.prevented && blocked.count === 0,
		JSON.stringify(blocked),
	);

	const tab = await rightClick(bridge, '[role=tab][data-script-tab]', { windowId: label });
	check(
		'context menu: a torn-off script tab offers Close and Dock back, and nothing it cannot do',
		tab.name === 'Script tab menu' &&
			JSON.stringify(tab.rows) === JSON.stringify(['Close the level script tab', 'Dock back']),
		JSON.stringify(tab),
	);
	// The window closes under the call, so its answer may never come: a lost answer is the click.
	const dockedBack = await chooseRow(bridge, 'Dock back', label).catch(() => true);
	const gone = await within(15_000, async () => !(await bridge.windows()).includes(label));
	check(
		'context menu: Dock back in the torn-off window’s menu docks the panel',
		dockedBack && gone !== null,
	);
	// The bridge's session can end with the closed window's page; start it again.
	await bridge.stop();
	await bridge.start();
	await bridge.ready();
}
