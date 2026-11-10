// The running-app checks for the level's context menus: the canvas, the Objects list and the Layers panel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Called from run.ts with the shared `check`, once a level is open. In the debug app the webview's own
// menu is not blocked by the plugin, so a `defaultPrevented` `contextmenu` proves the studio's host did it.
// The cursor is walked to each cell with the arrow keys and the pointer path is aimed from where the
// keyboard-opened menu appears (it opens at the cursor cell's bottom edge), so no pixel arithmetic is
// needed. Every change the checks make (a lock, a hidden layer, a tool) is put back at the end.

import { sleep, within, type Bridge } from './driver';

export type Check = (name: string, ok: boolean, detail?: string) => void;

const CANVAS = 'canvas[role=application]';

interface Row {
	label: string;
	disabled: boolean;
	title: string | null;
	danger: boolean;
}

interface MenuState {
	/** The menu's accessible name. */
	name: string | null;
	/** The header row's text, or null. */
	header: string | null;
	rows: Row[];
	/** The row labels with a rule shown as "-". */
	order: string[];
	left: number;
	top: number;
	/** How many menus are open at the top level. */
	count: number;
	/** The element that has focus is inside the menu. */
	focusInside: boolean;
}

interface Cell {
	x: number;
	y: number;
}

interface LevelShape {
	revision: number;
	width: number;
	height: number;
	palette: string[];
	cells: number[];
	items: { kind: string; x: number; y: number }[];
	spawns: { kind: string; x: number; y: number | null }[];
	start: { x: number; y: number } | null;
	sections: { id: string; lines: number[][] }[];
}

export async function contextMenuLevelChecks(bridge: Bridge, check: Check): Promise<void> {
	const level = () =>
		bridge.js<LevelShape>(
			`const s = await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-worlds|level_snapshot', { id: 'level-1' });
			 const v = s.view;
			 return { revision: Number(s.revision), width: v.width, height: v.height, palette: v.palette, cells: v.cells,
			   items: v.items.map((i) => ({ kind: i.kind, x: i.x, y: i.y })),
			   spawns: v.spawns.map((e) => ({ kind: e.kind, x: e.x, y: e.y })),
			   start: v.start ? { x: v.start.x, y: v.start.y } : null,
			   sections: v.sections.map((x) => ({ id: x.id, lines: x.lines })) };`,
		);
	const cursor = () =>
		bridge.js<Cell | null>(
			`const s = [...document.querySelectorAll('[role=status]')].map((e) => e.textContent.trim()).find((t) => /^Cell \\d+, \\d+:/.test(t));
			 const m = s && s.match(/^Cell (\\d+), (\\d+):/);
			 return m ? { x: Number(m[1]), y: Number(m[2]) } : null;`,
		);
	const inspected = () =>
		bridge.js<string | null>(
			`return JSON.stringify(document.querySelector(${JSON.stringify(CANVAS)})?.getAttribute('data-inspected') ?? null);`,
		);
	const key = (selector: string, k: string, shift = false) =>
		bridge.js<boolean>(
			`const e = document.querySelector(${JSON.stringify(selector)});
			 if (!e) return false;
			 e.focus();
			 e.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, shiftKey: ${shift}, bubbles: true, cancelable: true }));
			 return true;`,
		);
	const showFromRail = (name: string) =>
		bridge.js<boolean>(
			`const t = [...document.querySelectorAll('[data-rail-item]')].find((x) => x.textContent.trim() === ${JSON.stringify(name)});
			 if (!t) return false;
			 if (t.getAttribute('aria-pressed') !== 'true') t.click();
			 return true;`,
		);
	const menu = () =>
		bridge.js<MenuState | null>(
			`const all = [...document.querySelectorAll('[role=menu]')].filter((m) => !m.parentElement?.closest('[role=menu]'));
			 const m = all[0];
			 if (!m) return null;
			 const rows = [...m.querySelectorAll(':scope > [role=menuitem], :scope > [role=menuitemcheckbox]')].map((r) => ({
				 label: r.children[1]?.textContent ?? '',
				 disabled: r.getAttribute('aria-disabled') === 'true',
				 title: r.getAttribute('title'),
				 danger: r.getAttribute('data-danger') === 'true',
			 }));
			 const order = [...m.children].flatMap((c) => {
				 if (c.getAttribute('role') === 'separator') return ['-'];
				 if (c.getAttribute('role') === 'presentation') return ['#' + c.textContent];
				 return c.children[1] ? [c.children[1].textContent] : [];
			 });
			 const r = m.getBoundingClientRect();
			 return { name: m.getAttribute('aria-label'), header: m.querySelector(':scope > [role=presentation]')?.textContent ?? null,
			   rows, order, left: r.left, top: r.top, count: all.length, focusInside: m.contains(document.activeElement) };`,
		);
	const menuOpen = async () => {
		await within(2000, async () => (await menu()) !== null);
		return menu();
	};
	const menuGone = async () => (await within(2000, async () => (await menu()) === null)) !== null;
	const close = async () => {
		if ((await menu()) === null) return;
		await bridge.js<boolean>(
			`const m = document.querySelector('[role=menu]');
			 (m?.querySelector('[role=menuitem]') ?? m)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
			 return true;`,
		);
		await menuGone();
	};
	/** Fires a `contextmenu` at a point on an element, as a right-click does, and says whether it was prevented. */
	const rightClick = (selector: string, x: number, y: number, shift = false) =>
		bridge.js<boolean>(
			`const e = document.querySelector(${JSON.stringify(selector)});
			 if (!e) return false;
			 const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: ${x}, clientY: ${y}, shiftKey: ${shift} });
			 e.dispatchEvent(ev);
			 return ev.defaultPrevented;`,
		);
	const walkTo = async (target: Cell) => {
		// With a thing selected the arrows move the thing, so deselect first: Escape on the canvas does.
		await key(CANVAS, 'Escape');
		const from = await cursor();
		if (!from) return false;
		const keys = [
			...Array(Math.abs(target.x - from.x)).fill(target.x > from.x ? 'ArrowRight' : 'ArrowLeft'),
			...Array(Math.abs(target.y - from.y)).fill(target.y > from.y ? 'ArrowUp' : 'ArrowDown'),
		] as string[];
		await bridge.js<boolean>(
			`const e = document.querySelector(${JSON.stringify(CANVAS)});
			 e.focus();
			 for (const k of ${JSON.stringify(keys)}) {
			   e.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
			   await new Promise((r) => setTimeout(r, 0));
			 }
			 return true;`,
		);
		return (
			(await within(3000, async () => {
				const at = await cursor();
				return at !== null && at.x === target.x && at.y === target.y;
			})) !== null
		);
	};
	const cellSize = async () =>
		bridge.js<number>(
			`const t = [...document.querySelectorAll('[role=group][aria-label="Canvas zoom"] *')].map((e) => e.textContent.trim()).find((x) => /^Zoom [\\d.]+×$/.test(x));
			 const m = t && t.match(/[\\d.]+/);
			 return m ? Number(m[0]) * 4 : 16;`,
		);
	/**
	 * Where on screen a cell is. The cursor is walked to the cell so the camera shows it, then a probe
	 * right-click at the canvas's middle reports (through the cursor) which cell is there, and the cell's
	 * place follows from the cell size. The probe's own menu is closed.
	 */
	const pointInCell = async (cell: Cell) => {
		if (!(await walkTo(cell))) return null;
		const box = await bridge.js<{ x: number; y: number; w: number; h: number } | null>(
			`const r = document.querySelector(${JSON.stringify(CANVAS)})?.getBoundingClientRect();
			 return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;`,
		);
		if (!box) return null;
		const size = await cellSize();
		for (const [fx, fy] of [
			[0.5, 0.5],
			[0.4, 0.45],
			[0.6, 0.55],
			[0.5, 0.35],
		] as const) {
			const px = Math.round(box.x + box.w * fx);
			const py = Math.round(box.y + box.h * fy);
			const prevented = await rightClick(CANVAS, px, py);
			const opened = prevented ? await menuOpen() : null;
			const at = await cursor();
			await close();
			// The canvas only prevents a `contextmenu` that follows the key by a moment, and a stale menu would hide the next.
			await sleep(150);
			if (!opened || !at) continue;
			// The probe moved the cursor and selected a cell; put the cursor back on the cell for what follows.
			const found = {
				x: Math.round(px + (cell.x - at.x) * size),
				y: Math.round(py - (cell.y - at.y) * size),
			};
			// A probe lands somewhere inside its cell, so the same shift lands inside the wanted one unless it sat on an edge.
			for (const [dx, dy] of [
				[0, 0],
				[3, 3],
				[-3, -3],
			] as const) {
				const point = { x: found.x + dx, y: found.y + dy };
				const ok = await rightClick(CANVAS, point.x, point.y);
				const now = await cursor();
				await close();
				await sleep(150);
				if (ok && now && now.x === cell.x && now.y === cell.y) return point;
			}
		}
		return null;
	};
	/** A right-click on a cell by the pointer path; the menu is left open and the cursor on that cell. */
	const rightClickCell = async (cell: Cell) => {
		const point = await pointInCell(cell);
		if (!point) return { point: null, prevented: false };
		const prevented = await rightClick(CANVAS, point.x, point.y);
		return { point, prevented };
	};
	const labelsOf = (state: MenuState | null) => state?.rows.map((row) => row.label) ?? [];
	const row = (state: MenuState | null, label: string | RegExp) =>
		state?.rows.find((r) => (typeof label === 'string' ? r.label === label : label.test(r.label)));
	const clickRow = (label: string) =>
		bridge.js<boolean>(
			`const r = [...document.querySelectorAll('[role=menu] [role=menuitem], [role=menu] [role=menuitemcheckbox]')].find((x) => x.children[1]?.textContent === ${JSON.stringify(label)});
			 if (!r) return false;
			 r.click();
			 return true;`,
		);
	const layerButtons = () =>
		bridge.js<{ name: string; hidden: string | null; locked: string | null }[]>(
			`const list = document.querySelector('ul[aria-label=Layers]');
			 if (!list) return [];
			 return [...list.querySelectorAll('li')].map((li) => {
				 const bs = [...li.querySelectorAll('button')];
				 const eye = bs.find((b) => (b.getAttribute('aria-label') || '').startsWith('Hide '));
				 const lock = bs.find((b) => (b.getAttribute('aria-label') || '').startsWith('Lock '));
				 return { name: li.querySelector('span')?.textContent ?? '', hidden: eye ? eye.getAttribute('aria-pressed') : null, locked: lock ? lock.getAttribute('aria-pressed') : null };
			 });`,
		);

	// Plan the cells from the level itself.
	const before = await level();
	const emptyIndex = before.palette.indexOf('empty');
	const taken = new Set([
		...before.items.map((i) => `${Math.floor(i.x)},${Math.floor(i.y)}`),
		...before.spawns.map((s) => `${Math.floor(s.x)},${Math.floor(s.y ?? -1)}`),
		...(before.start ? [`${Math.floor(before.start.x)},${Math.floor(before.start.y)}`] : []),
	]);
	let sky: Cell | null = null;
	let ground: Cell | null = null;
	for (let y = before.height - 4; y >= 1 && !sky; y -= 1) {
		for (let x = 8; x < before.width - 8 && !sky; x += 1) {
			if (before.cells[y * before.width + x] === emptyIndex && !taken.has(`${x},${y}`))
				sky = { x, y };
		}
	}
	for (let y = 0; y < before.height && !ground; y += 1) {
		for (let x = 8; x < before.width - 8 && !ground; x += 1) {
			const index = before.cells[y * before.width + x];
			if (index !== emptyIndex && !taken.has(`${x},${y}`)) ground = { x, y };
		}
	}
	const item = before.items[0] ?? null;
	const enemy = before.spawns.find((s) => s.y !== null) ?? before.spawns[0] ?? null;
	const itemCell = item ? { x: Math.floor(item.x), y: Math.floor(item.y) } : null;
	const enemyCell = enemy ? { x: Math.floor(enemy.x), y: Math.floor(enemy.y ?? 0) } : null;
	check(
		'context menus: the level has an empty cell, a tile, an item and an enemy to try',
		sky !== null && ground !== null && itemCell !== null && enemyCell !== null,
		JSON.stringify({ sky, ground, itemCell, enemyCell }),
	);
	if (!sky || !ground || !itemCell || !enemyCell) return;

	await showFromRail('Inspector');
	await key(CANVAS, 'b');

	// A right-click on an empty cell: one menu, the browser's own prevented, nothing painted.
	const empty = await rightClickCell(sky);
	const emptyMenu = await menuOpen();
	check(
		'context menus: a right-click on an empty cell opens one menu and prevents the browser’s own',
		empty.prevented && emptyMenu?.count === 1,
		JSON.stringify({ point: empty.point, prevented: empty.prevented, count: emptyMenu?.count }),
	);
	check(
		'context menus: the cell’s menu has a header with its tile and place',
		new RegExp(`^Empty · x ${sky.x}, y ${sky.y}`).test(emptyMenu?.header ?? ''),
		emptyMenu?.header ?? 'no header',
	);
	check(
		'context menus: the cell’s menu has Pick, Paint, Erase, Inspect, Show in script and Zoom to fit, in order',
		emptyMenu?.order.join('|').includes('Pick this tile|Paint ') === true &&
			labelsOf(emptyMenu).includes('Erase here') &&
			labelsOf(emptyMenu).join('|').includes('Show the Inspector|Show in script') &&
			labelsOf(emptyMenu).at(-1) === 'Fit level' &&
			labelsOf(emptyMenu).findIndex((l) => l === 'Erase here') <
				labelsOf(emptyMenu).findIndex((l) => l === 'Show the Inspector'),
		JSON.stringify(emptyMenu?.order),
	);
	check(
		'context menus: no rule at either end of a menu, none doubled, and a header leads',
		emptyMenu !== null &&
			emptyMenu.order[0]?.startsWith('#') === true &&
			emptyMenu.order.at(-1) !== '-' &&
			!emptyMenu.order.join('|').includes('-|-') &&
			emptyMenu.order[1] !== '-',
		JSON.stringify(emptyMenu?.order),
	);
	check(
		'context menus: the menu has a name for screen readers, and takes focus on a pointer open too',
		emptyMenu?.name === 'Cell menu',
		String(emptyMenu?.name),
	);
	check(
		'context menus: the right-click moved the cursor and selected the cell, and painted nothing',
		JSON.stringify(await cursor()) === JSON.stringify(sky) &&
			(await inspected()) === `${sky.x},${sky.y}` &&
			(await level()).revision === before.revision,
		`${JSON.stringify(await cursor())} ${await inspected()}`,
	);
	await close();
	check(
		'context menus: Escape closes the menu and focus goes back to the canvas',
		(await menu()) === null &&
			(await bridge.js<boolean>(
				`return document.activeElement === document.querySelector(${JSON.stringify(CANVAS)});`,
			)),
	);

	// A press outside closes it.
	const again = await rightClickCell(sky);
	await menuOpen();
	await bridge.js<boolean>(
		`const t = document.querySelector('[role=region]') ?? document.body;
		 for (const type of ['pointerdown', 'mousedown']) t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 3, clientY: 3 }));
		 return true;`,
	);
	check('context menus: a press outside closes the menu', again.prevented && (await menuGone()));
	await close();

	// The thing menus.
	const onItem = await rightClickCell(itemCell);
	const itemMenu = await menuOpen();
	check(
		'context menus: a right-click on an item selects it and opens its menu',
		onItem.prevented &&
			(await inspected()) === `${itemCell.x},${itemCell.y}` &&
			itemMenu?.header !== null &&
			/ · x \d+, y \d+ · line \d+$/.test(itemMenu?.header ?? ''),
		`${await inspected()} ${itemMenu?.header}`,
	);
	check(
		'context menus: an item’s menu has Inspect, Show in script, Flip (with its reason) and Delete as a danger row',
		labelsOf(itemMenu).join('|') === 'Show the Inspector|Show in script|Flip|Delete' &&
			row(itemMenu, 'Flip')?.disabled === true &&
			row(itemMenu, 'Flip')?.title === 'Only an enemy has a facing to turn.' &&
			row(itemMenu, 'Delete')?.danger === true,
		JSON.stringify(itemMenu?.rows),
	);
	await close();
	const onEnemy = await rightClickCell(enemyCell);
	const enemyMenu = await menuOpen();
	check(
		'context menus: an enemy’s menu has Flip enabled, and the enemy is selected',
		onEnemy.prevented &&
			row(enemyMenu, 'Flip')?.disabled === false &&
			row(enemyMenu, 'Delete')?.disabled === false &&
			(await inspected()) === `${enemyCell.x},${enemyCell.y}`,
		JSON.stringify(enemyMenu?.rows),
	);
	await close();
	const startCell = before.start
		? { x: Math.floor(before.start.x), y: Math.floor(before.start.y) }
		: null;
	if (startCell) {
		await rightClickCell(startCell);
		const startMenu = await menuOpen();
		check(
			'context menus: Delete on the start is dimmed with the reason a level needs a start',
			row(startMenu, 'Delete')?.disabled === true &&
				row(startMenu, 'Delete')?.title === 'A level needs a start.',
			JSON.stringify(startMenu?.rows),
		);
		await close();
	}

	// A right-click on the thing that is already selected keeps it; a tile menu on ground names its tile.
	await rightClickCell(ground);
	const groundMenu = await menuOpen();
	check(
		'context menus: a ground tile’s menu names the tile and offers to paint',
		/^[A-Z][a-z-]+ · x \d+, y \d+/.test(groundMenu?.header ?? '') &&
			labelsOf(groundMenu).some((l) => l.startsWith('Paint ')),
		groundMenu?.header ?? 'no header',
	);
	check(
		'context menus: a tile’s header gains its script line once Rust has answered',
		(await within(3000, async () => / · line \d+$/.test((await menu())?.header ?? ''))) !== null,
		(await menu())?.header ?? 'no header',
	);
	await close();

	// Disabled rows say why, and a lock changes the reasons.
	await showFromRail('Layers');
	const layersUp = await within(3000, async () => (await layerButtons()).length > 0);
	check('context menus: the Layers panel is up to try its menu', layersUp !== null);
	const treatsRow = `ul[aria-label=Layers] li:has(button[aria-label="Lock Treats"]) button:not([aria-label])`;
	const rowBox = (selector: string) =>
		bridge.js<{ x: number; y: number } | null>(
			`const b = document.querySelector(${JSON.stringify(selector)});
			 if (!b) return null;
			 const r = b.getBoundingClientRect();
			 return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };`,
		);
	const treatsBox = await rowBox(treatsRow);
	check('context menus: the Treats row is on screen', treatsBox !== null, treatsRow);
	if (treatsBox) {
		const opened = await rightClick(treatsRow, treatsBox.x, treatsBox.y);
		const layerMenu = await menuOpen();
		check(
			'context menus: a right-click on a Layers row opens that layer’s menu, in order, with icons',
			opened &&
				layerMenu?.name === 'Treats layer menu' &&
				layerMenu.order.join('|') ===
					'Hide Treats|Show only Treats|-|Lock Treats|-|Show its first line in the script|-|Show all|Unlock all',
			JSON.stringify(layerMenu?.order),
		);
		check(
			'context menus: Show all and Unlock all are dimmed with their reasons while nothing is hidden or locked',
			row(layerMenu, 'Show all')?.title === 'No layer is hidden' &&
				row(layerMenu, 'Unlock all')?.title === 'No layer is locked',
			JSON.stringify(layerMenu?.rows),
		);
		await clickRow('Lock Treats');
		const locked = await within(3000, async () =>
			(await layerButtons()).some((l) => l.name === 'Treats' && l.locked === 'true'),
		);
		check('context menus: Lock Treats from the row’s menu locks the layer', locked !== null);

		// With Treats locked, the item's Delete and Flip say so.
		await rightClickCell(itemCell);
		const lockedItem = await menuOpen();
		check(
			'context menus: with Treats locked an item’s Delete is dimmed with the lock reason',
			row(lockedItem, 'Delete')?.disabled === true &&
				row(lockedItem, 'Delete')?.title === 'Treats is locked. Unlock it in Layers to change it.',
			JSON.stringify(lockedItem?.rows),
		);
		await close();
		const stillTreats = await rowBox(treatsRow);
		if (stillTreats) await rightClick(treatsRow, stillTreats.x, stillTreats.y);
		const unlockMenu = await menuOpen();
		check(
			'context menus: a locked layer’s menu offers Unlock, and Unlock all is live',
			labelsOf(unlockMenu).includes('Unlock Treats') &&
				row(unlockMenu, 'Unlock all')?.disabled === false,
			JSON.stringify(unlockMenu?.order),
		);
		await clickRow('Unlock Treats');
		check(
			'context menus: Unlock Treats puts the lock back',
			(await within(3000, async () => (await layerButtons()).every((l) => l.locked !== 'true'))) !==
				null,
		);

		// Show only, then Show all, from the row's menu.
		const box = await rowBox(treatsRow);
		if (box) await rightClick(treatsRow, box.x, box.y);
		await menuOpen();
		await clickRow('Show only Treats');
		const only = await within(3000, async () => {
			const rows = await layerButtons();
			return (
				rows.length > 0 &&
				rows.every((l) => (l.name === 'Treats' ? l.hidden === 'false' : l.hidden === 'true'))
			);
		});
		check(
			'context menus: Show only Treats hides every other layer',
			only !== null,
			JSON.stringify(await layerButtons()),
		);
		const after = await rowBox(treatsRow);
		if (after) await rightClick(treatsRow, after.x, after.y);
		const onlyMenu = await menuOpen();
		check(
			'context menus: with it the only layer shown, Show only is dimmed with its reason',
			row(onlyMenu, 'Show only Treats')?.disabled === true &&
				row(onlyMenu, 'Show only Treats')?.title === 'This is the only layer shown.',
			JSON.stringify(onlyMenu?.rows),
		);
		await clickRow('Show all');
		check(
			'context menus: Show all from the menu shows every layer again',
			(await within(3000, async () =>
				(await layerButtons()).every((l) => l.hidden === 'false'),
			)) !== null,
		);
		await close();
	}

	// Locking the layer a cell sits in dims Paint here with the lock reason; Pick is never locked.
	const buttons = await layerButtons();
	check(
		'context menus: Terrain is a layer to lock',
		buttons.some((l) => l.name === 'Terrain'),
	);
	const terrainBox = await rowBox(
		`ul[aria-label=Layers] li:has(button[aria-label="Lock Terrain"]) button:not([aria-label])`,
	);
	if (terrainBox) {
		await rightClick(
			`ul[aria-label=Layers] li:has(button[aria-label="Lock Terrain"]) button:not([aria-label])`,
			terrainBox.x,
			terrainBox.y,
		);
		await menuOpen();
		await clickRow('Lock Terrain');
		await within(3000, async () =>
			(await layerButtons()).some((l) => l.name === 'Terrain' && l.locked === 'true'),
		);
		await rightClickCell(ground);
		const lockedGround = await menuOpen();
		const reason = 'Terrain is locked. Unlock it in Layers to change it.';
		check(
			'context menus: with Terrain locked, Paint here and Erase here are dimmed with the lock reason, and Pick is not',
			lockedGround !== null &&
				(row(lockedGround, /^Paint /)?.title === reason ||
					/^(Terrain|Edits)/.test(row(lockedGround, /^Paint /)?.title ?? '')) &&
				row(lockedGround, 'Pick this tile')?.disabled === false,
			JSON.stringify(lockedGround?.rows),
		);
		await close();
		await rightClick(
			`ul[aria-label=Layers] li:has(button[aria-label="Lock Terrain"]) button:not([aria-label])`,
			terrainBox.x,
			terrainBox.y,
		);
		await menuOpen();
		await clickRow('Unlock Terrain');
		await within(3000, async () => (await layerButtons()).every((l) => l.locked !== 'true'));
	}

	// The Objects list: its right-click selects the row's thing and offers Show on the canvas.
	await showFromRail('Objects');
	const objectButton = `[role=list][aria-label=Objects] button[aria-current], [role=list][aria-label=Objects] li button`;
	const listUp = await within(3000, async () => (await rowBox(objectButton)) !== null);
	check('context menus: the Objects list is up to try its menu', listUp !== null);
	const objectBox = await rowBox(`[role=list][aria-label=Objects] li:has(button) button`);
	if (objectBox) {
		await key(CANVAS, 'Escape');
		const raised = await rightClick(
			`[role=list][aria-label=Objects] li:has(button) button`,
			objectBox.x,
			objectBox.y,
		);
		const objectMenu = await menuOpen();
		check(
			'context menus: a right-click on an Objects row opens the thing’s menu with Show on the canvas',
			raised &&
				/ · x \d+, y \d+/.test(objectMenu?.header ?? '') &&
				labelsOf(objectMenu).includes('Show on the canvas') &&
				labelsOf(objectMenu).includes('Show the Inspector'),
			JSON.stringify(objectMenu?.order),
		);
		check(
			'context menus: the row’s thing is selected (the canvas outlines it), without the right-click moving the cursor',
			(await inspected()) !== null,
			String(await inspected()),
		);
		await clickRow('Show on the canvas');
		const shown = await inspected();
		check(
			'context menus: Show on the canvas moves the cursor to the thing',
			shown !== null &&
				(await within(3000, async () => {
					const at = await cursor();
					return at !== null && `${at.x},${at.y}` === shown;
				})) !== null,
			`${shown} ${JSON.stringify(await cursor())}`,
		);
		await close();
	}

	// The keyboard: the Menu key and Shift+F10 on the canvas open the cursor cell's menu, once.
	await showFromRail('Inspector');
	await walkTo(sky);
	await key(CANVAS, 'ContextMenu');
	const byMenuKey = await menuOpen();
	check(
		'context menus: the Menu key on the canvas opens the cursor cell’s menu, with focus in it',
		byMenuKey?.count === 1 &&
			byMenuKey.focusInside &&
			/^Empty · x \d+, y \d+/.test(byMenuKey.header ?? ''),
		JSON.stringify(byMenuKey?.header),
	);
	await sleep(400);
	check(
		'context menus: the browser’s own contextmenu after the key does not open it twice',
		(await menu())?.count === 1,
	);
	await close();
	await key(CANVAS, 'F10', true);
	const byShiftF10 = await menuOpen();
	check(
		'context menus: Shift+F10 on the canvas opens it too',
		byShiftF10?.count === 1 && byShiftF10.focusInside,
	);
	await close();

	// Select's rectangle is kept by a right-click inside it, and Stamp leads the menu.
	await key(CANVAS, 's');
	await walkTo(sky);
	await key(CANVAS, ' ');
	await rightClickCell(sky);
	const rectMenu = await menuOpen();
	check(
		'context menus: inside Select’s rectangle the menu leads with Stamp and the selection is left alone',
		labelsOf(rectMenu)[0] === 'Stamp' && !labelsOf(rectMenu).includes('Show the Inspector'),
		JSON.stringify(rectMenu?.order),
	);
	await close();
	await key(CANVAS, 'b');

	check(
		'context menus: nothing the checks did changed the level',
		(await level()).revision === before.revision,
		`${(await level()).revision} against ${before.revision}`,
	);
}
