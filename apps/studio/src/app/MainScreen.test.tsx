// Tests for the main screen with fake clients: start screen, open, save, close and conflicts
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { UiSettings } from '@liminal-hq/fizz-studio-protocol/generated/UiSettings';
import type { SettingsPatch } from '@liminal-hq/fizz-studio-plugin-settings';
import type { Settings } from '@liminal-hq/fizz-studio-protocol/generated/Settings';
import type { SettingsSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/SettingsSnapshot';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetActiveLocale } from '../i18n/active';
import { activateLocale } from '../i18n/loadCatalogue';
import { registerFlush } from '../services/pendingWrites';
import type { LaunchClient } from '../services/launchClient';
import type {
	QuitAnswer,
	QuitClient,
	QuitCommitDecision,
	QuitOutcome,
} from '../services/quitClient';
import type { RecentClient } from '../services/recentClient';
import type { SettingsClient } from '../services/settingsClient';
import { TRANSPARENCY_DEFAULTS } from '../theme/transparency';
import { fakeDockClient, floatingDock } from '../test/dockFixtures';
import { levelSnapshot, levelView } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { FakeRecoveryClient } from '../worlds/fakeRecoveryClient';
import type { LevelConflict, WorldsClient } from '../worlds/tauriLevelClient';

// The chrome follows the real window; in a test there is none, so it gets a quiet stand-in.
vi.mock('@tauri-apps/api/window', () => {
	const win = {
		minimize: async () => {},
		toggleMaximize: async () => {},
		close: async () => {},
		startDragging: async () => {},
		setAlwaysOnTop: async () => {},
		isAlwaysOnTop: async () => false,
		isMaximized: async () => false,
		onResized: async () => () => {},
		isFocused: async () => true,
		onFocusChanged: async () => () => {},
	};
	return { getCurrentWindow: () => win };
});

const openWindow = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../services/windowsClient', () => ({ openWindow }));

const setWindowTitle = vi.hoisted(() => vi.fn(async (_title: string) => {}));
vi.mock('../services/windowTitleClient', () => ({ setWindowTitle }));

import { MainScreen } from './MainScreen';

/** A level backend over `FakeLevelClient` that opens a canned level for any path. */
class FakeWorlds extends FakeLevelClient implements WorldsClient {
	conflictListener: ((conflict: LevelConflict) => void) | null = null;
	opened: string[] = [];
	closed: string[] = [];
	saves = 0;
	failOpen = new Set<string>();
	failSave = false;
	dirty = false;
	private base: LevelSnapshot;

	constructor(base: LevelSnapshot) {
		super(base);
		this.base = base;
	}

	async open(path: string): Promise<LevelSnapshot> {
		if (this.failOpen.has(path)) throw { kind: 'io', message: 'missing' };
		this.opened.push(path);
		return { ...this.base, path, revision: this.dirty ? 3n : 1n, saved_revision: 1n };
	}

	async save(): Promise<LevelSnapshot> {
		if (this.failSave) throw { kind: 'io', message: 'disk full' };
		this.saves += 1;
		return { ...this.base, revision: 3n, saved_revision: 3n };
	}

	async close(id: string): Promise<void> {
		this.closed.push(id);
	}

	onConflict(listener: (conflict: LevelConflict) => void): () => void {
		this.conflictListener = listener;
		return () => {
			this.conflictListener = null;
		};
	}
}

class FakeRecents implements RecentClient {
	paths: string[];
	listener: ((paths: string[]) => void) | null = null;
	constructor(paths: string[] = []) {
		this.paths = paths;
	}
	async list() {
		return [...this.paths];
	}
	async touch(path: string) {
		this.paths = [path, ...this.paths.filter((p) => p !== path)];
		return [...this.paths];
	}
	async clear() {
		this.paths = [];
		return [];
	}
	onChanged(listener: (paths: string[]) => void) {
		this.listener = listener;
		return () => {};
	}
}

/** A quit backend: the test plays Rust by calling `ask`, and reads the answers back. */
class FakeQuit implements QuitClient {
	requests = 0;
	answers: { round: number; answer: QuitAnswer }[] = [];
	listener: ((round: number) => void) | null = null;
	async request() {
		this.requests += 1;
	}
	onRequested(listener: (round: number) => void) {
		this.listener = listener;
		return () => {
			this.listener = null;
		};
	}
	commitListener: ((round: number, decision: QuitCommitDecision) => void) | null = null;
	confirms: { round: number; outcome: QuitOutcome }[] = [];
	onCommit(listener: (round: number, decision: QuitCommitDecision) => void) {
		this.commitListener = listener;
		return () => {
			this.commitListener = null;
		};
	}
	async answer(round: number, answer: QuitAnswer) {
		this.answers.push({ round, answer });
	}
	async confirm(round: number, outcome: QuitOutcome) {
		this.confirms.push({ round, outcome });
	}
	ask(round: number) {
		act(() => this.listener?.(round));
	}
	commit(round: number, decision: QuitCommitDecision) {
		act(() => this.commitListener?.(round, decision));
	}
}

/** The settings document as far as the main window reads it: the menu bar choice, changeable. */
class FakeSettings implements Pick<SettingsClient, 'get' | 'onChanged' | 'update'> {
	revision = 0;
	/** The `ui` values the chrome saved, in order. */
	updates: UiSettings[] = [];
	menuBar: boolean;
	toolbar: UiSettings['toolbar'];
	ribbonFolded = false;
	private listener: ((snapshot: SettingsSnapshot) => void) | null = null;
	constructor(menuBar: boolean, toolbar: UiSettings['toolbar'] = 'classic') {
		this.menuBar = menuBar;
		this.toolbar = toolbar;
	}
	private snapshot(): SettingsSnapshot {
		return {
			revision: this.revision,
			settings: {
				...DEFAULT_SETTINGS,
				ui: { menu_bar: this.menuBar, toolbar: this.toolbar, ribbon_folded: this.ribbonFolded },
			},
		};
	}
	async get() {
		return this.snapshot();
	}
	onChanged(listener: (snapshot: SettingsSnapshot) => void) {
		this.listener = listener;
		return () => {
			this.listener = null;
		};
	}
	async update(patch: SettingsPatch, basedOn: number) {
		if (basedOn !== this.revision) throw new Error('stale');
		this.updates.push(patch.ui!);
		this.menuBar = patch.ui!.menu_bar;
		this.toolbar = patch.ui!.toolbar;
		this.ribbonFolded = patch.ui!.ribbon_folded;
		this.revision += 1;
		this.listener?.(this.snapshot());
		return this.snapshot();
	}
	set(menuBar: boolean) {
		this.menuBar = menuBar;
		this.revision += 1;
		act(() => this.listener?.(this.snapshot()));
	}
}

const DEFAULT_SETTINGS: Settings = {
	colour_mode: 'system',
	accent: { kind: 'system' },
	glass: 'system',
	transparency: TRANSPARENCY_DEFAULTS,
	larger_controls: false,
	ui: { menu_bar: false, toolbar: 'classic', ribbon_folded: false },
	locale: 'en-CA',
	recent_worlds: [],
	layout: {},
	dock: { active: '', workspaces: {} },
};

function setup(
	options: {
		menuBar?: boolean;
		toolbar?: UiSettings['toolbar'];
		recent?: string[];
		launchPaths?: string[];
		pick?: string | null;
		recovery?: FakeRecoveryClient;
	} = {},
) {
	const base = levelSnapshot({}, levelView(12, 8, { name: 'Crater Fields' }));
	const client = new FakeWorlds(base);
	const recents = new FakeRecents(options.recent);
	let openRequest: ((paths: string[]) => void) | null = null;
	const launch: LaunchClient = {
		getLaunchPaths: async () => options.launchPaths ?? [],
		onOpenRequest: (listener) => {
			openRequest = listener;
			return () => {};
		},
	};
	const pickFile = vi.fn(async () =>
		options.pick === undefined ? '/levels/a.fizz' : options.pick,
	);
	const recovery = options.recovery ?? new FakeRecoveryClient();
	const quit = new FakeQuit();
	const settings = new FakeSettings(options.menuBar ?? false, options.toolbar);
	render(
		<MainScreen
			client={client}
			recents={recents}
			launch={launch}
			pickFile={pickFile}
			recovery={recovery}
			docks={fakeDockClient(floatingDock())}
			quit={quit}
			settings={settings}
		/>,
	);
	return {
		settings,
		client,
		quit,
		recents,
		pickFile,
		recovery,
		sendOpenRequest: (paths: string[]) => openRequest?.(paths),
	};
}

/** The title bar's text, the page's title and the native title all read exactly `title`. */
function expectTitle(title: string) {
	expect(screen.getByText(title, { selector: '[class*="title" i]' })).toBeInTheDocument();
	expect(document.title).toBe(title);
	expect(setWindowTitle).toHaveBeenLastCalledWith(title);
}

async function openFromDialog(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'Open level…' }));
	await screen.findByRole('group', { name: 'Level editor' });
}

beforeEach(() => {
	vi.useRealTimers();
});

describe('the start screen', () => {
	it('opens the New level window from the start screen', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole('button', { name: 'New level…' }));
		expect(openWindow).toHaveBeenCalledWith({ kind: 'new-world' });
	});

	it('is titled Start, without the app name, in the title bar and the native title', () => {
		setup();
		expectTitle('Start');
	});

	it('shows the product name, Open level and an empty recent list', async () => {
		setup();
		expect(screen.getByRole('heading', { name: 'Fizz Level Studio' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Open level…' })).toBeInTheDocument();
		expect(await screen.findByText('No recent levels yet.')).toBeInTheDocument();
	});

	it('lists recent levels as buttons and clears them', async () => {
		const user = userEvent.setup();
		setup({ recent: ['/levels/a.fizz', '/levels/b.fizz'] });
		expect(await screen.findByRole('button', { name: /a\.fizz/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /b\.fizz/ })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Clear recent' }));
		expect(await screen.findByText('No recent levels yet.')).toBeInTheDocument();
	});

	it('follows the recent list when it changes elsewhere', async () => {
		const { recents } = setup();
		await screen.findByText('No recent levels yet.');
		act(() => recents.listener?.(['/levels/z.fizz']));
		expect(await screen.findByRole('button', { name: /z\.fizz/ })).toBeInTheDocument();
	});
});

describe('opening', () => {
	it('opens the chosen file, shows the editor and touches the recent list', async () => {
		const user = userEvent.setup();
		const { client, recents, pickFile } = setup();
		await openFromDialog(user);
		expect(pickFile).toHaveBeenCalledWith({ title: 'Open a level', filterName: 'Fizz level' });
		expect(client.opened).toEqual(['/levels/a.fizz']);
		expect(recents.paths).toEqual(['/levels/a.fizz']);
		expectTitle('Crater Fields');
	});

	it('does nothing when the file dialog is cancelled', async () => {
		const user = userEvent.setup();
		const { client } = setup({ pick: null });
		await user.click(screen.getByRole('button', { name: 'Open level…' }));
		expect(client.opened).toEqual([]);
		expect(screen.queryByRole('group', { name: 'Level editor' })).toBeNull();
	});

	it('opens a recent level', async () => {
		const user = userEvent.setup();
		const { client } = setup({ recent: ['/levels/b.fizz'] });
		await user.click(await screen.findByRole('button', { name: /b\.fizz/ }));
		await screen.findByRole('group', { name: 'Level editor' });
		expect(client.opened).toEqual(['/levels/b.fizz']);
	});

	it('shows an error line and a dismissible banner for a missing file', async () => {
		const user = userEvent.setup();
		const { client } = setup({ recent: ['/levels/gone.fizz'] });
		client.failOpen.add('/levels/gone.fizz');
		await user.click(await screen.findByRole('button', { name: /gone\.fizz/ }));
		expect(await screen.findByText(/It may have moved or been deleted/)).toBeInTheDocument();
		expect(screen.getByText('Could not open /levels/gone.fizz.')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByText('Could not open /levels/gone.fizz.')).toBeNull();
		expect(screen.getByRole('button', { name: /gone\.fizz/ })).toBeInTheDocument();
	});

	it('opens the first launch path and lists the others as recent', async () => {
		const { client, recents } = setup({ launchPaths: ['/l/one.fizz', '/l/two.fizz'] });
		await screen.findByRole('group', { name: 'Level editor' });
		expect(client.opened).toEqual(['/l/one.fizz']);
		expect(recents.paths).toEqual(['/l/one.fizz', '/l/two.fizz']);
	});

	it('opens the first path of an open request', async () => {
		const { client, sendOpenRequest } = setup();
		await screen.findByText('No recent levels yet.');
		act(() => sendOpenRequest(['/l/three.fizz']));
		await screen.findByRole('group', { name: 'Level editor' });
		expect(client.opened).toEqual(['/l/three.fizz']);
	});

	it('keeps a level with unsaved changes open and lists an open request as recent', async () => {
		const user = userEvent.setup();
		const { client, recents, sendOpenRequest } = setup();
		client.dirty = true;
		await openFromDialog(user);
		act(() => sendOpenRequest(['/l/four.fizz']));
		await waitFor(() => expect(recents.paths).toContain('/l/four.fizz'));
		expect(client.opened).toEqual(['/levels/a.fizz']);
	});

	it('opens a level that has diagnostics', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		const snapshot = levelSnapshot(
			{},
			levelView(12, 8, {
				name: 'Rough',
				diagnostics: [{ line: 2, code: 'E005', message: 'bad', severity: 'error' } as never],
			}),
		);
		client.open = async () => snapshot;
		await user.click(screen.getByRole('button', { name: 'Open level…' }));
		expect(await screen.findByRole('group', { name: 'Level editor' })).toBeInTheDocument();
	});
});

describe('the dirty marker, saving and closing', () => {
	it('shows the classic toolbar under the title bar: files, history, the brush chip, then the panels', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		// The start screen has no commands row: there is no level to run them on.
		expect(screen.queryByRole('toolbar', { name: 'Commands' })).toBeNull();
		await openFromDialog(user);
		const row = await screen.findByRole('toolbar', { name: 'Commands' });
		const names = within(row)
			.getAllByRole('button')
			.map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim());
		expect(names.slice(0, 6)).toEqual([
			'New level…',
			'Open level…',
			'Save',
			'Close level',
			'Undo',
			'Redo',
		]);
		// The brush chip follows the history, and the panel toggles are at the far end.
		expect(names[6]).toMatch(/Brush:/);
		expect(names.slice(7)).toEqual(['Palette', 'Objects', 'History', 'Proposals', 'Script']);
		// The tools are not on it: they float over the map.
		expect(within(row).queryByRole('button', { name: 'Paint' })).toBeNull();
		const tools = screen.getByRole('group', { name: 'Tools' });
		expect(tools.closest('[data-map]')?.parentElement).toContainElement(
			screen.getByRole('application'),
		);
		// Its buttons run the commands: Save saves, and the panel toggles show their state.
		await user.click(within(row).getByRole('button', { name: 'Save' }));
		await waitFor(() => expect(client.saves).toBe(1));
		expect(within(row).getByRole('button', { name: 'Script' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(within(row).getByRole('button', { name: 'Undo' })).toBeDisabled();
	});

	it('hides and shows a panel from its toggle on the toolbar', async () => {
		const user = userEvent.setup();
		setup();
		await openFromDialog(user);
		const row = await screen.findByRole('toolbar', { name: 'Commands' });
		const history = within(row).getByRole('button', { name: 'History' });
		expect(history).toHaveAttribute('aria-pressed', 'true');
		await user.click(history);
		await waitFor(() =>
			expect(within(row).getByRole('button', { name: 'History' })).toHaveAttribute(
				'aria-pressed',
				'false',
			),
		);
		await user.click(within(row).getByRole('button', { name: 'History' }));
		await waitFor(() =>
			expect(within(row).getByRole('button', { name: 'History' })).toHaveAttribute(
				'aria-pressed',
				'true',
			),
		);
	});

	it('closes the level from the toolbar, and opens the Palette from the brush chip', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		await openFromDialog(user);
		const row = await screen.findByRole('toolbar', { name: 'Commands' });
		await user.click(within(row).getByRole('button', { name: /Brush:/ }));
		expect(await screen.findByRole('heading', { name: 'Palette' })).toBeInTheDocument();
		await user.click(within(row).getByRole('button', { name: 'Close level' }));
		await waitFor(() => expect(client.closed.length).toBe(1));
		await screen.findByRole('heading', { name: 'Fizz Level Studio' });
		expect(screen.queryByRole('toolbar', { name: 'Commands' })).toBeNull();
	});

	it('shows no commands row with the toolbar hidden, and none yet for the ribbon', async () => {
		const user = userEvent.setup();
		const { settings } = setup({ toolbar: 'hidden' });
		await openFromDialog(user);
		await screen.findByRole('application');
		expect(screen.queryByRole('toolbar', { name: 'Commands' })).toBeNull();
		expect(settings.toolbar).toBe('hidden');
	});

	it('marks the title with a bullet while there are unsaved changes, and Save clears it', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		client.dirty = true;
		await openFromDialog(user);
		expectTitle('Crater Fields •');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await waitFor(() => expectTitle('Crater Fields'));
		expect(client.saves).toBe(1);
	});

	it('saves with Ctrl+S', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		await openFromDialog(user);
		await user.keyboard('{Control>}s{/Control}');
		await waitFor(() => expect(client.saves).toBe(1));
	});

	it('shows an error when saving fails', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		client.failSave = true;
		await openFromDialog(user);
		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByText('The level could not be saved.')).toBeInTheDocument();
	});

	it('closes a clean level without asking and shows the start screen', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		await openFromDialog(user);
		await user.click(screen.getByRole('button', { name: 'Close level' }));
		expect(await screen.findByRole('button', { name: 'Open level…' })).toBeInTheDocument();
		expect(client.closed).toEqual(['level-1']);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	describe('with unsaved changes', () => {
		async function openDirty() {
			const user = userEvent.setup();
			const setupResult = setup();
			setupResult.client.dirty = true;
			await openFromDialog(user);
			await user.click(screen.getByRole('button', { name: 'Close level' }));
			const dialog = await screen.findByRole('dialog', { name: 'Save changes to Crater Fields?' });
			return { user, dialog, ...setupResult };
		}

		it('Save writes the level, then closes it', async () => {
			const { user, dialog, client } = await openDirty();
			await user.click(within(dialog).getByRole('button', { name: 'Save' }));
			expect(await screen.findByRole('button', { name: 'Open level…' })).toBeInTheDocument();
			expect(client.saves).toBe(1);
			expect(client.closed).toEqual(['level-1']);
		});

		it('Discard closes without saving', async () => {
			const { user, dialog, client } = await openDirty();
			await user.click(within(dialog).getByRole('button', { name: 'Discard' }));
			expect(await screen.findByRole('button', { name: 'Open level…' })).toBeInTheDocument();
			expect(client.saves).toBe(0);
			expect(client.closed).toEqual(['level-1']);
		});

		it('Cancel keeps the level open', async () => {
			const { user, dialog, client } = await openDirty();
			await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
			expect(screen.getByRole('group', { name: 'Level editor' })).toBeInTheDocument();
			expect(client.closed).toEqual([]);
		});

		it('keeps the level open when the save fails', async () => {
			const { user, dialog, client } = await openDirty();
			client.failSave = true;
			await user.click(within(dialog).getByRole('button', { name: 'Save' }));
			expect(await screen.findByText('The level could not be saved.')).toBeInTheDocument();
			expect(client.closed).toEqual([]);
		});
	});
});

describe('conflicts', () => {
	it('shows the marked text and lets it be dismissed', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		await openFromDialog(user);
		act(() =>
			client.conflictListener?.({ id: 'level-1', marked: '<<<<<<< mine\nx\n>>>>>>> theirs' }),
		);
		expect(
			await screen.findByText(/changed outside the studio on lines you also changed/),
		).toBeInTheDocument();
		expect(screen.getByLabelText('Text with conflict markers')).toHaveTextContent('<<<<<<< mine');
		await user.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByLabelText('Text with conflict markers')).toBeNull();
	});

	it('ignores a conflict for another level', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		await openFromDialog(user);
		act(() => client.conflictListener?.({ id: 'other', marked: 'x' }));
		expect(screen.queryByLabelText('Text with conflict markers')).toBeNull();
	});
});

describe('under the pseudo-locale', () => {
	afterEach(() => {
		resetActiveLocale();
	});

	it('marks the start screen copy', async () => {
		await activateLocale({ requested: 'en-XA', developer: true });
		setup();
		expect(screen.getByRole('button', { name: /^\[Öþéñ.*\]$/ })).toBeInTheDocument();
		expect(screen.queryByText('Open level…')).toBeNull();
		expect(await screen.findByText(/^\[Ñö ŕéçéñţ.*\]$/)).toBeInTheDocument();
	});
});

describe('recovered changes', () => {
	const entries = [
		{ id: 'r1', path: '/levels/a.fizz', name: 'a.fizz', saved_at_ms: 1_700_000_000_000n },
		{ id: 'r2', path: '/levels/b.fizz', name: 'b.fizz', saved_at_ms: 1_700_000_100_000n },
	];

	function recoveryWith(list = entries) {
		const recovered = levelSnapshot(
			{ id: 'rec-1', path: '/levels/a.fizz', revision: 2n, saved_revision: 1n },
			levelView(12, 8, { name: 'Crater Fields' }),
		);
		return new FakeRecoveryClient(list, { r1: recovered, r2: recovered });
	}

	it('is absent when there is nothing to recover', async () => {
		const recovery = new FakeRecoveryClient();
		setup({ recovery });
		await screen.findByText('No recent levels yet.');
		expect(recovery.listCalls).toBe(1);
		expect(screen.queryByRole('heading', { name: 'Recovered changes' })).toBeNull();
	});

	it('lists each copy with its name, path and time above the recent levels', async () => {
		setup({ recovery: recoveryWith(), recent: ['/levels/c.fizz'] });
		const heading = await screen.findByRole('heading', { name: 'Recovered changes' });
		const recent = screen.getByRole('heading', { name: 'Recent levels' });
		expect(heading.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		const row = screen.getByText('/levels/a.fizz').closest('li')!;
		expect(within(row).getByText('a.fizz')).toBeInTheDocument();
		expect(within(row).getByText(/^Kept .*2023/)).toBeInTheDocument();
	});

	it('restores into the editor with the dirty title and a dismissible notice', async () => {
		const user = userEvent.setup();
		const recovery = recoveryWith();
		const { client, recents } = setup({ recovery });
		await user.click(await screen.findByRole('button', { name: 'Restore a.fizz' }));
		await screen.findByRole('group', { name: 'Level editor' });
		expect(recovery.restored).toEqual(['r1']);
		expect(client.opened).toEqual([]);
		expect(recents.paths).toEqual(['/levels/a.fizz']);
		expectTitle('Crater Fields •');
		expect(screen.getByText('Recovered unsaved changes from your last session.')).toBeVisible();
		await user.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByText('Recovered unsaved changes from your last session.')).toBeNull();
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await waitFor(() => expect(client.saves).toBe(1));
	});

	it('discards one copy and removes its row', async () => {
		const user = userEvent.setup();
		const recovery = recoveryWith();
		setup({ recovery });
		await user.click(await screen.findByRole('button', { name: 'Discard a.fizz' }));
		await waitFor(() => expect(screen.queryByText('/levels/a.fizz')).toBeNull());
		expect(recovery.discarded).toEqual(['r1']);
		expect(screen.getByText('/levels/b.fizz')).toBeInTheDocument();
	});

	it('discards all copies and hides the section', async () => {
		const user = userEvent.setup();
		const recovery = recoveryWith();
		setup({ recovery });
		await user.click(await screen.findByRole('button', { name: 'Discard all' }));
		await waitFor(() =>
			expect(screen.queryByRole('heading', { name: 'Recovered changes' })).toBeNull(),
		);
		expect(recovery.discarded).toEqual(['r1', 'r2']);
	});

	it('keeps the row and shows the error banner when a restore fails', async () => {
		const user = userEvent.setup();
		const recovery = recoveryWith();
		recovery.failRestore.add('r1');
		setup({ recovery });
		await user.click(await screen.findByRole('button', { name: 'Restore a.fizz' }));
		expect(await screen.findByText('Could not restore /levels/a.fizz.')).toBeInTheDocument();
		expect(screen.getByText('/levels/a.fizz')).toBeInTheDocument();
		expect(screen.queryByRole('group', { name: 'Level editor' })).toBeNull();
		await user.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByText('Could not restore /levels/a.fizz.')).toBeNull();
	});

	it('keeps the row when a discard fails', async () => {
		const user = userEvent.setup();
		const recovery = recoveryWith();
		recovery.failDiscard.add('r2');
		setup({ recovery });
		await user.click(await screen.findByRole('button', { name: 'Discard b.fizz' }));
		expect(
			await screen.findByText('Could not discard the recovery copy of /levels/b.fizz.'),
		).toBeInTheDocument();
		expect(screen.getByText('/levels/b.fizz')).toBeInTheDocument();
	});

	it('is operable from the keyboard', async () => {
		const user = userEvent.setup();
		setup({ recovery: recoveryWith() });
		const restore = await screen.findByRole('button', { name: 'Restore a.fizz' });
		restore.focus();
		await user.tab();
		expect(screen.getByRole('button', { name: 'Discard a.fizz' })).toHaveFocus();
		await user.keyboard('{Enter}');
		await waitFor(() => expect(screen.queryByText('/levels/a.fizz')).toBeNull());
		screen.getByRole('button', { name: 'Restore b.fizz' }).focus();
		await user.keyboard(' ');
		await screen.findByRole('group', { name: 'Level editor' });
	});
});

describe('the application menu', () => {
	/** Opens the title bar's flat app menu, the primary menu while there is no bar. */
	const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
		if (!screen.queryByRole('menu')) {
			await user.click(await screen.findByRole('button', { name: 'Fizz Level Studio' }));
		}
	};

	it('opens New level and Preferences from the flat menu on the start screen', async () => {
		const user = userEvent.setup();
		setup();
		await openMenu(user);
		expect(screen.getByRole('menuitem', { name: /Save/ })).toHaveAttribute('aria-disabled', 'true');
		await user.click(screen.getByRole('menuitem', { name: /New level/ }));
		expect(openWindow).toHaveBeenCalledWith({ kind: 'new-world' });
		await openMenu(user);
		await user.click(screen.getByRole('menuitem', { name: /Preferences/ }));
		expect(openWindow).toHaveBeenCalledWith({ kind: 'preferences' });
	});

	it('opens Preferences with Ctrl+comma', async () => {
		const user = userEvent.setup();
		openWindow.mockClear();
		setup();
		await user.keyboard('{Control>},{/Control}');
		expect(openWindow).toHaveBeenCalledWith({ kind: 'preferences' });
	});

	it('saves, toggles a panel and closes the level from the flat menu', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		await openFromDialog(user);
		await openMenu(user);
		await user.click(screen.getByRole('menuitem', { name: /Save/ }));
		await waitFor(() => expect(client.saves).toBe(1));
		await openMenu(user);
		await user.click(screen.getByRole('menuitem', { name: 'Panels' }));
		const palette = screen.getByRole('menuitemcheckbox', { name: /Palette/ });
		expect(palette).toHaveAttribute('aria-checked', 'true');
		await user.click(palette);
		await openMenu(user);
		await user.click(screen.getByRole('menuitem', { name: 'Panels' }));
		expect(screen.getByRole('menuitemcheckbox', { name: /Palette/ })).toHaveAttribute(
			'aria-checked',
			'false',
		);
		await user.keyboard('{Escape}{Escape}');
		await openMenu(user);
		await user.click(screen.getByRole('menuitem', { name: /Close level/ }));
		await waitFor(() => expect(client.closed.length).toBe(1));
		await screen.findByRole('heading', { name: 'Fizz Level Studio' });
	});

	it('has no menu bar by default, and the title bar button carries the one flat menu', async () => {
		const user = userEvent.setup();
		setup();
		expect(screen.queryByRole('menubar')).toBeNull();
		await user.click(await screen.findByRole('button', { name: 'Fizz Level Studio' }));
		for (const name of [/New level/, /Open level/, /Preferences/, /^Help/, /Quit/]) {
			expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
		}
		// No headings, and the Window rows are left out with no level open.
		for (const name of ['File', 'Edit', 'View', 'Window']) {
			expect(screen.queryByRole('menuitem', { name })).toBeNull();
		}
		await user.click(screen.getByRole('menuitem', { name: 'About Fizz Level Studio…' }));
		expect(openWindow).toHaveBeenCalledWith({ kind: 'about' });
	});

	it('opens the flat app menu on F10, and has no letter keys, when there is no bar', async () => {
		setup();
		await screen.findByRole('button', { name: 'Fizz Level Studio' });
		fireEvent.keyDown(window, { key: 'F10' });
		expect(await screen.findByRole('menu')).toBeInTheDocument();
		fireEvent.keyDown(window, { key: 'F10' });
		expect(screen.queryByRole('menu')).toBeNull();
		fireEvent.keyDown(window, { key: 'h', altKey: true });
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('shows the bar with the setting on, and the title bar button becomes plain text', async () => {
		const user = userEvent.setup();
		setup({ menuBar: true });
		const bar = await screen.findByRole('menubar', { name: 'Application menu' });
		for (const name of ['File', 'Edit', 'View', 'Help']) {
			expect(within(bar).getByRole('menuitem', { name })).toBeInTheDocument();
		}
		expect(within(bar).queryByRole('menuitem', { name: 'Window' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Fizz Level Studio' })).toBeNull();
		fireEvent.keyDown(window, { key: 'F10' });
		expect(screen.queryByRole('menu')).toBeNull();
		await user.click(within(bar).getByRole('menuitem', { name: 'File' }));
		await user.click(screen.getByRole('menuitem', { name: /Preferences/ }));
		expect(openWindow).toHaveBeenCalledWith({ kind: 'preferences' });
	});

	it('follows the setting live in both directions', async () => {
		const { settings } = setup();
		await screen.findByRole('button', { name: 'Fizz Level Studio' });
		expect(screen.queryByRole('menubar')).toBeNull();
		settings.set(true);
		expect(await screen.findByRole('menubar', { name: 'Application menu' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Fizz Level Studio' })).toBeNull();
		settings.set(false);
		await waitFor(() => expect(screen.queryByRole('menubar')).toBeNull());
		expect(screen.getByRole('button', { name: 'Fizz Level Studio' })).toBeInTheDocument();
	});

	it('switches the menu bar on from the flat menu, through the settings', async () => {
		const user = userEvent.setup();
		const { settings } = setup();
		await openMenu(user);
		await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Menu bar' }));
		await waitFor(() =>
			expect(settings.updates).toContainEqual({
				menu_bar: true,
				toolbar: 'classic',
				ribbon_folded: false,
			}),
		);
		expect(await screen.findByRole('menubar', { name: 'Application menu' })).toBeInTheDocument();
	});

	it('has Toolbar and Ribbon switches in the app menu: choosing the one that shows hides the row', async () => {
		const user = userEvent.setup();
		const { settings } = setup();
		await openFromDialog(user);
		await screen.findByRole('toolbar', { name: 'Commands' });
		await openMenu(user);
		expect(screen.getByRole('menuitemcheckbox', { name: 'Toolbar' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(screen.getByRole('menuitemcheckbox', { name: 'Ribbon' })).toHaveAttribute(
			'aria-checked',
			'false',
		);
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'Toolbar' }));
		await waitFor(() => expect(settings.toolbar).toBe('hidden'));
		await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Commands' })).toBeNull());
		await openMenu(user);
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'Toolbar' }));
		await waitFor(() => expect(settings.toolbar).toBe('classic'));
		expect(await screen.findByRole('toolbar', { name: 'Commands' })).toBeInTheDocument();
		await openMenu(user);
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'Ribbon' }));
		await waitFor(() => expect(settings.toolbar).toBe('ribbon'));
	});

	it('resets the layout from the bar’s View menu', async () => {
		const user = userEvent.setup();
		setup({ menuBar: true });
		await openFromDialog(user);
		const bar = await screen.findByRole('menubar', { name: 'Application menu' });
		await user.click(within(bar).getByRole('menuitem', { name: 'View' }));
		await user.click(screen.getByRole('menuitem', { name: /Reset layout/ }));
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('shows the same menus with a level open, bar on or off', async () => {
		const user = userEvent.setup();
		setup({ menuBar: true });
		await openFromDialog(user);
		expect(screen.getByRole('menubar', { name: 'Application menu' })).toBeInTheDocument();
	});
});

describe('the command palette', () => {
	const pressShortcut = () =>
		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'P',
					ctrlKey: true,
					shiftKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
		});

	it('opens and closes with Ctrl+Shift+P on the start screen', async () => {
		const user = userEvent.setup();
		setup();
		await user.keyboard('{Control>}{Shift>}P{/Shift}{/Control}');
		expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
		await user.keyboard('{Control>}{Shift>}P{/Shift}{/Control}');
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('opens even when the focused element stops key events from bubbling', async () => {
		const user = userEvent.setup();
		setup();
		await openFromDialog(user);
		const field = document.createElement('div');
		field.tabIndex = 0;
		field.addEventListener('keydown', (event) => event.stopPropagation());
		document.body.append(field);
		field.focus();
		pressShortcut();
		expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
		field.remove();
	});

	it('is offered by the app menu with its keys', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(await screen.findByRole('button', { name: 'Fizz Level Studio' }));
		const row = screen.getByRole('menuitem', { name: /Command palette…/ });
		expect(row).toHaveTextContent('Ctrl+Shift+P');
		await user.click(row);
		expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
	});

	it('runs Preferences from the palette', async () => {
		const user = userEvent.setup();
		openWindow.mockClear();
		setup();
		pressShortcut();
		await user.type(screen.getByRole('combobox'), 'prefer{Enter}');
		expect(openWindow).toHaveBeenCalledWith({ kind: 'preferences' });
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('chooses a tool and a brush in the editor', async () => {
		const user = userEvent.setup();
		setup();
		await openFromDialog(user);
		pressShortcut();
		await user.type(screen.getByRole('combobox'), 'erase{Enter}');
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /^Erase/ })).toHaveAttribute(
				'aria-pressed',
				'true',
			),
		);
		pressShortcut();
		await user.type(screen.getByRole('combobox'), 'brush: gloop{Enter}');
		await waitFor(() => expect(screen.getByText('Brush: gloop')).toBeInTheDocument());
		expect(screen.getByRole('button', { name: /^Paint/ })).toHaveAttribute('aria-pressed', 'true');
	});

	it('hides a panel from the palette', async () => {
		const user = userEvent.setup();
		setup();
		await openFromDialog(user);
		expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument();
		pressShortcut();
		await user.type(screen.getByRole('combobox'), 'hide history{Enter}');
		await waitFor(() => expect(screen.queryByRole('region', { name: 'History' })).toBeNull());
	});

	it('goes to a line, showing the Script panel if it was hidden', async () => {
		const user = userEvent.setup();
		setup();
		await openFromDialog(user);
		pressShortcut();
		await user.type(screen.getByRole('combobox'), 'hide script{Enter}');
		await waitFor(() => expect(screen.queryByRole('region', { name: 'Script' })).toBeNull());
		pressShortcut();
		await user.type(screen.getByRole('combobox'), 'go to line{Enter}');
		await user.type(screen.getByRole('textbox', { name: 'Line number' }), '1{Enter}');
		expect(await screen.findByRole('region', { name: 'Script' })).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('dims editor commands on the start screen', async () => {
		const user = userEvent.setup();
		setup();
		pressShortcut();
		await user.type(screen.getByRole('combobox'), 'erase');
		expect(screen.getByRole('option', { name: /Erase/ })).toHaveAttribute('aria-disabled', 'true');
	});
});

describe('the file and help keys', () => {
	it('opens the New level window with Ctrl+N', async () => {
		const user = userEvent.setup();
		setup();
		openWindow.mockClear();
		await user.keyboard('{Control>}n{/Control}');
		expect(openWindow).toHaveBeenCalledWith({ kind: 'new-world' });
	});

	it('asks for a level file with Ctrl+O', async () => {
		const user = userEvent.setup();
		const { pickFile } = setup();
		await user.keyboard('{Control>}o{/Control}');
		expect(pickFile).toHaveBeenCalledOnce();
		await screen.findByRole('group', { name: 'Level editor' });
	});

	it('closes a level with nothing unsaved with Ctrl+W, and does nothing without a level', async () => {
		const user = userEvent.setup();
		setup();
		await user.keyboard('{Control>}w{/Control}');
		expect(screen.queryByRole('dialog')).toBeNull();
		await openFromDialog(user);
		await user.keyboard('{Control>}w{/Control}');
		expect(await screen.findByRole('button', { name: 'Open level…' })).toBeInTheDocument();
	});

	it('asks the Close level question with Ctrl+W while there are unsaved changes', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		client.dirty = true;
		await openFromDialog(user);
		await user.keyboard('{Control>}w{/Control}');
		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveTextContent('Crater Fields');
		await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		expect(screen.getByRole('group', { name: 'Level editor' })).toBeInTheDocument();
	});

	it('opens Help on F1 as the About window', async () => {
		const user = userEvent.setup();
		setup();
		openWindow.mockClear();
		await user.keyboard('{F1}');
		expect(openWindow).toHaveBeenCalledWith({ kind: 'about' });
	});

	it('shows and hides the Keyboard shortcuts window with the question mark', async () => {
		const user = userEvent.setup();
		setup();
		await user.keyboard('?');
		const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
		expect(within(dialog).getByRole('cell', { name: 'Ctrl+N' })).toBeInTheDocument();
		expect(within(dialog).getByRole('cell', { name: 'F1' })).toBeInTheDocument();
		expect(within(dialog).getByRole('cell', { name: 'B E I S T Q' })).toBeInTheDocument();
		await user.keyboard('?');
		expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
	});

	it('opens Keyboard shortcuts from the app menu', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(await screen.findByRole('button', { name: 'Fizz Level Studio' }));
		await user.click(screen.getByRole('menuitem', { name: /^Keyboard shortcuts…/ }));
		expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
		await user.click(
			within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).getByRole('button', {
				name: 'Close',
			}),
		);
		expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
	});

	it('opens the command palette from the last row of the Undo history submenu', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(await screen.findByRole('button', { name: 'Fizz Level Studio' }));
		await user.click(screen.getByRole('menuitem', { name: 'Undo history' }));
		expect(
			await screen.findByRole('menuitem', { name: 'Nothing in the history yet' }),
		).toHaveAttribute('aria-disabled', 'true');
		await user.click(screen.getByRole('menuitem', { name: 'More in the command palette…' }));
		expect(await screen.findByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
	});
});

describe('quitting the app', () => {
	async function askDirty() {
		const user = userEvent.setup();
		const ctx = setup();
		ctx.client.dirty = true;
		await openFromDialog(user);
		ctx.quit.ask(1);
		const dialog = await screen.findByRole('dialog', { name: 'Save changes to Crater Fields?' });
		return { user, dialog, ...ctx };
	}

	it('writes the settings waiting on a pause before it says ready, and before it confirms a commit', async () => {
		const user = userEvent.setup();
		const { quit, client } = setup();
		client.dirty = true;
		await openFromDialog(user);
		const flush = vi.fn(() => Promise.resolve());
		const unregister = registerFlush(flush);
		quit.ask(1);
		await screen.findByRole('dialog', { name: 'Save changes to Crater Fields?' });
		await user.click(screen.getByRole('button', { name: 'Discard' }));
		quit.commit(1, 'discard');
		await waitFor(() => expect(quit.confirms).toEqual([{ round: 1, outcome: 'done' }]));
		expect(flush).toHaveBeenCalledTimes(1);
		unregister();
	});

	it('is ready at once on the start screen', async () => {
		const { quit } = setup();
		quit.ask(1);
		await waitFor(() => expect(quit.answers).toEqual([{ round: 1, answer: 'ready' }]));
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('is ready at once with a level that has no unsaved changes, and does nothing at commit', async () => {
		const user = userEvent.setup();
		const { quit, client } = setup();
		await openFromDialog(user);
		quit.ask(2);
		await waitFor(() => expect(quit.answers).toEqual([{ round: 2, answer: 'ready' }]));
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(client.closed).toEqual([]);
		expect(client.saves).toBe(0);
	});

	it('Cancel answers cancel and leaves the level untouched', async () => {
		const { user, dialog, quit, client } = await askDirty();
		expect(quit.answers).toEqual([]);
		await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		expect(quit.answers).toEqual([{ round: 1, answer: 'cancel' }]);
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(client.saves).toBe(0);
		expect(client.closed).toEqual([]);
		expect(screen.getByRole('group', { name: 'Level editor' })).toBeInTheDocument();
	});

	it('Save is only recorded when chosen, and the level is saved at commit', async () => {
		const { user, dialog, quit, client } = await askDirty();
		await user.click(within(dialog).getByRole('button', { name: 'Save' }));
		expect(quit.answers).toEqual([{ round: 1, answer: 'save' }]);
		expect(client.saves).toBe(0);
		expect(screen.queryByRole('dialog')).toBeNull();
		quit.commit(1, 'save');
		await waitFor(() => expect(quit.confirms).toEqual([{ round: 1, outcome: 'done' }]));
		expect(client.saves).toBe(1);
		expect(client.closed).toEqual([]);
	});

	it('a failed save at commit reports failed, shows the error and leaves the level open', async () => {
		const { user, dialog, quit, client } = await askDirty();
		client.failSave = true;
		await user.click(within(dialog).getByRole('button', { name: 'Save' }));
		expect(client.saves).toBe(0);
		quit.commit(1, 'save');
		await waitFor(() => expect(quit.confirms).toEqual([{ round: 1, outcome: 'failed' }]));
		expect(await screen.findByText('The level could not be saved.')).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Level editor' })).toBeInTheDocument();
	});

	it('Discard is only recorded when chosen, and the level is closed at commit', async () => {
		const { user, dialog, quit, client } = await askDirty();
		await user.click(within(dialog).getByRole('button', { name: 'Discard' }));
		expect(quit.answers).toEqual([{ round: 1, answer: 'discard' }]);
		expect(client.closed).toEqual([]);
		expect(screen.getByRole('group', { name: 'Level editor' })).toBeInTheDocument();
		quit.commit(1, 'discard');
		await waitFor(() => expect(quit.confirms).toEqual([{ round: 1, outcome: 'done' }]));
		expect(client.saves).toBe(0);
		expect(client.closed).toEqual(['level-1']);
	});

	it('answers a newer request with its own round', async () => {
		const { user, quit } = await askDirty();
		quit.ask(8);
		await user.click(
			within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
		);
		expect(quit.answers).toEqual([{ round: 8, answer: 'cancel' }]);
	});

	it('asks the app to quit with Ctrl+Q', async () => {
		const user = userEvent.setup();
		const { quit } = setup();
		await user.keyboard('{Control>}q{/Control}');
		expect(quit.requests).toBe(1);
	});
});
