// The New level form as plain data: the slug, the checks, and the request they make
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelTarget } from '@liminal-hq/fizz-studio-protocol/generated/LevelTarget';
import type { NewLevelRequest } from '@liminal-hq/fizz-studio-protocol/generated/NewLevelRequest';
import type { MessageId } from '../i18n/messages';

/** The Fizz 1 theme words, as the language crate knows them (`THEMES` in its tables). */
export const THEMES = [
	'crater',
	'caves',
	'citadel',
	'open-sky',
	'building',
	'theatre',
	'shaft',
	'foundry',
] as const;

export const MIN_WIDTH = 8;
export const MAX_WIDTH = 1024;
export const MIN_HEIGHT = 8;
export const MAX_HEIGHT = 128;

/** What the person has typed. The sizes stay text until they are checked. */
export interface NewLevelForm {
	name: string;
	id: string;
	/** True once the person has typed in the id, so the name stops filling it. */
	idEdited: boolean;
	width: string;
	height: string;
	target: LevelTarget;
	/** A theme word, or an empty string for none. Fizz 1 only. */
	theme: string;
	folder: string;
}

export type FormErrors = Partial<Record<'name' | 'id' | 'width' | 'height' | 'folder', MessageId>>;

export const initialForm: NewLevelForm = {
	name: '',
	id: '',
	idEdited: false,
	width: '128',
	height: '32',
	target: 'fizz1',
	theme: '',
	folder: '',
};

/** A name as a slug: lowercase letters, digits, and single hyphens, with accents dropped. */
export function slugify(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Whether `id` is a slug the Rust side accepts. */
export function isSlug(id: string): boolean {
	return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
}

/** Types a name; the id follows it until the person has edited the id. */
export function withName(form: NewLevelForm, name: string): NewLevelForm {
	return { ...form, name, id: form.idEdited ? form.id : slugify(name) };
}

/** Types an id. Clearing it hands the id back to the name, which fills it on its next change. */
export function withId(form: NewLevelForm, id: string): NewLevelForm {
	return id === '' ? { ...form, id: '', idEdited: false } : { ...form, id, idEdited: true };
}

function wholeNumber(text: string): number | null {
	return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** The problems with the form, by field; an empty object means it can be created. */
export function validateForm(form: NewLevelForm): FormErrors {
	const errors: FormErrors = {};
	if (form.name.trim() === '') errors.name = 'newLevel.error.nameEmpty';
	else if (/["\r\n]/.test(form.name)) errors.name = 'newLevel.error.nameChars';
	if (!isSlug(form.id)) errors.id = 'newLevel.error.id';
	const width = wholeNumber(form.width);
	if (width === null || width < MIN_WIDTH || width > MAX_WIDTH) {
		errors.width = 'newLevel.error.width';
	}
	const height = wholeNumber(form.height);
	if (height === null || height < MIN_HEIGHT || height > MAX_HEIGHT) {
		errors.height = 'newLevel.error.height';
	}
	if (form.folder === '') errors.folder = 'newLevel.error.folder';
	return errors;
}

/** The request for a valid form. The theme goes only to a Fizz 1 level. */
export function toRequest(form: NewLevelForm): NewLevelRequest {
	return {
		name: form.name.trim(),
		id: form.id,
		width: Number(form.width),
		height: Number(form.height),
		ground: null,
		theme: form.target === 'fizz1' && form.theme !== '' ? form.theme : null,
		target: form.target,
		folder: form.folder,
	};
}
