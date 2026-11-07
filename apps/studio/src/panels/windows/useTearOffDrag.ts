// The main window's side of tearing a panel off by dragging and docking it back by dragging
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Out: `onLeaveWindow` goes to `useDockDrag`, which calls it when a press on a header grip, a rail
// entry or a Script tab is dragged past the window's edge; `startTearDrag` picks the route.
//
// Back: the window registers a drop region for each place a panel can land (`dropRegions.ts`) so the
// tear-off plugin can say, across windows, which one the cursor is over. A panel window dragged over
// them tells this window by the panel bridge (`dockBackTo`, and `dockHint` while it is still over
// one), or, where the compositor drags the window, the plugin sends this window the hover and the
// drop itself. A drop docks the panel (`dropOn`; the sync in `usePanelWindows` then closes its
// window), says so, and marks where it landed.

import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../../i18n/messages';
import {
	NO_TEAROFF,
	readPanelDragPayload,
	type Region,
	type TearoffClient,
	type TearoffFeatures,
} from '../../services/tearoffClient';
import { ZONE_LABELS } from '../dock/DockZone';
import type { Point } from '../dock/dockDrop';
import type { DockLayoutHandle } from '../dock/useDockLayout';
import type { LeaveWindowInfo, WindowExit } from '../dock/useDockDrag';
import type { PanelId } from '../float/panelSpecs';
import { PANEL_SPECS } from '../float/panelSpecs';
import { collectDropRegions, parseRegion, regionCentre, type RegionTarget } from './dropRegions';
import { startTearDrag } from './tearDrag';
import type { PanelWindows } from './usePanelWindows';

/** How long the mark stays on the panel that landed, in milliseconds. */
export const LANDING_MS = 1600;
/** How long the layout is left alone before the regions are measured again, in milliseconds. */
export const REGION_DELAY_MS = 60;

export interface TearOffDragInput {
	/** The plugin; without one a drag cannot leave the window and nothing is registered. */
	client: TearoffClient | undefined;
	/** The element the docks and the level are laid out in. */
	areaRef: RefObject<HTMLElement | null>;
	dock: DockLayoutHandle;
	windows: PanelWindows;
	titleOf: (id: string) => string;
	/** Shows a dock hint: the panel's drop would land at this point of the page, or (null) nowhere. */
	hover: (id: string, point: Point | null) => void;
	/** Says something to a screen reader. */
	say: (text: string) => void;
}

export interface TearOffDrag {
	/** Goes to `useDockDrag`'s `onLeaveWindow`. */
	onLeaveWindow: (info: LeaveWindowInfo) => WindowExit | void;
	/** A panel window was let go over a place in this window: dock it there (the panel bridge's `dockBackTo`). */
	dockBackTo: (panel: PanelId, zone: ZoneId, group: number | null, index: number | null) => void;
	/** A panel window is over a region of this window, or (null) over none (the panel bridge's `dockHint`). */
	dockHint: (panel: PanelId, region: string | null) => void;
	/** The panel that just docked back or landed, for a moment; marks where it went. */
	landed: string | null;
}

const isPanel = (id: string | undefined): id is PanelId =>
	id !== undefined && PANEL_SPECS.some((spec) => spec.id === id);

export function useTearOffDrag(input: TearOffDragInput): TearOffDrag {
	const { client, areaRef, dock, windows } = input;
	const [features, setFeatures] = useState<TearoffFeatures>(NO_TEAROFF);
	const [landed, setLanded] = useState<string | null>(null);
	const live = useRef({ ...input, features });
	live.current = { ...input, features };
	const regions = useRef<Region[]>([]);

	// Ask the plugin once what this desktop can do; the first answer can take a second.
	useEffect(() => {
		if (!client) return;
		let current = true;
		void client.features().then((found) => current && setFeatures(found));
		return () => {
			current = false;
		};
	}, [client]);

	// Register where a panel can land, again whenever the layout moves.
	const canTakeDrops = features.hitTest || features.toplevelDrag;
	const layoutKey = `${JSON.stringify(dock.workspace.zones)}|${dock.view.zones.left.collapsed}|${dock.window.w}x${dock.window.h}|${PANEL_SPECS.map((spec) => windows.away[spec.id] ?? false).join()}`;
	useEffect(() => {
		if (!client || !canTakeDrops) return;
		let current = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const measure = () => {
			const root = areaRef.current;
			if (!root || !current) return;
			regions.current = collectDropRegions(root);
			void client.setDropRegions(regions.current).catch(() => {});
		};
		const schedule = () => {
			clearTimeout(timer);
			timer = setTimeout(measure, REGION_DELAY_MS);
		};
		schedule();
		const root = areaRef.current;
		const observer =
			root && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
		if (root) observer?.observe(root);
		return () => {
			current = false;
			clearTimeout(timer);
			observer?.disconnect();
		};
	}, [client, canTakeDrops, areaRef, layoutKey]);

	const land = useCallback((panel: PanelId) => {
		setLanded(panel);
	}, []);
	useEffect(() => {
		if (landed === null) return;
		const timer = setTimeout(() => setLanded(null), LANDING_MS);
		return () => clearTimeout(timer);
	}, [landed]);

	/** Docks the panel where a release over a region meant. */
	const apply = useCallback(
		(panel: PanelId, target: RegionTarget) => {
			const { dock: layout, windows: wins, titleOf, say } = live.current;
			live.current.hover(panel, null);
			if (target.kind === 'zone') {
				layout.dropOn(panel, target.zone, target.group, target.index);
				say(t('dock.drag.docked', { title: titleOf(panel), zone: t(ZONE_LABELS[target.zone]) }));
			} else {
				// The level: the panel goes back to where it was before it was torn off.
				wins.dockBack(panel);
				say(t('tearoff.drag.dockedBack', { title: titleOf(panel) }));
			}
			land(panel);
		},
		[land],
	);

	const dockBackTo = useCallback<TearOffDrag['dockBackTo']>(
		(panel, zone, group, index) => apply(panel, { kind: 'zone', zone, group, index }),
		[apply],
	);

	const dockHint = useCallback<TearOffDrag['dockHint']>((panel, region) => {
		const target = parseRegion(region);
		const centre = target?.kind === 'zone' && region ? regionCentre(regions.current, region) : null;
		live.current.hover(panel, centre);
	}, []);

	// Where the compositor drags the panel's window, the plugin sends the hover and the drop here.
	useEffect(() => {
		if (!client || !features.toplevelDrag) return;
		const stops = [
			client.onDragHover((hover) => {
				const payload = readPanelDragPayload(hover.payload);
				if (payload && isPanel(payload.panel)) dockHint(payload.panel, hover.region);
			}),
			client.onDragLeave(() => {
				for (const spec of PANEL_SPECS) live.current.hover(spec.id, null);
			}),
			client.onPayloadDropped((dropped) => {
				const payload = readPanelDragPayload(dropped.payload);
				const target = parseRegion(dropped.region);
				if (!payload || !isPanel(payload.panel) || !target) return;
				apply(payload.panel, target);
			}),
		];
		return () => stops.forEach((stop) => stop());
	}, [client, features.toplevelDrag, apply, dockHint]);

	const onLeaveWindow = useCallback((info: LeaveWindowInfo): WindowExit | void => {
		const {
			client: plugin,
			features: known,
			dock: layout,
			windows: wins,
			titleOf,
			say,
		} = live.current;
		// Without the plugin the drag stays the page's own, and a release outside cancels it.
		if (!plugin || !isPanel(info.id)) return;
		const id = info.id;
		const entry = layout.workspace.panels[id];
		const spec = PANEL_SPECS.find((candidate) => candidate.id === id);
		return startTearDrag({
			client: plugin,
			features: known,
			info,
			title: titleOf(id),
			windowSize: {
				width: entry?.float.w ?? spec?.min.w ?? 320,
				height: entry?.float.h ?? spec?.min.h ?? 240,
			},
			remembered: entry?.window ?? null,
			hooks: {
				tearOff: (at) => wins.tearOff(id, at),
				openHidden: () => wins.tearOffHidden(id),
				discard: () => wins.dockBack(id),
				say,
			},
		});
	}, []);

	return { onLeaveWindow, dockBackTo, dockHint, landed };
}
