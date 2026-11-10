// The ⋮ button in a panel's header, and the menu it opens: where the panel sits, how it leaves, the layout
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { ContextMenu } from '@liminal-hq/fizz-studio-chrome/ContextMenu';
import type {
	MenuItem,
	MenuPosition,
	SelectableMenuItem,
} from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../../i18n/messages';
import { MoreIcon } from '../../icons/AppIcons';
import { Tooltip } from '../../ui/Tooltip';
import styles from './PanelMenuButton.module.css';

/** The rows of a panel's menu and what choosing one does, as the dock asks for them by panel. */
export interface PanelMenu {
	items: MenuItem[];
	onSelect: (item: { id: string }) => void;
}

export interface PanelMenuButtonProps {
	/** The panel's title, which names the button. */
	title: string;
	/** The rows, built by `panelMenuItems` from the registry's commands. */
	items: MenuItem[];
	/** Choosing a row runs its command; the menu closes on its own. */
	onSelect: (item: { id: string }) => void;
}

/**
 * A vertical ⋮ keycap that opens the panel's own menu, as a menu button should: it says it opens a
 * menu (`aria-haspopup`, `aria-expanded`), Enter, Space and the Down arrow open it with its first row
 * focused, a click opens it under the pointer's button, and Escape closes it and returns the focus
 * here. The rows are plain data, so the menu is the same component as the application menu's.
 */
export function PanelMenuButton({ title, items, onSelect }: PanelMenuButtonProps) {
	const button = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState<{ position: MenuPosition; viaKeyboard: boolean } | null>(null);
	// The press that closes an open menu is outside it, so the click after it must not open it again.
	const wasOpen = useRef(false);

	const show = (viaKeyboard: boolean) => {
		const box = button.current?.getBoundingClientRect();
		setOpen({ position: { x: box?.left ?? 0, y: box?.bottom ?? 0 }, viaKeyboard });
	};

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			show(true);
		}
	};

	const name = t('dock.menu.button', { title });
	return (
		<>
			<Tooltip label={name}>
				<button
					ref={button}
					type="button"
					className={styles.key}
					aria-label={name}
					aria-haspopup="menu"
					aria-expanded={open !== null}
					data-panel-menu=""
					onPointerDown={() => {
						wasOpen.current = open !== null;
					}}
					onKeyDown={onKeyDown}
					onClick={(event) => {
						const closing = wasOpen.current || open !== null;
						wasOpen.current = false;
						if (closing) setOpen(null);
						// A click with no pointer behind it (Enter or Space) is the keyboard's.
						else show(event.detail === 0);
					}}
				>
					<MoreIcon size={14} />
				</button>
			</Tooltip>
			{open && (
				// The menu is drawn in a portal, but React bubbles its pointer events through the
				// header, which would take a press on a row for the start of a drag. The span has no box
				// of its own (`menuHost`): in the header's flex row a boxed, empty span was one more
				// item and its gap pushed the button left by the gap's width when the menu opened.
				<span
					className={styles.menuHost}
					onPointerDown={(event) => event.stopPropagation()}
					onPointerMove={(event) => event.stopPropagation()}
					onPointerUp={(event) => event.stopPropagation()}
					onPointerCancel={(event) => event.stopPropagation()}
				>
					<ContextMenu
						items={items}
						position={open.position}
						ariaLabel={name}
						returnFocusTo={button.current}
						openedWithKeyboard={open.viaKeyboard}
						onSelect={(item: SelectableMenuItem) => onSelect(item)}
						onClose={() => setOpen(null)}
					/>
				</span>
			)}
		</>
	);
}
