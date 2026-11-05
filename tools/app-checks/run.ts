// The running-app checks for M1: open, paint, undo, save, an outside edit, a crash and its recovery
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Build the debug app first (`bun run app:build`), then `bun run check:app`. The app runs against an
// isolated profile (its own config and data folders) and a copy of `levels/crater.fizz`, driven
// through the debug-only automation bridge by tauri-mcp-server. Each check prints one line; the exit
// code is 1 if any failed. On Linux a display is needed (`xvfb-run` in CI).

import {
	copyFileSync,
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { App, Bridge, binary, makeProfile, root, sleep, within } from './driver';

const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
	if (!ok) failures.push(name);
}

/** What the page can say about a level without sending its whole grid back. */
const SUMMARY = `
	const summary = (s) => ({
		revision: Number(s.revision), saved: Number(s.saved_revision), text: s.text,
		canUndo: s.can_undo, canRedo: s.can_redo, undoName: s.undo_name, author: s.author,
		editedOutside: s.edited_outside, cells: s.view.cells.length,
	});
`;

interface Summary {
	revision: number;
	saved: number;
	text: string;
	canUndo: boolean;
	canRedo: boolean;
	undoName: string | null;
	author: string;
	editedOutside: boolean;
	cells: number;
}

function openLevel(bridge: Bridge, path: string): Promise<Summary> {
	return bridge.js<Summary>(
		`${SUMMARY} return summary(await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-worlds|level_open', { path: ${JSON.stringify(path)} }));`,
	);
}

function levelCall(
	bridge: Bridge,
	command: string,
	args: Record<string, unknown>,
): Promise<Summary> {
	return bridge.js<Summary>(
		`${SUMMARY} return summary(await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-worlds|${command}', ${JSON.stringify(args)}));`,
	);
}

async function main(): Promise<void> {
	if (!existsSync(binary)) {
		console.error(`No debug build at ${binary}. Run \`bun run app:build\` first.`);
		process.exit(2);
	}
	const profile = makeProfile();
	const levels = join(profile.dir, 'levels');
	await Bun.$`mkdir -p ${levels}`;
	const original = readFileSync(join(root, 'levels/crater.fizz'), 'utf8');
	const path = join(levels, 'crater.fizz');
	copyFileSync(join(root, 'levels/crater.fizz'), path);

	const bridge = await Bridge.connect();
	let app: App | undefined;
	try {
		// 1. Launched with a level path: the main window opens it.
		app = new App(profile, [path]);
		await bridge.start();
		check('the main window is main-1 and its page runs', await bridge.ready());
		const shown = await within(10_000, async () => {
			try {
				return await bridge.js<boolean>(
					`return document.body.innerText.includes('Crater Fields');`,
				);
			} catch {
				return false;
			}
		});
		check('the level named on the command line opens', shown !== null);

		const opened = await openLevel(bridge, path);
		check('the open level has its 5,376 cells', opened.cells === 5376, String(opened.cells));
		check('a fresh level has nothing to undo', !opened.canUndo && opened.revision === 0);

		// 2. Paint, and the canvas and history show it.
		const painted = await levelCall(bridge, 'level_apply', {
			id: 'level-1',
			edit: { kind: 'paint', tile: 'block', x: [[10, 14]], y: [[12, 12]] },
			basedOn: 0,
			mergeKey: 'app-check',
		});
		check(
			'a paint appends under edits',
			painted.text.endsWith('edits\n  paint block x=10..14 y=12\n'),
		);
		check(
			'the paint is one named step',
			painted.undoName === 'Paint block' && painted.revision === 1,
		);
		const history = await within(2000, async () =>
			bridge.js<boolean>(`return document.body.innerText.includes('Undo Paint block');`),
		);
		check('the history panel offers the named undo', history !== null);

		// 3. Undo and redo are byte for byte.
		const undone = await levelCall(bridge, 'level_undo', {
			id: 'level-1',
			basedOn: painted.revision,
		});
		check('undo restores the original text byte for byte', undone.text === original);
		const redone = await levelCall(bridge, 'level_redo', {
			id: 'level-1',
			basedOn: undone.revision,
		});
		check('redo brings the paint back byte for byte', redone.text === painted.text);

		// 4. Save writes exactly the session's text, and only appends.
		const saved = await levelCall(bridge, 'level_save', { id: 'level-1' });
		const onDisk = readFileSync(path, 'utf8');
		check('save writes the session text', onDisk === redone.text && saved.saved === saved.revision);
		check('the saved file only appends to the original', onDisk.startsWith(original));
		check(
			'save leaves no stray files',
			readdirSync(levels).join(',') === 'crater.fizz',
			readdirSync(levels).join(','),
		);

		// 5. An outside edit is heard within a second.
		const wrote = performance.now();
		writeFileSync(path, `${onDisk}// edited outside the studio\n`);
		const heard = await within(3000, async () => {
			const s = await openLevel(bridge, path);
			return s.editedOutside && s.text.includes('edited outside the studio');
		});
		const took = heard === null ? null : performance.now() - wrote;
		check(
			'an outside edit is heard within a second',
			took !== null && took < 1000,
			took === null ? 'not heard' : `${Math.round(took)} ms`,
		);
		await levelCall(bridge, 'level_save', { id: 'level-1' });

		// 5b. The appearance and tear-off plugins answer, the theme follows the settings and the
		// system, and the Script panel tears off into panel-script-1 and docks back.
		for (const plugin of [
			'system-appearance',
			'window-manager',
			'window-effects',
			'window-tearoff',
		]) {
			const answered = await bridge
				.js<boolean>(
					`const s = await window.__TAURI_INTERNALS__.invoke('plugin:${plugin}|get_status'); return typeof s === 'object' && s !== null;`,
				)
				.catch(() => false);
			check(`the ${plugin} status command answers`, answered);
		}
		const themeIs = (want: string | null) =>
			within(3000, () =>
				bridge.js<boolean>(
					`return document.documentElement.dataset.flsTheme === ${JSON.stringify(want ?? undefined)};`,
				),
			);
		for (const mode of ['dark', 'light']) {
			await bridge.js(
				`const cur = await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-settings|settings_get'); await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-settings|settings_update', { patch: { colour_mode: '${mode}' }, basedOn: cur.revision });`,
			);
			check(`a ${mode} colour mode sets the theme`, (await themeIs(mode)) !== null);
		}
		await bridge.js(
			`const cur = await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-settings|settings_get'); await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-settings|settings_update', { patch: { colour_mode: 'system' }, basedOn: cur.revision });`,
		);
		const { scheme: system } = await bridge.js<{ scheme: string }>(
			`return { scheme: (await window.__TAURI_INTERNALS__.invoke('plugin:system-appearance|get_appearance')).colourScheme };`,
		);
		check(
			'the system colour mode follows the system scheme',
			(await themeIs(system === 'noPreference' ? null : system)) !== null,
			system,
		);

		const clickByText = (text: string, windowId = 'main-1') =>
			bridge.js<boolean>(
				`const b = [...document.querySelectorAll('button')].find((x) => x.textContent === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true;`,
				windowId,
			);
		check('the Script panel offers Tear off', await clickByText('Tear off'));
		const tornOff = await within(10_000, async () =>
			(await bridge.windows()).includes('panel-script-1'),
		);
		check('tearing off opens panel-script-1', tornOff !== null);
		const noticed = await within(3000, () =>
			bridge.js<boolean>(
				`return document.body.innerText.includes('The Script panel is open in its own window.');`,
			),
		);
		check('the main window shows the panel is away', noticed !== null);
		await bridge.ready('panel-script-1');
		const clicked = await within(10_000, () =>
			clickByText('Dock back', 'panel-script-1').catch(() => false),
		);
		check('the panel window offers Dock back', clicked !== null);
		const docked = await within(
			10_000,
			async () => !(await bridge.windows()).includes('panel-script-1'),
		);
		check('docking back closes panel-script-1', docked !== null);
		// The bridge's session can end with the closed window's page; start it again.
		await bridge.stop();
		await bridge.start();
		const back = await within(3000, () =>
			bridge.js<boolean>(
				`return [...document.querySelectorAll('button')].some((b) => b.textContent === 'Tear off');`,
			),
		);
		check('the Script panel is back in the main window', back !== null);

		// 6. A crash with unsaved changes leaves a recovery copy, and the next launch offers it back.
		const unsaved = await levelCall(bridge, 'level_apply', {
			id: 'level-1',
			edit: { kind: 'paint', tile: 'fill', x: [[20, 22]], y: [[14, 14]] },
			basedOn: (await openLevel(bridge, path)).revision,
			mergeKey: 'crash',
		});
		const recoveryRoot = join(profile.data, 'ca.liminalhq.fizzstudio', 'recovery');
		const kept = await within(
			20_000,
			// A copy is built in a dot-folder and renamed into place, so an entry in the folder does not
			// mean a copy is finished. Killing the app mid-build left nothing to offer.
			() =>
				existsSync(recoveryRoot) &&
				readdirSync(recoveryRoot).some(
					(id) => !id.startsWith('.') && existsSync(join(recoveryRoot, id, 'note.txt')),
				),
		);
		check('autosave keeps a recovery copy of unsaved changes', kept !== null);
		await bridge.stop();
		await app.crash();
		check(
			'the crashed app left the file as last saved',
			readFileSync(path, 'utf8').includes('edited outside') &&
				!readFileSync(path, 'utf8').includes('fill x=20..22'),
		);

		app = new App(profile, []);
		await bridge.start();
		check('the relaunched app is ready', await bridge.ready());
		const offered = await bridge.js<{ id: string; name: string }[]>(
			`return await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-worlds|recovery_list');`,
		);
		check(
			'the next launch offers the recovered level',
			offered.length === 1 && offered[0]?.name === 'crater.fizz',
		);
		const restored = await levelCall(bridge, 'recovery_restore', { id: offered[0]?.id });
		check('restoring brings back the exact unsaved text', restored.text === unsaved.text);
		check('the restored level shows as unsaved changes', restored.revision > restored.saved);
		await levelCall(bridge, 'level_save', { id: restored.revision >= 0 ? 'level-1' : '' });
		await sleep(200);
	} finally {
		await bridge.close();
		await app?.quit();
		rmSync(profile.dir, { recursive: true, force: true });
	}
	console.log(
		failures.length === 0
			? '\nAll running-app checks passed.'
			: `\n${failures.length} check(s) failed.`,
	);
	process.exit(failures.length === 0 ? 0 : 1);
}

await main();
