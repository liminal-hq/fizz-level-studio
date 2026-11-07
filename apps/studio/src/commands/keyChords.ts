// Key chords: how a command names its keys, how they are shown and how a key press is matched to one
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** One key press that runs a command. The first chord of a command is the one its rows show. */
export interface KeyChord {
	/** The `KeyboardEvent.key`: a letter in lower case, or a name such as `F1`, `=` or `,`. */
	key: string;
	/** Ctrl, or Command on a Mac. */
	mod?: boolean;
	/** Shift must be held (true), must not be (false or absent), or does not matter (`'any'`, for keys such as `?`). */
	shift?: boolean | 'any';
	/** The chord pauses while the keyboard focus is in a box the person types in (a bare key is a character there). */
	unlessTyping?: boolean;
	/** The chord is handled in the capture phase, ahead of the script editor, so it works with focus in the editor. */
	capture?: boolean;
}

export type KeyEventLike = Pick<
	KeyboardEvent,
	'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'target'
>;

/** True when the key lands in a box the person types in, where a bare key is a character. */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	if (target.closest('input, textarea, select')) return true;
	const editable = target.closest('[contenteditable]');
	return editable !== null && editable.getAttribute('contenteditable') !== 'false';
}

/** True when the key press is this chord. */
export function chordMatches(event: KeyEventLike, chord: KeyChord): boolean {
	if (event.altKey) return false;
	if ((event.ctrlKey || event.metaKey) !== (chord.mod === true)) return false;
	if (chord.shift !== 'any' && event.shiftKey !== (chord.shift === true)) return false;
	if (event.key.toLowerCase() !== chord.key.toLowerCase()) return false;
	return !(chord.unlessTyping && isTypingTarget(event.target));
}

/** The chord as the rows show it: `Ctrl+Shift+P`, `F1`, `?`. A single letter is shown in capitals. */
export function formatChord(chord: KeyChord): string {
	const key = chord.key.length === 1 ? chord.key.toUpperCase() : chord.key;
	return [chord.mod ? 'Ctrl' : '', chord.shift === true ? 'Shift' : '', key]
		.filter(Boolean)
		.join('+');
}
