// Tests for the main screen with fake clients: start screen, open, save, close and conflicts
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetActiveLocale } from '../i18n/active';
import { activateLocale } from '../i18n/loadCatalogue';
import type { LaunchClient } from '../services/launchClient';
import type { RecentClient } from '../services/recentClient';
import { levelSnapshot, levelView } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
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

function setup(options: { recent?: string[]; launchPaths?: string[]; pick?: string | null } = {}) {
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
	render(<MainScreen client={client} recents={recents} launch={launch} pickFile={pickFile} />);
	return { client, recents, pickFile, sendOpenRequest: (paths: string[]) => openRequest?.(paths) };
}

async function openFromDialog(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'Open level…' }));
	await screen.findByRole('group', { name: 'Level editor' });
}

beforeEach(() => {
	vi.useRealTimers();
});

describe('the start screen', () => {
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
		expect(screen.getByText('Crater Fields — Fizz Level Studio')).toBeInTheDocument();
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
	it('marks the title with a bullet while there are unsaved changes, and Save clears it', async () => {
		const user = userEvent.setup();
		const { client } = setup();
		client.dirty = true;
		await openFromDialog(user);
		expect(screen.getByText('• Crater Fields — Fizz Level Studio')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByText('Crater Fields — Fizz Level Studio')).toBeInTheDocument();
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
