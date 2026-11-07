// A torn-off panel's window, dragged back to the main window to dock where it is let go
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The window's tab strip (the Script's one tab) and its title start the drag: a press that moves past
// a small threshold. The route is the plugin's, by probe:
//
// - `toplevel_drag` (Wayland): the compositor drags this window itself. The main window's regions
//   are registered with the plugin, which tells the main window about the hover and the drop; this
//   window has nothing more to do, and is closed by the main window if the drop docks it.
// - `ghost` with `cursor_follow` and `hit_test` (X11, Windows): the ghost card follows the cursor, and
//   this window polls which of the main window's regions is under it, telling the main window
//   (`dockHint`) so it can show where the panel would land. A release over a dock sends `dockBackTo`,
//   over the level a plain dock back; a release anywhere else changes nothing.
// - Neither: nothing starts, and the Dock back button remains.

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from 'react';
import { t } from '../../i18n/messages';
import {
	NO_TEAROFF,
	type DropReport,
	type PanelDragPayload,
	type TearoffClient,
	type TearoffFeatures,
} from '../../services/tearoffClient';
import { DRAG_THRESHOLD } from '../dock/useDockDrag';
import { parseRegion, type RegionTarget } from './dropRegions';
import { type PanelBridge } from './panelBridge';
import { GHOST_SIZE, ghostGrab } from './tearDrag';

/** How often the region under the cursor is asked for while the ghost is dragged, in milliseconds. */
export const HINT_INTERVAL_MS = 80;

export interface PanelWindowDragInput {
	client: TearoffClient | undefined;
	bridge: PanelBridge;
	/** The main window this panel's window belongs to. */
	owner: string;
	/** This window's label, such as `panel-script-1`. */
	label: string;
	panel: string;
	title: string;
	/** Docks the panel back to where it was (closes this window). */
	dockBack: () => void;
}

/** What a release over `report`'s region means for a panel of `owner`'s, or null when it is over nothing that takes it. */
export function dropTargetOf(report: DropReport, owner: string): RegionTarget | null {
	if (!report.hit || report.hit.window !== owner) return null;
	return parseRegion(report.hit.region);
}

interface Press {
	pointer: number;
	start: { x: number; y: number };
	grab: { x: number; y: number };
	target: Element;
	active: boolean;
	/** The ghost, once it is following the cursor. */
	ghost: 'none' | 'starting' | 'following';
	region: string | null;
	timer: ReturnType<typeof setInterval> | null;
}

function capture(target: Element, pointer: number, on: boolean) {
	try {
		if (on) target.setPointerCapture?.(pointer);
		else target.releasePointerCapture?.(pointer);
	} catch {
		// A pointer the browser does not know (a synthetic one); the drag still works.
	}
}

export function usePanelWindowDrag(input: PanelWindowDragInput): {
	/** Starts watching a press on the Script's tab (`scriptTab`) or the window's title (`header`). */
	onPointerDown: (
		event: ReactPointerEvent<HTMLElement>,
		source: PanelDragPayload['source'],
	) => void;
} {
	const { client } = input;
	const [features, setFeatures] = useState<TearoffFeatures>(NO_TEAROFF);
	const live = useRef({ ...input, features });
	live.current = { ...input, features };
	const press = useRef<Press | null>(null);
	const stop = useRef<(() => void) | null>(null);

	useEffect(() => {
		if (!client) return;
		let current = true;
		void client.features().then((found) => current && setFeatures(found));
		return () => {
			current = false;
		};
	}, [client]);

	useEffect(
		() => () => {
			stop.current?.();
		},
		[],
	);

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLElement>, source: PanelDragPayload['source']) => {
			if (event.button !== 0 || press.current || !live.current.client) return;
			const target = event.currentTarget;
			const rect = target.getBoundingClientRect();
			const current: Press = {
				pointer: event.pointerId,
				start: { x: event.clientX, y: event.clientY },
				grab: {
					x: Math.max(0, event.clientX - rect.left),
					y: Math.max(0, event.clientY - rect.top),
				},
				target,
				active: false,
				ghost: 'none',
				region: null,
				timer: null,
			};
			press.current = current;
			capture(target, event.pointerId, true);

			const payloadWith = (label?: string): PanelDragPayload => ({
				kind: 'panel',
				panel: live.current.panel,
				source,
				title: live.current.title,
				...(label !== undefined ? { label } : {}),
			});

			const hint = (region: string | null) => {
				if (current.region === region) return;
				current.region = region;
				live.current.bridge.send(live.current.owner, 'dockHint', {
					panel: live.current.panel,
					region,
				});
				const takes = parseRegion(region) !== null;
				void live.current.client
					?.update(payloadWith(t(takes ? 'tearoff.ghost.dock' : 'tearoff.ghost.drag')))
					.catch(() => {});
			};

			const begin = () => {
				const { client: plugin, features: known, label } = live.current;
				if (!plugin) return;
				if (known.toplevelDrag) {
					// The compositor takes the pointer: no more events here, so let go of the press.
					finish();
					void plugin
						.beginToplevelDrag(payloadWith(), label, ghostGrab(current.grab))
						.catch(() => {});
					return;
				}
				if (known.ghost && known.cursorFollow && known.hitTest) {
					current.ghost = 'starting';
					void plugin
						.begin(payloadWith(t('tearoff.ghost.drag')), ghostGrab(current.grab), GHOST_SIZE)
						.then(
							(result) => {
								if (press.current !== current) {
									// Ended while starting: do not leave the ghost on screen.
									if (result === 'following') void plugin.end('cancel').catch(() => {});
									return;
								}
								if (result !== 'following') {
									current.ghost = 'none';
									return;
								}
								current.ghost = 'following';
								current.timer = setInterval(() => {
									void plugin.hitTest().then(
										(hit) => {
											if (press.current !== current) return;
											hint(hit && hit.window === live.current.owner ? hit.region : null);
										},
										() => {},
									);
								}, HINT_INTERVAL_MS);
							},
							() => {
								current.ghost = 'none';
							},
						);
				}
			};

			const finish = () => {
				const was = press.current;
				press.current = null;
				stop.current?.();
				stop.current = null;
				if (was?.timer) clearInterval(was.timer);
				return was;
			};

			const endGhost = async (outcome: 'drop' | 'cancel') => {
				const plugin = live.current.client;
				if (!plugin) return;
				if (outcome === 'cancel') {
					void plugin.end('cancel').catch(() => {});
					return;
				}
				let report: DropReport;
				try {
					report = await plugin.end('drop');
				} catch {
					return;
				}
				const target = dropTargetOf(report, live.current.owner);
				if (target?.kind === 'zone') {
					live.current.bridge.send(live.current.owner, 'dockBackTo', {
						panel: live.current.panel,
						zone: target.zone,
						group: target.group,
						index: target.index,
					});
				} else if (target?.kind === 'level') {
					live.current.dockBack();
				}
			};

			const move = (e: PointerEvent) => {
				if (press.current !== current || e.pointerId !== current.pointer) return;
				if (!current.active) {
					if (
						Math.hypot(e.clientX - current.start.x, e.clientY - current.start.y) < DRAG_THRESHOLD
					) {
						return;
					}
					current.active = true;
					begin();
				}
			};
			const up = (e: PointerEvent) => {
				if (press.current !== current || e.pointerId !== current.pointer) return;
				capture(target, e.pointerId, false);
				const was = finish();
				if (!was?.active) return;
				// The click that follows a drag must not press whatever the pointer ended on.
				const swallow = (click: Event) => {
					click.stopPropagation();
					click.preventDefault();
				};
				document.addEventListener('click', swallow, true);
				setTimeout(() => document.removeEventListener('click', swallow, true), 0);
				if (was.ghost === 'following') {
					if (was.region !== null)
						live.current.bridge.send(live.current.owner, 'dockHint', {
							panel: live.current.panel,
							region: null,
						});
					void endGhost('drop');
				} else if (was.ghost === 'starting') {
					// Released before the ghost showed: nothing to place.
					void live.current.client?.end('cancel').catch(() => {});
				}
			};
			const abort = (e: Event) => {
				const id = (e as PointerEvent).pointerId;
				if (id !== undefined && id !== current.pointer) return;
				cancel();
			};
			const key = (e: KeyboardEvent) => {
				if (e.key !== 'Escape' || !current.active) return;
				e.preventDefault();
				e.stopPropagation();
				capture(target, current.pointer, false);
				cancel();
			};
			const cancel = () => {
				const was = finish();
				if (!was?.active) return;
				if (was.region !== null) {
					live.current.bridge.send(live.current.owner, 'dockHint', {
						panel: live.current.panel,
						region: null,
					});
				}
				if (was.ghost !== 'none') void endGhost('cancel');
			};

			document.addEventListener('pointermove', move);
			document.addEventListener('pointerup', up);
			document.addEventListener('pointercancel', abort);
			document.addEventListener('keydown', key, true);
			stop.current = () => {
				document.removeEventListener('pointermove', move);
				document.removeEventListener('pointerup', up);
				document.removeEventListener('pointercancel', abort);
				document.removeEventListener('keydown', key, true);
			};
		},
		[],
	);

	return { onPointerDown };
}
