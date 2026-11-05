// The main window's content: the start screen, or the editor for the open level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	CommandBridgeContext,
	createCommandBridge,
	useBridgeSnapshot,
	type CommandBridge,
} from '../commands/commandBridge';
import { CommandPalette, isCommandPaletteShortcut } from '../commands/CommandPalette';
import { t, type MessageId } from '../i18n/messages';
import { launchClient, type LaunchClient } from '../services/launchClient';
import { quitClient, type QuitClient } from '../services/quitClient';
import { pickLevelFile, type PickLevelFile } from '../services/filePicker';
import { openWindow } from '../services/windowsClient';
import { recentClient, type RecentClient } from '../services/recentClient';
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
import { AppWindow } from './AppWindow';
import type { DockClient } from '../services/dockClient';
import { CloseLevelDialog } from './CloseLevelDialog';
import { EditorScreen } from './EditorScreen';
import styles from './MainScreen.module.css';
import { RecoverySection } from './RecoverySection';
import { newerSnapshot } from './snapshotRule';

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

/** True for the keys that mean Save: Ctrl+S, or Cmd+S on a Mac. */
function isSaveShortcut(event: KeyboardEvent): boolean {
	return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's';
}

/** True for the keys that mean Preferences: Ctrl+, or Cmd+,. */
function isPreferencesShortcut(event: KeyboardEvent): boolean {
	return (event.ctrlKey || event.metaKey) && !event.altKey && event.key === ',';
}

/** True for the keys that mean Quit: Ctrl+Q. */
function isQuitShortcut(event: KeyboardEvent): boolean {
	return event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'q';
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
	const bridgeSnapshot = useBridgeSnapshot();

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

	// The app asks each main window in turn before it quits. A window with nothing unsaved is ready
	// at once; one with unsaved changes asks the same question as closing the level does. A newer
	// request replaces an older one, so the answer always names the round that is current.
	useEffect(
		() =>
			quit.onRequested((round) => {
				const current = levelRef.current;
				if (current && isDirty(current)) {
					setAsking(false);
					setQuitRound(round);
				} else {
					setQuitRound(null);
					void quit.answer(round, 'proceed').catch(() => {});
				}
			}),
		[quit],
	);

	const answerQuit = async (answer: 'proceed' | 'cancel') => {
		const round = quitRound;
		setQuitRound(null);
		if (round !== null) await quit.answer(round, answer).catch(() => {});
	};

	const saveAndQuit = async () => {
		await answerQuit((await save()) ? 'proceed' : 'cancel');
	};

	const discardAndQuit = async () => {
		const current = levelRef.current;
		if (!current) return answerQuit('proceed');
		try {
			// Closing the level drops its recovery copy, so the discarded work is not offered back.
			await client.close(current.id);
			dropLevel();
			await answerQuit('proceed');
		} catch {
			setBanner({ id: 'main.closeFailed' });
			await answerQuit('cancel');
		}
	};

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!isQuitShortcut(event)) return;
			event.preventDefault();
			void quit.request().catch(() => {});
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [quit]);

	useEffect(() => {
		if (!level) return;
		const onKey = (event: KeyboardEvent) => {
			if (!isSaveShortcut(event)) return;
			event.preventDefault();
			void save();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [level?.id, save]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!isPreferencesShortcut(event)) return;
			event.preventDefault();
			void openWindow({ kind: 'preferences' });
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, []);

	// Ctrl+Shift+P toggles the command palette on every screen. It is handled at the window in the
	// capture phase, so it works with focus in the script editor, which never sees the key.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!isCommandPaletteShortcut(event)) return;
			event.preventDefault();
			event.stopPropagation();
			setPaletteOpen((was) => !was);
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, []);

	// The application menu runs these through the bridge; the latest closures are read at call time.
	const live = useRef({ choose, save, requestClose });
	live.current = { choose, save, requestClose };
	useEffect(
		() =>
			bridge.setHandlers({
				'file.new': () => void openWindow({ kind: 'new-world' }),
				'file.open': () => void live.current.choose(),
				'file.save': () => void live.current.save(),
				'file.close': () => live.current.requestClose(),
				'view.commandPalette': () => setPaletteOpen(true),
			}),
		[bridge],
	);
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
			<AppWindow start={<AppMenu menuBar />} menuBar={<AppMenuBar />}>
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
			</AppWindow>
		);
	}

	const name = levelName(level);
	return (
		<AppWindow
			documentName={name}
			dirty={isDirty(level)}
			start={<AppMenu menuBar />}
			menuBar={<AppMenuBar />}
		>
			<div className={styles.editor}>
				<div className={styles.actions} role="toolbar" aria-label={t('main.levelActions')}>
					<button type="button" className={styles.button} onClick={() => void save()}>
						{t('main.save')}
					</button>
					<button type="button" className={styles.button} onClick={requestClose}>
						{t('main.closeLevel')}
					</button>
				</div>
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
							<span>{t('main.conflict')}</span>
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
					/>
				</div>
			</div>
			<CommandPalette
				open={paletteOpen}
				onClose={() => setPaletteOpen(false)}
				snapshot={bridgeSnapshot}
			/>
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
				onSave={() => void saveAndQuit()}
				onDiscard={() => void discardAndQuit()}
				onCancel={() => void answerQuit('cancel')}
			/>
		</AppWindow>
	);
}
