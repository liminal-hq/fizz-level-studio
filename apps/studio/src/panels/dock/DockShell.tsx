// The dock shell: the level across the workspace and the left, right and bottom docks over its edges
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type ReactNode,
} from 'react';
import { t } from '../../i18n/messages';
import type { Size } from '../float/panelGeometry';
import { DockRail, type PeekCause } from './DockRail';
import { DockZone } from './DockZone';
import type { RailPlaceholders } from './railPlaceholders';
import type { PanelMenu } from './PanelMenuButton';
import { DragGhost } from './DragGhost';
import type { DockDrag } from './useDockDrag';
import { PeekPanel } from './PeekPanel';
import { DockResizeHandle } from './DockResizeHandle';
import { clampZoneSize, contentExtent, railExtent, zoneCap } from './dockGeometry';
import { RAIL_SIZE, ZONE_IDS, zoneMin, zoneOf } from './dockModel';
import type { DockSession } from './dockLayout';
import { railChoice } from './dockView';
import styles from './DockShell.module.css';

export interface DockActions {
	activate(id: string): void;
	dockTo(id: string, zone: ZoneId): void;
	floatPanel(id: string): void;
	toggleZone(zone: ZoneId): void;
	peek(id: string): void;
	closePeek(): void;
	pin(id: string): void;
	resizeZone(zone: ZoneId, size: number): void;
	resetZoneSize(zone: ZoneId): void;
	/** Moves a docked panel to a place among its group's tabs. */
	reorder(id: string, index: number): void;
	/** Makes an expandable panel fill the workspace. */
	maximise(id: string): void;
	/** Puts the maximised panel back. */
	restore(): void;
}

export interface DockShellProps {
	/** The workspace as it is drawn: hidden panels already out. */
	view: Workspace;
	/** The window the caps are measured against. */
	window: Size;
	/** What is peeking, and whether level-first is on. */
	session: DockSession;
	titleOf: (id: string) => string;
	/** The real content of a panel. Only the showing panel of each group is asked for. */
	renderPanel: (id: string) => ReactNode;
	actions: DockActions;
	/** The rows of a panel's own ⋮ menu and what choosing one does; headers show no menu button without it. */
	panelMenu?: (id: string) => PanelMenu;
	/** Dimmed rail entries for panels that are to come, such as Assets. */
	railPlaceholders?: RailPlaceholders;
	/** The drag controller; without one, panels cannot be dragged. */
	drag?: DockDrag;
	/** Whether a panel offers the maximise button. */
	expandable?: (id: string) => boolean;
	/**
	 * The maximised panel, if any. Nothing is re-parented: the panel keeps its place in its dock,
	 * whose group is laid over the workspace by the stylesheet while everything else is hidden.
	 */
	maximised?: string | null;
	/** What the last drag did, for the screen reader. */
	announcement?: string;
	/**
	 * The level. It fills the whole shell and the docks lie over its edges; `dockInsets` gives how
	 * far, for the camera to keep the level in the part they leave uncovered.
	 */
	children: ReactNode;
}

/** How long a peek opened by the pointer stays once the pointer has left it and its rail. */
export const PEEK_LEAVE_MS = 400;

/**
 * Lays the level across the whole shell and the docks over its edges (D69), so the docks' glass
 * blurs the level beneath: each zone with panels has its rail along the window's edge, always,
 * and, when it is open, its content inside the rail; the left and right zones stop above the
 * bottom one, which spans the width. A dock's size comes from the model (held to its cap). A dock
 * with nothing showing covers nothing, not even with a rail. The tree keeps the old order (left,
 * level, right, bottom), so the keyboard still meets them in that order.
 */
export function DockShell({
	view,
	window,
	session,
	titleOf,
	renderPanel,
	actions,
	panelMenu,
	railPlaceholders,
	drag,
	announcement = '',
	expandable,
	maximised = null,
	children,
}: DockShellProps) {
	const [tabNote, setTabNote] = useState('');
	const dragging = drag?.state ?? null;
	const target = dragging?.target ?? null;
	const reorder = (id: string, index: number) => {
		actions.reorder(id, index);
		const group = ZONE_IDS.flatMap((z) => view.zones[z].groups).find((g) => g.tabs.includes(id));
		setTabNote(
			t('dock.tab.moved', {
				title: titleOf(id),
				position: index + 1,
				total: group?.tabs.length ?? 0,
			}),
		);
	};
	const extent = (zone: ZoneId) => contentExtent(view, zone, window);
	const rail = (zone: ZoneId) => railExtent(view, zone);
	const style = {
		'--fls-dock-left': `${extent('left')}px`,
		'--fls-dock-right': `${extent('right')}px`,
		'--fls-dock-bottom': `${extent('bottom')}px`,
		'--fls-rail-left': `${rail('left')}px`,
		'--fls-rail-right': `${rail('right')}px`,
		'--fls-rail-bottom': `${rail('bottom')}px`,
		'--fls-rail': `${RAIL_SIZE}px`,
	} as CSSProperties;

	// A rail entry shows its panel, opening a folded dock on it, or folds the dock it is showing in.
	const choose = (id: string) => {
		const zone = zoneOf(view, id);
		const choice = railChoice(view, id);
		if (zone === null || choice === null) return;
		if (choice !== 'fold') actions.activate(id);
		if (choice !== 'show') actions.toggleZone(zone);
	};

	const peeking = session.peeking;
	const peekZone = peeking === null ? null : zoneOf(view, peeking);
	const shell = useRef<HTMLDivElement>(null);

	// A peek the pointer opened closes a moment after the pointer leaves both it and the rails.
	const { closePeek } = actions;
	const byHover = useRef(false);
	const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
	const stay = () => {
		if (leaving.current) clearTimeout(leaving.current);
		leaving.current = null;
	};
	const leave = () => {
		stay();
		if (byHover.current) leaving.current = setTimeout(closePeek, PEEK_LEAVE_MS);
	};
	useEffect(() => stay, []);
	useEffect(() => {
		if (peeking === null) {
			byHover.current = false;
			stay();
		}
	}, [peeking]);
	const onPeek = (id: string, cause: PeekCause) => {
		stay();
		byHover.current = cause === 'hover';
		actions.peek(id);
	};

	// A click anywhere but on the peeking panel or a rail closes the peek.
	useEffect(() => {
		if (peeking === null) return;
		const away = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (target?.closest('[data-peek], [data-rail]')) return;
			closePeek();
		};
		document.addEventListener('pointerdown', away);
		return () => document.removeEventListener('pointerdown', away);
	}, [peeking, closePeek]);

	// Escape closes the peek and returns to the rail button that opened it.
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'Escape' || peeking === null || event.defaultPrevented) return;
		event.preventDefault();
		const opener = peeking;
		actions.closePeek();
		shell.current?.querySelector<HTMLElement>(`[data-rail-item="${opener}"]`)?.focus();
	};

	const railOf = (id: ZoneId) => {
		const z = view.zones[id];
		if (z.groups.length === 0) return null;
		return (
			<div className={styles.slot} data-rail-slot={id} onPointerEnter={stay} onPointerLeave={leave}>
				<DockRail
					zone={id}
					groups={z.groups}
					collapsed={z.collapsed}
					titleOf={titleOf}
					peeking={peeking}
					disabled={session.levelFirst}
					onChoose={choose}
					onPeek={onPeek}
					onReorder={reorder}
					onDragStart={drag?.begin}
					dragging={dragging?.id ?? null}
					placeholders={railPlaceholders?.[id]}
				/>
			</div>
		);
	};

	const zone = (id: ZoneId) => {
		const z = view.zones[id];
		if (z.groups.length === 0 || z.collapsed || extent(id) === 0) return null;
		return (
			<div className={styles.slot} data-slot={id}>
				<DockResizeHandle
					zone={id}
					size={extent(id)}
					min={zoneMin(id)}
					max={zoneCap(id, window)}
					onResize={(size) => actions.resizeZone(id, size)}
					onReset={() => actions.resetZoneSize(id)}
				/>
				<DockZone
					zone={id}
					groups={z.groups}
					titleOf={titleOf}
					renderPanel={renderPanel}
					panelMenu={panelMenu}
					onDragStart={drag?.begin}
					dragging={dragging?.id ?? null}
					expandable={expandable}
					onMaximise={actions.maximise}
					maximised={maximised}
					onRestore={actions.restore}
				/>
			</div>
		);
	};

	return (
		<div
			className={styles.shell}
			style={style}
			ref={shell}
			onKeyDown={onKeyDown}
			data-dragging={dragging ? '' : undefined}
			data-has-maximised={maximised !== null ? '' : undefined}
		>
			{railOf('left')}
			{zone('left')}
			<div className={styles.level} data-level>
				{children}
			</div>
			{zone('right')}
			{railOf('right')}
			{zone('bottom')}
			{railOf('bottom')}
			{ZONE_IDS.map((id) => (
				<div
					key={id}
					className={styles.drop}
					data-drop-zone={id}
					data-lit={target?.kind === 'zone' && target.zone === id ? '' : undefined}
					aria-hidden="true"
				/>
			))}
			{dragging && <DragGhost drag={dragging} title={titleOf(dragging.id)} />}
			<p className={styles.hidden} role="status" aria-live="polite">
				{tabNote}
			</p>
			<p className={styles.hidden} role="status" aria-live="polite">
				{announcement}
			</p>
			{peeking !== null && peekZone !== null && (
				<PeekPanel
					zone={peekZone}
					id={peeking}
					title={titleOf(peeking)}
					size={clampZoneSize(peekZone, view.zones[peekZone].size, window)}
					onPin={() => actions.pin(peeking)}
					onMaximise={expandable?.(peeking) ? () => actions.maximise(peeking) : undefined}
					onPointerEnter={stay}
					onPointerLeave={leave}
				>
					{renderPanel(peeking)}
				</PeekPanel>
			)}
		</div>
	);
}
