// The selection commands: Delete, Flip, Show in script and the four nudges, from the same list as everything else
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// They act on the thing Inspect or the Objects list selected. The editor publishes the handlers and
// the `selection` fact that says when each can run and, when one cannot, why. Their keys run only
// while the keyboard focus is where the selection is worked on: Delete and Flip on the canvas or in
// the Inspector, and the arrows on the canvas, where they move the thing rather than the cursor.

import type { MessageId } from '../i18n/messages';
import type { CommandFacts } from './commandBridge';
import { lockedReason } from './canvasCommands';
import type { CommandDef, CommandReason } from './registry';

export const SELECTION_DELETE = 'edit.delete';
export const SELECTION_SHOW_IN_SCRIPT = 'selection.showInScript';
export const SELECTION_FLIP = 'selection.flip';

export type Nudge = 'left' | 'right' | 'up' | 'down';
export const NUDGES: readonly Nudge[] = ['left', 'right', 'up', 'down'];
export const nudgeCommandId = (nudge: Nudge) => `selection.nudge.${nudge}`;

/** Where Delete and Flip work: the canvas and the Inspector. */
export const SELECTION_SCOPE = '[role=application], [data-inspector-scope]';
/** Where the arrows move the thing: the canvas, which keeps them for the cursor when no thing is selected. */
export const CANVAS_SCOPE = '[role=application]';

const ARROW_KEYS: Record<Nudge, string> = {
	left: 'ArrowLeft',
	right: 'ArrowRight',
	up: 'ArrowUp',
	down: 'ArrowDown',
};

const NUDGE_LABELS: Record<Nudge, MessageId> = {
	left: 'selection.nudgeLeft',
	right: 'selection.nudgeRight',
	up: 'selection.nudgeUp',
	down: 'selection.nudgeDown',
};

/** Why a thing cannot be changed: nothing is selected, or what the selection says. */
const whyNot = (facts: CommandFacts): MessageId =>
	facts.selection.kind === null || facts.selection.kind === 'cell'
		? 'selection.needsThing'
		: (facts.selection.reason ?? 'selection.needsThing');

/**
 * Delete and Flip are dimmed with the lock's reason while the thing's layer is locked and nothing
 * else rules the command out (`allowed`); the nudges still try, and Rust says why not.
 */
const whyBlocked = (
	facts: CommandFacts,
	allowed: boolean,
	otherwise: CommandReason,
): CommandReason =>
	allowed && facts.selection.lockedLayer !== null
		? lockedReason([facts.selection.lockedLayer], facts)
		: otherwise;

/** The selection commands. */
export function selectionCommands(): CommandDef[] {
	const editor = (facts: CommandFacts) => facts.editorOpen;
	return [
		{
			id: SELECTION_DELETE,
			menu: 'edit',
			icon: 'selection.delete',
			label: 'selection.delete',
			keys: [
				{ key: 'Delete', unlessTyping: true, within: SELECTION_SCOPE },
				{ key: 'Backspace', unlessTyping: true, within: SELECTION_SCOPE },
			],
			visible: editor,
			enabled: (facts) =>
				facts.editorOpen && facts.selection.canDelete && facts.selection.lockedLayer === null,
			reason: (facts) =>
				whyBlocked(
					facts,
					facts.selection.canDelete,
					facts.selection.kind === 'start' ? 'inspector.deleteStart' : whyNot(facts),
				),
		},
		{
			id: SELECTION_FLIP,
			group: 'edit',
			icon: 'selection.flip',
			label: 'selection.flip',
			keys: [{ key: 'f', unlessTyping: true, within: SELECTION_SCOPE }],
			visible: editor,
			enabled: (facts) =>
				facts.editorOpen && facts.selection.canFlip && facts.selection.lockedLayer === null,
			reason: (facts) =>
				whyBlocked(
					facts,
					facts.selection.canFlip,
					facts.selection.kind === 'item' || facts.selection.kind === 'start'
						? 'selection.noFacing'
						: whyNot(facts),
				),
		},
		{
			id: SELECTION_SHOW_IN_SCRIPT,
			menu: 'edit',
			icon: 'selection.showInScript',
			label: 'inspector.showInScript',
			keys: [{ key: 'j', mod: true }],
			visible: editor,
			enabled: (facts) => facts.editorOpen && facts.selection.hasLine,
			reason: () => 'selection.needsLine',
		},
		...NUDGES.map(
			(nudge): CommandDef => ({
				id: nudgeCommandId(nudge),
				group: 'edit',
				label: NUDGE_LABELS[nudge],
				keys: [{ key: ARROW_KEYS[nudge], within: CANVAS_SCOPE }],
				visible: editor,
				enabled: (facts) => facts.editorOpen && facts.selection.editable,
				reason: whyNot,
			}),
		),
	];
}
