// The Script panel's tab strip: the open scripts as tabs in the panel's header
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { ContextMenu } from '@liminal-hq/fizz-studio-chrome/ContextMenu';
import type { MenuItem, MenuPosition } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type PointerEvent,
} from 'react';
import { t } from '../../i18n/messages';
import { MoreIcon } from '../../icons/AppIcons';
import { Tooltip } from '../../ui/Tooltip';
import styles from './ScriptTabStrip.module.css';
import { tabAfterKey, type ScriptTab } from './scriptTabs';

export interface ScriptTabStripProps {
	tabs: readonly ScriptTab[];
	/** The id of the tab whose script the panel shows. */
	active: string;
	/** A tab was chosen: it shows its script, or brings its window forward when it is away. */
	onActivate: (id: string) => void;
	/** A tab's close button, or Ctrl+W on it. */
	onClose: (id: string) => void;
	/** A press on a tab that may become a drag out of the header. */
	onTabDragStart?: (event: PointerEvent<HTMLElement>, tabId: string) => void;
	/** The header is narrow (a side dock): tabs keep a minimum width, scroll, and a "More tabs" menu lists them all. */
	narrow?: boolean;
	/** The id of the panel body the tabs control. */
	controls?: string;
	/** Tests, which have no layout: says the tabs overflow. */
	forceOverflow?: boolean;
}

/** True while the element's content is wider than the element. */
function useOverflow(ref: { current: HTMLElement | null }, watch: unknown): boolean {
	const [over, setOver] = useState(false);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => setOver(el.scrollWidth > el.clientWidth + 1);
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref, watch]);
	return over;
}

/**
 * A `tablist` of the open scripts. Only the active tab is in the tab order (roving `tabindex`):
 * Left, Right, Home and End move between tabs, Ctrl+W on a tab closes it (so it never reaches
 * the app's Close level key). The close button is out of the tab order and named for what it does,
 * saying so when the script has unsaved changes, where it also turns into a dot. A yellow dot marks
 * the level script and a blue one a behaviour script.
 */
export function ScriptTabStrip({
	tabs,
	active,
	onActivate,
	onClose,
	onTabDragStart,
	narrow = false,
	controls,
	forceOverflow = false,
}: ScriptTabStripProps) {
	const list = useRef<HTMLDivElement>(null);
	const more = useRef<HTMLButtonElement>(null);
	const overflowing = useOverflow(list, tabs) || forceOverflow;
	const [menu, setMenu] = useState<{ position: MenuPosition; viaKeyboard: boolean } | null>(null);
	const focusAfter = useRef<string | null>(null);

	// After a key moves the choice the roving tab is drawn again; give it the focus.
	useEffect(() => {
		const id = focusAfter.current;
		if (id === null) return;
		focusAfter.current = null;
		list.current?.querySelector<HTMLElement>(`[data-script-tab="${CSS.escape(id)}"]`)?.focus();
	});

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: ScriptTab) => {
		if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'w') {
			event.preventDefault();
			event.stopPropagation();
			onClose(tab.id);
			return;
		}
		const to = tabAfterKey(tabs, tab.id, event.key);
		if (to === null) return;
		event.preventDefault();
		focusAfter.current = to;
		onActivate(to);
		list.current?.querySelector<HTMLElement>(`[data-script-tab="${CSS.escape(to)}"]`)?.focus();
	};

	const showMore = (viaKeyboard: boolean) => {
		const box = more.current?.getBoundingClientRect();
		setMenu({ position: { x: box?.left ?? 0, y: box?.bottom ?? 0 }, viaKeyboard });
	};
	const moreItems: MenuItem[] = tabs.map((tab) => ({
		type: 'checkbox',
		id: tab.id,
		label: tab.title,
		checked: tab.id === active,
	}));

	return (
		<div className={styles.strip} data-narrow={narrow || undefined}>
			<div
				ref={list}
				className={styles.tabs}
				role="tablist"
				aria-label={t('scriptTabs.label')}
				aria-orientation="horizontal"
			>
				{tabs.map((tab) => {
					const selected = tab.id === active;
					const closeName = t(tab.dirty ? 'scriptTabs.closeDirty' : 'scriptTabs.close', {
						name: tab.title,
					});
					return (
						<div
							key={tab.id}
							className={styles.tab}
							data-active={selected || undefined}
							data-away={tab.away || undefined}
						>
							<Tooltip label={tab.away ? t('scriptTabs.away', { name: tab.title }) : tab.title}>
								<button
									type="button"
									role="tab"
									className={styles.label}
									data-script-tab={tab.id}
									aria-selected={selected}
									aria-controls={controls}
									tabIndex={selected ? 0 : -1}
									onClick={() => onActivate(tab.id)}
									onKeyDown={(event) => onKeyDown(event, tab)}
									onPointerDown={(event) => onTabDragStart?.(event, tab.id)}
								>
									<span className={styles.dot} data-kind={tab.kind} aria-hidden="true" />
									<span className={styles.name}>{tab.title}</span>
								</button>
							</Tooltip>
							<Tooltip label={closeName}>
								<button
									type="button"
									className={styles.close}
									data-keycap-exempt=""
									data-dirty={tab.dirty || undefined}
									tabIndex={-1}
									aria-label={closeName}
									onClick={() => onClose(tab.id)}
								>
									<svg
										aria-hidden="true"
										width="12"
										height="12"
										viewBox="0 0 16 16"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.6"
										strokeLinecap="round"
									>
										{tab.dirty ? (
											<circle cx="8" cy="8" r="3.2" fill="currentColor" />
										) : (
											<path d="M4 4l8 8M12 4l-8 8" />
										)}
									</svg>
								</button>
							</Tooltip>
						</div>
					);
				})}
			</div>
			{narrow && overflowing && (
				<>
					<Tooltip label={t('scriptTabs.more')}>
						<button
							ref={more}
							type="button"
							className={styles.more}
							data-keycap-exempt=""
							aria-haspopup="menu"
							aria-expanded={menu !== null}
							aria-label={t('scriptTabs.more')}
							onClick={(event) => (menu ? setMenu(null) : showMore(event.detail === 0))}
						>
							<MoreIcon size={14} />
						</button>
					</Tooltip>
					{menu && (
						// The menu is drawn in a portal, but React bubbles its pointer events through the header.
						<span
							onPointerDown={(event) => event.stopPropagation()}
							onPointerUp={(event) => event.stopPropagation()}
						>
							<ContextMenu
								items={moreItems}
								position={menu.position}
								ariaLabel={t('scriptTabs.more')}
								returnFocusTo={more.current}
								openedWithKeyboard={menu.viaKeyboard}
								onSelect={(item) => onActivate(item.id)}
								onClose={() => setMenu(null)}
							/>
						</span>
					)}
				</>
			)}
		</div>
	);
}
