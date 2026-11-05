// Tests for the New level form: the slug, the checks, and the request
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	initialForm,
	isSlug,
	slugify,
	THEMES,
	toRequest,
	validateForm,
	withId,
	withName,
	type NewLevelForm,
} from './newLevelForm';

const valid: NewLevelForm = {
	...initialForm,
	name: 'Sugar Hill',
	id: 'sugar-hill',
	folder: '/levels',
};

describe('slugify', () => {
	it('lowercases, drops accents, and joins words with single hyphens', () => {
		expect(slugify('Sugar Hill')).toBe('sugar-hill');
		expect(slugify('  Café  --  Crème! ')).toBe('cafe-creme');
		expect(slugify('Level 2')).toBe('level-2');
		expect(slugify('???')).toBe('');
	});

	it('makes only what isSlug accepts', () => {
		expect(isSlug(slugify('Frosting Frontier #3'))).toBe(true);
		expect(isSlug('Sugar')).toBe(false);
		expect(isSlug('-a')).toBe(false);
		expect(isSlug('a--b')).toBe(false);
		expect(isSlug('')).toBe(false);
	});
});

describe('the id', () => {
	it('follows the name until it is edited', () => {
		let form = withName(initialForm, 'Sugar');
		expect(form.id).toBe('sugar');
		form = withId(form, 'sweet');
		form = withName(form, 'Sugar Hill');
		expect(form.id).toBe('sweet');
	});

	it('goes back to following the name when it is cleared', () => {
		let form = withId(withName(initialForm, 'Sugar'), 'sweet');
		form = withId(form, '');
		expect(form.id).toBe('');
		expect(withName(form, 'Hill').id).toBe('hill');
	});
});

describe('validateForm', () => {
	it('accepts a complete form', () => {
		expect(validateForm(valid)).toEqual({});
	});

	it('names each problem by field', () => {
		const errors = validateForm({
			...valid,
			name: ' ',
			id: 'Bad Id',
			width: '7',
			height: '129',
			folder: '',
		});
		expect(errors).toEqual({
			name: 'newLevel.error.nameEmpty',
			id: 'newLevel.error.id',
			width: 'newLevel.error.width',
			height: 'newLevel.error.height',
			folder: 'newLevel.error.folder',
		});
	});

	it('refuses quotation marks and line breaks in the name', () => {
		expect(validateForm({ ...valid, name: 'Say "hi"' }).name).toBe('newLevel.error.nameChars');
		expect(validateForm({ ...valid, name: 'a\nb' }).name).toBe('newLevel.error.nameChars');
	});

	it('takes the edges of the size ranges and refuses text', () => {
		expect(validateForm({ ...valid, width: '8', height: '8' })).toEqual({});
		expect(validateForm({ ...valid, width: '1024', height: '128' })).toEqual({});
		expect(validateForm({ ...valid, width: '1025' }).width).toBeDefined();
		expect(validateForm({ ...valid, width: 'ten' }).width).toBeDefined();
		expect(validateForm({ ...valid, height: '' }).height).toBeDefined();
	});
});

describe('toRequest', () => {
	it('sends the theme only for a Fizz 1 level', () => {
		const fizz1 = toRequest({ ...valid, theme: 'caves' });
		expect(fizz1).toMatchObject({ target: 'fizz1', theme: 'caves', width: 128, height: 32 });
		expect(toRequest({ ...valid, target: 'fizz2', theme: 'caves' }).theme).toBeNull();
		expect(toRequest(valid).theme).toBeNull();
	});

	it('trims the name and keeps the folder', () => {
		expect(toRequest({ ...valid, name: '  Sugar Hill ' })).toMatchObject({
			name: 'Sugar Hill',
			folder: '/levels',
		});
	});
});

describe('THEMES', () => {
	it('lists the eight theme words', () => {
		expect(THEMES).toHaveLength(8);
		expect(THEMES).toContain('open-sky');
	});
});
