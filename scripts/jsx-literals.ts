// Finds visible string literals in JSX source, which belong in the message catalogue instead
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import ts from 'typescript';

/** Attributes whose string value a person sees or hears. */
export const VISIBLE_ATTRIBUTES: ReadonlySet<string> = new Set([
	'title',
	'label',
	'placeholder',
	'alt',
	'aria-label',
	'aria-description',
	'aria-placeholder',
	'aria-roledescription',
	'aria-valuetext',
]);

export interface JsxLiteral {
	line: number;
	column: number;
	/** What kind of place the literal is in: `text`, `expression` or the attribute's name. */
	where: string;
	text: string;
}

/** Whether `text` has a letter in it; punctuation and symbols alone (`·`, `—`, `|`) are not copy. */
function hasLetter(text: string): boolean {
	return /\p{L}/u.test(text);
}

function isStringLike(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
	return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/** The visible string literals in `source`, in file order. */
export function findJsxLiterals(source: string, fileName = 'component.tsx'): JsxLiteral[] {
	const file = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.ES2022,
		true,
		ts.ScriptKind.TSX,
	);
	const found: JsxLiteral[] = [];

	const report = (node: ts.Node, where: string, text: string): void => {
		const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
		found.push({ line: line + 1, column: character + 1, where, text: text.trim() });
	};

	const visit = (node: ts.Node): void => {
		if (ts.isJsxText(node)) {
			if (hasLetter(node.text)) report(node, 'text', node.text.replace(/\s+/g, ' '));
		} else if (ts.isJsxAttribute(node)) {
			const name = node.name.getText(file);
			const value = node.initializer;
			if (VISIBLE_ATTRIBUTES.has(name) && value) {
				const literal = ts.isJsxExpression(value) ? value.expression : value;
				if (literal && isStringLike(literal) && hasLetter(literal.text)) {
					report(literal, name, literal.text);
				}
			}
		} else if (ts.isJsxExpression(node) && node.expression && isStringLike(node.expression)) {
			// `{'text'}` as a child; an attribute's own expression is handled with the attribute.
			if (!ts.isJsxAttribute(node.parent) && hasLetter(node.expression.text)) {
				report(node.expression, 'expression', node.expression.text);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
}
