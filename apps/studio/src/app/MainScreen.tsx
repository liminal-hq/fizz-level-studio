// The main window's content: the start screen, or the editor for the open level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import { layerList } from '../panels/layers/lockedNote';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	CommandBridgeContext,
	createCommandBridge,
	useBridgeSnapshot,
	type CommandBridge,
} from '../commands/commandBridge';
import { commandForKey, type KeyPhase } from '../commands/appShortcuts';
import { CommandPalette } from '../commands/CommandPalette';
import { allCommands, runCommand } from '../commands/registry';
import { t, type MessageId } from '../i18n/messages';
import { launchClient, type LaunchClient } from '../services/launchClient';
import { flushPendingWrites } from '../services/pendingWrites';
import { quitClient, type QuitClient } from '../services/quitClient';
import { pickLevelFile, type PickLevelFile } from '../services/filePicker';
import { openWindow } from '../services/windowsClient';
import { recentClient, type RecentClient } from '../services/recentClient';
import { settingsClient } from '../services/settingsClient';
import type { LevelClient } from '../worlds/levelClient';
import { recoveryClient, type RecoveryClient, type RecoveryEntry } from '../worlds/recoveryClient';
import {
	isDirty,
	TauriLevelClient,
	type LevelConflict,
	type WorldsClient,
} from '../worlds/tauriLevelClient';
import { AppMenu } from './AppMenu';
import { AppMenuBar } from './AppMenuBar';
import { AppRibbon } from './AppRibbon';
import { AppToolbar } from './AppToolbar';
import { AppWindow } from './AppWindow';
import type { DockClient } from '../services/dockClient';
import type { PanelBridge } from '../panels/windows/panelBridge';
import { CloseLevelDialog } from './CloseLevelDialog';
import { EditorScreen } from './EditorScreen';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import styles from './MainScreen.module.css';
import { RecoverySection } from './RecoverySection';
import { newerSnapshot } from './snapshotRule';
import { CommandSearchButton, WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useUiSettings, type UiSettingsClient } from './useUiSettings';

export interface MainScreenProps {
	/** The level backend; defaults to the worlds plugin. */
	client?: LevelClient & WorldsClient;
	/** The recent levels list; defaults to the settings plugin. */
	recents?: RecentClient;
	/** The launch paths and open requests; defaults to the app's commands. */
	launch?: LaunchClient;
	/** Asks for a level file; defaults to the native dialog. */
	pickFile?: PickLevelFile;
	/** The crash-recovery copies; defaults to the worlds plugin. */
	recovery?: RecoveryClient;
	/** Where the editor's dock layout is read and saved. Defaults to the settings plugin. */
	docks?: DockClient;
	/** Quitting the app; defaults to the app's commands. */
	quit?: QuitClient;
	/** The settings document, read for the menu bar choice; defaults to the settings plugin. */
	settings?: UiSettingsClient;
	/** The channel to panels torn off into their own windows. */
	panelBridge?: PanelBridge;
}

// One client for the app: it remembers each level's latest snapshot between calls.
let sharedClient: TauriLevelClient | null = null;
function defaultClient(): LevelClient & WorldsClient {
	sharedClient ??= new TauriLevelClient();
	return sharedClient;
}

/** The last part of a path, whichever separator it uses. */
export function baseName(path: string): string {
	return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** The folder part of a path, or an empty string. */
function folderOf(path: string): string {
	const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
	return cut > 0 ? path.slice(0, cut) : '';
}

/** The level's own name, or its file's name when it has none. */
export function levelName(snapshot: Pick<LevelSnapshot, 'view' | 'path'>): string {
	return snapshot.view.name.trim() || baseName(snapshot.path);
}

/** The main window: provides the command bridge the application menu reads, then the screen. */
export function MainScreen(props: MainScreenProps) {
	const [bridge] = useState(createCommandBridge);
	return (
		<CommandBridgeContext.Provider value={bridge}>
			<MainScreenBody {...props} bridge={bridge} />
		</CommandBridgeContext.Provider>
	);
}

function MainScreenBody({
	bridge,
	client = defaultClient(),
	recents = recentClient,
	launch = launchClient,
	pickFile = pickLevelFile,
	recovery = recoveryClient,
	docks,
	quit = quitClient,
	settings = settingsClient,
	panelBridge,
}: MainScreenProps & { bridge: CommandBridge }) {
	/** The snapshot the level was opened from; the editor takes later ones from `level`. */
	const [level, setLevel] = useState<LevelSnapshot | null>(null);
	const levelRef = useRef<LevelSnapshot | null>(null);
	const [recent, setRecent] = useState<string[]>([]);
	const [failed, setFailed] = useState<Set<string>>(new Set());
	const [banner, setBanner] = useState<{ id: MessageId; path?: string } | null>(null);
	const [recoverable, setRecoverable] = useState<RecoveryEntry[]>([]);
	const [notice, setNotice] = useState(false);
	const [conflict, setConflict] = useState<LevelConflict | null>(null);
	const [asking, setAsking] = useState(false);
	/** The quit round that is waiting on this window's Save, Discard or Cancel. */
	const [quitRound, setQuitRound] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const launched = useRef(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const bridgeSnapshot = useBridgeSnapshot();
	const { ui, setUi } = useUiSettings(settings);
	const menuBar = ui.menu_bar;

	const follow = useCallback((snapshot: LevelSnapshot) => {
		const kept = levelRef.current ? newerSnapshot(levelRef.current, snapshot) : snapshot;
		levelRef.current = kept;
		setLevel(kept);
	}, []);

	useEffect(() => {
		let live = true;
		void recents
			.list()
			.then((paths) => live && setRecent(paths))
			.catch(() => {});
		const stop = recents.onChanged(setRecent);
		return () => {
			live = false;
			stop();
		};
	}, [recents]);

	const refreshRecovery = useCallback(async () => {
		try {
			setRecoverable(await recovery.list());
		} catch {
			// A recovery list that cannot be read is the same as nothing to offer.
		}
	}, [recovery]);

	useEffect(() => {
		void refreshRecovery();
	}, [refreshRecovery]);

	useEffect(
		() =>
			client.onConflict((incoming) => {
				if (incoming.id === levelRef.current?.id) setConflict(incoming);
			}),
		[client],
	);

	const dropLevel = useCallback(() => {
		levelRef.current = null;
		setLevel(null);
		setConflict(null);
		setNotice(false);
	}, []);

	/** Shows an opened level: closes the one it replaces and moves `path` to the top of the recents. */
	const adopt = useCallback(
		async (snapshot: LevelSnapshot, path: string) => {
			const previous = levelRef.current;
			if (previous && previous.id !== snapshot.id) {
				await client.close(previous.id).catch(() => {});
			}
			setConflict(null);
			setNotice(false);
			levelRef.current = snapshot;
			setLevel(snapshot);
			setFailed((was) => {
				if (!was.has(path)) return was;
				const next = new Set(was);
				next.delete(path);
				return next;
			});
			try {
				setRecent(await recents.touch(path));
			} catch {
				// The level is open; a recent list that cannot be saved is not worth interrupting for.
			}
		},
		[client, recents],
	);

	const open = useCallback(
		async (path: string) => {
			setBusy(true);
			setBanner(null);
			try {
				await adopt(await client.open(path), path);
			} catch {
				setFailed((was) => new Set(was).add(path));
				setBanner({ id: 'main.openFailed', path });
			} finally {
				setBusy(false);
			}
		},
		[adopt, client],
	);

	const restore = useCallback(
		async (entry: RecoveryEntry) => {
			setBusy(true);
			setBanner(null);
			try {
				const snapshot = await recovery.restore(entry.id);
				await adopt(snapshot, entry.path);
				setNotice(true);
			} catch {
				setBanner({ id: 'main.restoreFailed', path: entry.path });
			} finally {
				setBusy(false);
				void refreshRecovery();
			}
		},
		[adopt, recovery, refreshRecovery],
	);

	const discardOne = useCallback(
		async (entry: RecoveryEntry) => {
			setBanner(null);
			try {
				await recovery.discard(entry.id);
			} catch {
				setBanner({ id: 'main.discardFailed', path: entry.path });
			}
			await refreshRecovery();
		},
		[recovery, refreshRecovery],
	);

	const discardAll = useCallback(async () => {
		setBanner(null);
		for (const entry of recoverable) {
			try {
				await recovery.discard(entry.id);
			} catch {
				setBanner({ id: 'main.discardFailed', path: entry.path });
			}
		}
		await refreshRecovery();
	}, [recoverable, recovery, refreshRecovery]);

	/**
	 * Paths handed to the window. The first opens, unless the open level has unsaved changes, which
	 * a launch must not discard; every other path (and all of them then) joins the recent list.
	 */
	const receive = useCallback(
		async (paths: string[]) => {
			if (paths.length === 0) return;
			const current = levelRef.current;
			const [first, ...rest] = paths;
			const canOpen = !current || !isDirty(current);
			const listed = canOpen ? rest : paths;
			try {
				for (const path of [...listed].reverse()) await recents.touch(path);
			} catch {
				// A recent list that cannot be saved does not stop the file opening.
			}
			if (canOpen) await open(first!);
			else recents.list().then(setRecent, () => {});
		},
		[open, recents],
	);

	useEffect(() => {
		if (launched.current) return;
		launched.current = true;
		void launch.getLaunchPaths().then(receive, () => {});
	}, [launch, receive]);

	useEffect(() => launch.onOpenRequest((paths) => void receive(paths)), [launch, receive]);

	const choose = async () => {
		const path = await pickFile({
			title: t('main.openDialogTitle'),
			filterName: t('main.fileFilter'),
		});
		if (path) await open(path);
	};

	const save = useCallback(async (): Promise<boolean> => {
		const current = levelRef.current;
		if (!current) return false;
		try {
			follow(await client.save(current.id));
			setBanner((was) => (was?.id === 'main.saveFailed' ? null : was));
			return true;
		} catch {
			setBanner({ id: 'main.saveFailed' });
			return false;
		}
	}, [client, follow]);

	const closeNow = async () => {
		const current = levelRef.current;
		if (!current) return;
		try {
			await client.close(current.id);
			dropLevel();
		} catch {
			setBanner({ id: 'main.closeFailed' });
		}
	};

	const requestClose = () => {
		if (levelRef.current && isDirty(levelRef.current)) setAsking(true);
		else void closeNow();
	};

	const saveAndClose = async () => {
		setAsking(false);
		if (await save()) await closeNow();
	};

	const discardAndClose = async () => {
		setAsking(false);
		await closeNow();
	};

	// The app asks every main window before it quits, and acts only when all agree. Asking only
	// records a decision: a window with nothing unsaved says ready at once; one with unsaved changes
	// asks the same question as closing the level does, and its Save or Discard is carried out only
	// when the app sends the commit. A newer request replaces an older one, so the answer always
	// names the round that is current.
	useEffect(
		() =>
			quit.onRequested((round) => {
				const current = levelRef.current;
				if (current && isDirty(current)) {
					setAsking(false);
					setQuitRound(round);
				} else {
					// Nothing is committed to a window that is ready, so its waiting writes go now.
					setQuitRound(null);
					void flushPendingWrites().then(() => quit.answer(round, 'ready').catch(() => {}));
				}
			}),
		[quit],
	);

	const answerQuit = async (answer: 'save' | 'discard' | 'cancel') => {
		const round = quitRound;
		setQuitRound(null);
		if (round !== null) await quit.answer(round, answer).catch(() => {});
	};

	// Everyone agreed: carry the decision out and report. A failed save keeps the app open, with
	// the usual save-failed error shown in this window; a discard closes the level, which drops
	// its recovery copy so the discarded work is not offered back.
	useEffect(
		() =>
			quit.onCommit((round, decision) => {
				const report = (outcome: 'done' | 'failed') =>
					void quit.confirm(round, outcome).catch(() => {});
				const current = levelRef.current;
				if (!current) return void flushPendingWrites().then(() => report('done'));
				if (decision === 'save') {
					void save().then(async (saved) => {
						await flushPendingWrites();
						report(saved ? 'done' : 'failed');
					});
					return;
				}
				client.close(current.id).then(
					async () => {
						dropLevel();
						await flushPendingWrites();
						report('done');
					},
					() => {
						setBanner({ id: 'main.closeFailed' });
						report('failed');
					},
				);
			}),
		[quit, client, save, dropLevel],
	);

	// One dispatcher for the app-wide keys: each command lists its own `keys`, so a key does exactly
	// what its menu row does, and nothing while the row is disabled. Chords marked `capture` (the
	// command palette) run ahead of the script editor, which never sees them; the rest run once the
	// focused control has had its say. Ctrl+W closes the level, never the window, and the zoom
	// chords are always taken so the webview's own page zoom never moves.
	useEffect(() => {
		const dispatcher = (phase: KeyPhase) => (event: KeyboardEvent) => {
			const snapshot = bridge.getSnapshot();
			const id = commandForKey(event, allCommands(snapshot.facts), phase);
			if (!id) return;
			event.preventDefault();
			if (phase === 'capture') event.stopPropagation();
			runCommand(id, snapshot);
		};
		const capture = dispatcher('capture');
		const bubble = dispatcher('bubble');
		window.addEventListener('keydown', capture, true);
		document.addEventListener('keydown', bubble);
		return () => {
			window.removeEventListener('keydown', capture, true);
			document.removeEventListener('keydown', bubble);
		};
	}, [bridge]);

	// The application menu runs these through the bridge; the latest closures are read at call time.
	const requestQuit = () => quit.request().catch(() => {});
	const live = useRef({ choose, save, requestClose, quit: requestQuit });
	live.current = { choose, save, requestClose, quit: requestQuit };
	useEffect(
		() =>
			bridge.setHandlers({
				'file.new': () => void openWindow({ kind: 'new-world' }),
				'file.open': () => void live.current.choose(),
				'file.save': () => void live.current.save(),
				'file.close': () => live.current.requestClose(),
				'file.quit': () => void live.current.quit(),
				'view.commandPalette': () => setPaletteOpen((was) => !was),
				'help.shortcuts': () => setShortcutsOpen((was) => !was),
			}),
		[bridge],
	);
	// The menu bar switch writes the setting, so every Main window follows; it is absent where settings cannot be written.
	const menuBarOn = menuBar;
	const { toolbar, ribbon_folded: ribbonFolded } = ui;
	useEffect(() => {
		if (!setUi) return;
		// Toolbar and Ribbon are switches: choosing the one that is showing hides the commands row.
		return bridge.setHandlers({
			'view.menuBar': () => setUi({ menu_bar: !menuBarOn }),
			'view.toolbar.classic': () =>
				setUi({ toolbar: toolbar === 'classic' ? 'hidden' : 'classic' }),
			'view.toolbar.ribbon': () => setUi({ toolbar: toolbar === 'ribbon' ? 'hidden' : 'ribbon' }),
			'view.toolbar.hidden': () => setUi({ toolbar: 'hidden' }),
			'view.ribbon.fold': () => setUi({ ribbon_folded: !ribbonFolded }),
		});
	}, [bridge, setUi, menuBarOn, toolbar, ribbonFolded]);
	useEffect(() => {
		bridge.setFacts({ menuBar, toolbar, ribbonFolded });
	}, [bridge, menuBar, toolbar, ribbonFolded]);
	const hasLevel = level !== null;
	useEffect(() => {
		bridge.setFacts({ hasLevel });
		return () => bridge.setFacts({ hasLevel: false });
	}, [bridge, hasLevel]);

	const bannerView = banner && (
		<p className={styles.error} role="alert">
			<span>{t(banner.id, { path: banner.path ?? '' })}</span>
			<button type="button" className={styles.button} onClick={() => setBanner(null)}>
				{t('main.dismiss')}
			</button>
		</p>
	);

	if (!level) {
		return (
			<AppWindow
				start={<AppMenu menuBar={menuBar} />}
				menuBar={menuBar ? <AppMenuBar /> : undefined}
			>
				<main className={styles.start}>
					{bannerView}
					<h1 className={styles.name}>{t('app.name')}</h1>
					<p className={styles.tagline}>{t('main.tagline')}</p>
					<div className={styles.starts}>
						<button
							type="button"
							className={`${styles.button} ${styles.primary}`}
							disabled={busy}
							onClick={() => void openWindow({ kind: 'new-world' })}
						>
							{t('main.newLevel')}
						</button>
						<button
							type="button"
							className={styles.button}
							disabled={busy}
							onClick={() => void choose()}
						>
							{t('main.openLevel')}
						</button>
					</div>
					<RecoverySection
						entries={recoverable}
						busy={busy}
						onRestore={(entry) => void restore(entry)}
						onDiscard={(entry) => void discardOne(entry)}
						onDiscardAll={() => void discardAll()}
					/>
					<section className={styles.recent} aria-labelledby="recent-heading">
						<h2 id="recent-heading" className={styles.heading}>
							{t('main.recent')}
						</h2>
						{recent.length === 0 ? (
							<p className={styles.muted}>{t('main.recentNone')}</p>
						) : (
							<>
								<ul className={styles.list}>
									{recent.map((path) => (
										<li key={path}>
											<button
												type="button"
												className={styles.entry}
												disabled={busy}
												onClick={() => void open(path)}
											>
												<span>{baseName(path)}</span>
												<span className={styles.folder}>{folderOf(path)}</span>
											</button>
											{failed.has(path) && (
												<p className={styles.entryError} role="alert">
													{t('main.recentMissing')}
												</p>
											)}
										</li>
									))}
								</ul>
								<button
									type="button"
									className={styles.button}
									onClick={() => void recents.clear().then(setRecent, () => {})}
								>
									{t('main.clearRecent')}
								</button>
							</>
						)}
					</section>
				</main>
				<CommandPalette
					open={paletteOpen}
					onClose={() => setPaletteOpen(false)}
					snapshot={bridgeSnapshot}
				/>
				<KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
			</AppWindow>
		);
	}

	const name = levelName(level);
	// The command search and the workspace switcher sit at the right end of the menu row, or of the
	// commands row while there is no menu bar.
	const editorEnd = (
		<>
			<CommandSearchButton />
			<WorkspaceSwitcher />
		</>
	);
	return (
		<AppWindow
			documentName={name}
			dirty={isDirty(level)}
			start={<AppMenu menuBar={menuBar} />}
			menuBar={menuBar ? <AppMenuBar end={editorEnd} /> : undefined}
			toolbar={
				ui.toolbar === 'classic' ? (
					<AppToolbar end={menuBar ? undefined : editorEnd} />
				) : ui.toolbar === 'ribbon' ? (
					<AppRibbon end={menuBar ? undefined : editorEnd} />
				) : undefined
			}
		>
			<div className={styles.editor}>
				{bannerView}
				{notice && (
					<p className={styles.notice} role="status">
						<span>{t('main.recoveredNotice')}</span>
						<button type="button" className={styles.button} onClick={() => setNotice(false)}>
							{t('main.dismiss')}
						</button>
					</p>
				)}
				{conflict && (
					<section className={styles.conflict}>
						<p className={styles.warning} role="alert">
							<span>
								{conflict.locked && conflict.locked.length > 0
									? t('main.conflictLocked', {
											layers: layerList(conflict.locked, level?.view.sections ?? []),
										})
									: t('main.conflict')}
							</span>
							<button type="button" className={styles.button} onClick={() => setConflict(null)}>
								{t('main.dismiss')}
							</button>
						</p>
						<pre className={styles.marked} tabIndex={0} aria-label={t('main.conflictText')}>
							{conflict.marked}
						</pre>
					</section>
				)}
				<div className={styles.editorBody}>
					<EditorScreen
						key={level.id}
						snapshot={level}
						client={client}
						onSnapshot={follow}
						docks={docks}
						panelBridge={panelBridge}
					/>
				</div>
			</div>
			<CommandPalette
				open={paletteOpen}
				onClose={() => setPaletteOpen(false)}
				snapshot={bridgeSnapshot}
			/>
			<KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
			<CloseLevelDialog
				open={asking}
				name={name}
				onSave={() => void saveAndClose()}
				onDiscard={() => void discardAndClose()}
				onCancel={() => setAsking(false)}
			/>
			<CloseLevelDialog
				open={quitRound !== null}
				name={name}
				onSave={() => void answerQuit('save')}
				onDiscard={() => void answerQuit('discard')}
				onCancel={() => void answerQuit('cancel')}
			/>
		</AppWindow>
	);
}
