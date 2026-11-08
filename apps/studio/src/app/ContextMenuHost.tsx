// The one context menu of a window: it opens what a surface asks for, and blocks the webview's own menu everywhere else
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Surfaces work out their target and call `open` (`useContextMenu`); this host owns the rest, once
// per window and at the root of the app, so the menu's portal never bubbles into a canvas or a drag
// handler. Three `contextmenu` listeners sit on the document:
//
// - **Capture:** a `contextmenu` that follows a keyboard open by a moment (WebView2 fires one on the
//   Menu key and on Shift+F10) is only prevented. Nothing opens while a stroke, a pan or a drag is
//   running (`data-context-busy`). Shift+right-click in a debug build, where Rust leaves the native
//   menu to the webview (`native_menu.rs`), stops here so no surface handles it and Inspect Element
//   stays reachable. A release build never sets that, and the prevent-default plugin blocks the
//   menu there whatever the page does.
// - **React:** the surfaces' own `onContextMenu` handlers.
// - **Bubble:** what no surface took. A text field gets the text-field menu, the script editor gets
//   the script menu, anything else is prevented and opens nothing.
//
// The rows are rebuilt from the command bridge while the menu is open, so a lock or a selection that
// changes under it shows at once. The menu opens on the bridge's first update after the open, or
// after one frame, whichever comes first: the editor publishes the selection in an effect, and the
// first frame would otherwise show the rows the selection had before.

import { ContextMenu } from '@liminal-hq/fizz-studio-chrome/ContextMenu';
import type {
	MenuPosition,
	SelectableMenuItem,
} from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { EditorView } from '@codemirror/view';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
	type ReactNode,
} from 'react';
import { commandIdOfRow } from '../commands/appMenuModel';
import { CommandBridgeContext, type CommandBridge } from '../commands/commandBridge';
import { buildContextMenu, contextMenuLabel } from '../commands/contextMenuModel';
import type { ContextTarget } from '../commands/contextTargets';
import { runCommand } from '../commands/registry';
import { textFieldIdOf } from '../commands/textFieldMenu';
import { clipboardClient, type ClipboardClient } from '../services/clipboardClient';
import { nativeMenuClient, type NativeMenuClient } from '../services/nativeMenuClient';
import { isContextBusy } from './contextBusy';
import {
	ContextMenuContext,
	isContextMenuKey,
	KEYBOARD_OPEN_GRACE_MS,
	type ContextMenuApi,
	type ContextMenuOptions,
} from './useContextMenu';
import {
	runTextFieldAction,
	textFieldOf,
	textFieldTarget,
	type TextFieldElement,
} from './textField';

interface Opened {
	serial: number;
	target: ContextTarget;
	at: MenuPosition;
	keyboard: boolean;
	returnFocusTo: HTMLElement | null;
	/** The field a text-field menu acts on. */
	field: TextFieldElement | null;
	/** The menu waits for the bridge or a frame, so its first rows are the current ones. */
	ready: boolean;
}

export interface ContextMenuHostProps {
	/** The window's command bridge: its facts and handlers are what the rows are built from and run. */
	bridge: CommandBridge;
	children: ReactNode;
	/** Rust's decision on the native menu; the app's by default. */
	nativeMenu?: NativeMenuClient;
	/** The clipboard, read for a text field's Paste; the app's by default. */
	clipboard?: ClipboardClient;
}

/** Where a menu opened from the keyboard hangs: the corner of the element, or `at` itself. */
function positionOf(at: MenuPosition | HTMLElement): MenuPosition {
	if (!(at instanceof HTMLElement)) return at;
	const box = at.getBoundingClientRect();
	return { x: box.left, y: box.bottom };
}

/** The script editor's view and the region the pointer or the key is in. */
function scriptContext(element: Element): { region: 'text' | 'gutter' | 'hover' } | null {
	if (element.closest('.cm-tooltip')) return { region: 'hover' };
	if (!element.closest('.cm-editor')) return null;
	return { region: element.closest('.cm-gutters') ? 'gutter' : 'text' };
}

export function ContextMenuHost({
	bridge,
	children,
	nativeMenu = nativeMenuClient,
	clipboard = clipboardClient,
}: ContextMenuHostProps) {
	const [opened, setOpened] = useState<Opened | null>(null);
	const serial = useRef(0);
	const keyboardAt = useRef(Number.NEGATIVE_INFINITY);
	const nativeAllowed = useRef(false);
	const bridgeRef = useRef(bridge);
	bridgeRef.current = bridge;
	const clipboardRef = useRef(clipboard);
	clipboardRef.current = clipboard;

	useEffect(() => {
		let live = true;
		void nativeMenu.allowed().then((allowed) => {
			if (live) nativeAllowed.current = allowed;
		});
		return () => {
			live = false;
		};
	}, [nativeMenu]);

	const show = useCallback(
		(
			target: ContextTarget,
			at: MenuPosition | HTMLElement,
			options: ContextMenuOptions = {},
			field: TextFieldElement | null = null,
		) => {
			if (isContextBusy()) return;
			const keyboard = options.keyboard === true;
			if (keyboard) {
				// One keyboard open per press: the surface's handler, the Shift+F10 command and this host's own
				// key listener all see the same key.
				if (Date.now() - keyboardAt.current < KEYBOARD_OPEN_GRACE_MS) return;
			}
			// A target with no rows has no menu: nothing opens.
			if (buildContextMenu(target, bridgeRef.current.getSnapshot()).length === 0) return;
			if (keyboard) keyboardAt.current = Date.now();
			const returnFocusTo = options.returnFocusTo ?? null;
			// Focus goes to the target first, so closing the menu gives it back and the keys scoped to it
			// (`within`) keep working.
			returnFocusTo?.focus({ preventScroll: true });
			serial.current += 1;
			setOpened({
				serial: serial.current,
				target,
				at: positionOf(at),
				keyboard,
				returnFocusTo,
				field,
				ready: false,
			});
		},
		[],
	);

	const api = useMemo<ContextMenuApi>(
		() => ({
			open: (target, at, options) => show(target, at, options),
			update: (target) =>
				setOpened((was) => (was && was.target.kind === target.kind ? { ...was, target } : was)),
			close: () => setOpened(null),
		}),
		[show],
	);

	/** Opens the menu of the text field or script editor that has the focus, from the keyboard; false when neither does. */
	const openFromFocus = useCallback((): boolean => {
		const element = document.activeElement;
		if (!(element instanceof HTMLElement)) return false;
		const field = textFieldOf(element);
		if (field) {
			show(textFieldTarget(field), field, { keyboard: true, returnFocusTo: field }, field);
			return true;
		}
		const script = scriptContext(element);
		if (script) {
			const view = EditorView.findFromDOM(element.closest<HTMLElement>('.cm-editor')!);
			const head = view?.state.selection.main.head ?? 0;
			const caret = view?.coordsAtPos(head);
			show(
				{
					kind: 'scriptEditor',
					region: 'text',
					hasSelection: view ? !view.state.selection.main.empty : false,
				},
				caret ? { x: caret.left, y: caret.bottom } : element,
				{ keyboard: true, returnFocusTo: view?.contentDOM ?? element },
			);
			return true;
		}
		return false;
	}, [show]);

	// The native menu is blocked here, in three places (see the header).
	useEffect(() => {
		const onCapture = (event: MouseEvent) => {
			const inMenu =
				event.target instanceof Element && event.target.closest('[data-fls-menu-root]');
			if (Date.now() - keyboardAt.current < KEYBOARD_OPEN_GRACE_MS || isContextBusy()) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (event.shiftKey && nativeAllowed.current && !inMenu) event.stopPropagation();
		};
		const onBubble = (event: MouseEvent) => {
			if (event.defaultPrevented) return;
			event.preventDefault();
			const target = event.target;
			if (!(target instanceof Element) || target.closest('[data-fls-menu-root]')) return;
			const at = { x: event.clientX, y: event.clientY };
			const field = textFieldOf(target);
			if (field) {
				show(textFieldTarget(field), at, { returnFocusTo: field }, field);
				return;
			}
			const script = scriptContext(target);
			if (script) {
				const editor = target.closest<HTMLElement>('.cm-editor');
				const view = editor ? EditorView.findFromDOM(editor) : null;
				const selection = window.getSelection();
				show(
					{
						kind: 'scriptEditor',
						region: script.region,
						hasSelection: view
							? !view.state.selection.main.empty
							: !!selection && !selection.isCollapsed,
					},
					at,
					{ returnFocusTo: view?.contentDOM ?? null },
				);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || !isContextMenuKey(event)) return;
			if (openFromFocus()) event.preventDefault();
		};
		document.addEventListener('contextmenu', onCapture, true);
		document.addEventListener('contextmenu', onBubble);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('contextmenu', onCapture, true);
			document.removeEventListener('contextmenu', onBubble);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [show, openFromFocus]);

	// Exposed for the `view.contextMenu` command, which the window publishes into its bridge.
	useEffect(
		() => bridge.setHandlers({ 'view.contextMenu': () => void openFromFocus() }),
		[bridge, openFromFocus],
	);

	return (
		<ContextMenuContext.Provider value={api}>
			<CommandBridgeContext.Provider value={bridge}>{children}</CommandBridgeContext.Provider>
			{opened && (
				<OpenMenu
					key={opened.serial}
					bridge={bridge}
					opened={opened}
					clipboard={clipboard}
					onReady={() =>
						setOpened((was) =>
							was && was.serial === opened.serial ? { ...was, ready: true } : was,
						)
					}
					onClose={() => setOpened(null)}
				/>
			)}
		</ContextMenuContext.Provider>
	);
}

interface OpenMenuProps {
	bridge: CommandBridge;
	opened: Opened;
	clipboard: ClipboardClient;
	onReady: () => void;
	onClose: () => void;
}

/** The menu while it is open: rows rebuilt from the bridge, a choice run as a command or as a field action. */
function OpenMenu({ bridge, opened, clipboard, onReady, onClose }: OpenMenuProps) {
	const readyRef = useRef(onReady);
	readyRef.current = onReady;
	const snapshot = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot);
	const { target, ready } = opened;
	const items = useMemo(() => buildContextMenu(target, snapshot), [target, snapshot]);

	// Wait for the bridge's next update or one frame, whichever is first.
	useEffect(() => {
		if (ready) return;
		let done = false;
		const go = () => {
			if (done) return;
			done = true;
			readyRef.current();
		};
		const stop = bridge.subscribe(go);
		const frame =
			typeof requestAnimationFrame === 'function'
				? requestAnimationFrame(go)
				: window.setTimeout(go, 0);
		return () => {
			done = true;
			stop();
			if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
			else window.clearTimeout(frame);
		};
	}, [ready, bridge]);

	// A menu whose rows have gone (the last one went, the level closed) closes.
	const empty = items.length === 0;
	useEffect(() => {
		if (empty && ready) onClose();
	}, [empty, ready, onClose]);

	const onSelect = (item: SelectableMenuItem) => {
		if (target.kind === 'textField') {
			const action = textFieldIdOf(item.id);
			if (action && opened.field) void runTextFieldAction(opened.field, action, clipboard);
			return;
		}
		runCommand(commandIdOfRow(item.id), bridge.getSnapshot());
	};

	if (!ready || empty) return null;
	return (
		<ContextMenu
			items={items}
			position={opened.at}
			ariaLabel={contextMenuLabel(target)}
			returnFocusTo={opened.returnFocusTo ?? opened.field}
			openedWithKeyboard={opened.keyboard}
			onSelect={onSelect}
			onClose={onClose}
		/>
	);
}
