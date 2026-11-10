// The rows of a context menu: one dispatcher from a target to the builder that knows its surface
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Every row is a registry command (`commandRow(viewOf(...))`) except the text field's, so labels,
// shortcuts, availability and disabled reasons come from the same place as the menus and the palette.
// A builder returns no rows where its target has no menu, and the host then opens nothing.

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { PANEL_SPECS } from '../panels/float/panelSpecs';
import { t } from '../i18n/messages';
import { canvasMenuItems } from './canvasMenu';
import { chromeMenuItems } from './chromeMenus';
import type { BridgeSnapshot } from './commandBridge';
import type { ContextTarget } from './contextTargets';
import { layerName } from '../panels/layers/layerNames';
import { scriptMenuItems } from './scriptMenu';
import { textFieldMenuItems } from './textFieldMenu';

/** The word with its first letter capitalised, for a header or a menu's name. */
export function capitalised(word: string): string {
	return word === '' ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The rows of the menu for `target`, from the command bridge's facts and handlers as they are now.
 * The host calls this again on every bridge update while the menu is open, so rows stay current.
 * An empty list means the target has no menu now (a Layers row on a Fizz 2 level): nothing opens.
 */
export function buildContextMenu(target: ContextTarget, snapshot: BridgeSnapshot): MenuItem[] {
	switch (target.kind) {
		case 'canvas':
		case 'objectRow':
		case 'layerRow':
			return canvasMenuItems(target, snapshot);
		case 'panel':
		case 'scriptTab':
		case 'commandsRow':
		case 'workspace':
		case 'zoom':
		case 'tools':
		case 'history':
		case 'brush':
			return chromeMenuItems(target, snapshot);
		case 'scriptEditor':
			return scriptMenuItems(target, snapshot);
		case 'textField':
			return textFieldMenuItems(target);
	}
}

/** The menu's accessible name, such as "Gloop menu" or "Treats layer menu": the host passes it as the menu's `ariaLabel`. */
export function contextMenuLabel(target: ContextTarget): string {
	switch (target.kind) {
		case 'canvas':
			return target.thing.kind === 'cell'
				? t('context.menu.cell')
				: t('context.menu.thing', { name: capitalised(target.thing.name) });
		case 'objectRow':
			return t('context.menu.thing', { name: capitalised(target.thing.name) });
		case 'layerRow':
			return t('context.menu.layer', {
				layer: layerName({ id: target.layer, label: target.layer }),
			});
		case 'brush':
			return t('context.menu.brush', { brush: target.brush.kind });
		case 'panel': {
			const spec = PANEL_SPECS.find((candidate) => candidate.id === target.panel);
			return t('context.menu.panel', { title: spec ? t(spec.title) : target.panel });
		}
		case 'scriptTab':
			return t('context.menu.scriptTab');
		case 'scriptEditor':
			return t('context.menu.script');
		case 'commandsRow':
			return t('context.menu.commands');
		case 'workspace':
			return t('context.menu.workspace');
		case 'zoom':
			return t('context.menu.zoom');
		case 'tools':
			return t('context.menu.tools');
		case 'history':
			return t('context.menu.history');
		case 'textField':
			return t('context.menu.textField');
	}
}
