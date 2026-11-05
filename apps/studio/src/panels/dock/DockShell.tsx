// The dock shell: the level in the middle and the left, right and bottom docks around it
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
import { DockRail } from './DockRail';
import { DockZone } from './DockZone';
import { DragGhost } from './DragGhost';
import type { DockDrag } from './useDockDrag';
import { PeekPanel } from './PeekPanel';
import { DockResizeHandle } from './DockResizeHandle';
import { clampZoneSize, zoneCap, zoneExtent } from './dockGeometry';
import { RAIL_SIZE, ZONE_IDS, dockedIn, zoneMin, zoneOf } from './dockModel';
import type { DockSession } from './dockLayout';
import styles from './DockShell.module.css';

export interface DockActions {
	activate(id: string): void;
	dockTo(id: string, zone: ZoneId): void;
	floatPanel(id: string): void;
	/** Tears a panel off into a window of its own; the dock shows no Tear off button without it. */
	tearOff?(id: string): void;
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
	/** The level. It takes whatever the docks leave and is never covered by them. */
	children: ReactNode;
}

/**
 * Lays the level and the docks out on a grid: the left and right docks beside the level, the
 * bottom dock under all three. A dock's room comes from the model (its size held to its cap), so
 * the level keeps the rest. A dock with nothing showing takes none.
 */
export function DockShell({
	view,
	window,
	session,
	titleOf,
	renderPanel,
	actions,
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
	const extent = (zone: ZoneId) => zoneExtent(view, zone, window);
	const style = {
		'--fls-dock-left': `${extent('left')}px`,
		'--fls-dock-right': `${extent('right')}px`,
		'--fls-dock-bottom': `${extent('bottom')}px`,
		'--fls-rail': `${RAIL_SIZE}px`,
	} as CSSProperties;

	const peeking = session.peeking;
	const peekZone = peeking === null ? null : zoneOf(view, peeking);
	const shell = useRef<HTMLDivElement>(null);

	// A click anywhere but on the peeking panel or a rail closes the peek.
	const { closePeek } = actions;
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

	const zone = (id: ZoneId) => {
		const z = view.zones[id];
		if (z.groups.length === 0 || extent(id) === 0) return null;
		return (
			<div className={styles.slot} data-slot={id}>
				{z.collapsed ? (
					<DockRail
						zone={id}
						panels={dockedIn(view, id)}
						titleOf={titleOf}
						peeking={peeking}
						disabled={session.levelFirst}
						onPeek={actions.peek}
						onClosePeek={actions.closePeek}
						onUnfold={() => actions.toggleZone(id)}
					/>
				) : (
					<>
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
							onActivate={actions.activate}
							onDock={actions.dockTo}
							onFloat={actions.floatPanel}
							onTearOff={actions.tearOff}
							onFold={() => actions.toggleZone(id)}
							onReorder={reorder}
							onDragStart={drag?.begin}
							dragging={dragging?.id ?? null}
							expandable={expandable}
							onMaximise={actions.maximise}
							maximised={maximised}
							onRestore={actions.restore}
						/>
					</>
				)}
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
			{zone('left')}
			<div className={styles.level} data-level>
				{children}
			</div>
			{zone('right')}
			{zone('bottom')}
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
				>
					{renderPanel(peeking)}
				</PeekPanel>
			)}
		</div>
	);
}
