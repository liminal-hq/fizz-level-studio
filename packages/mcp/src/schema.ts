// A small JSON Schema checker for tool input: the subset the tool schemas in this package use.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export interface Schema {
	type?: 'object' | 'string' | 'integer' | 'number' | 'boolean' | 'array';
	description?: string;
	properties?: Record<string, Schema>;
	required?: string[];
	additionalProperties?: boolean;
	items?: Schema;
	minItems?: number;
	maxItems?: number;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	enum?: unknown[];
	default?: unknown;
}

/** Returns a list of problems; an empty list means the value fits the schema. */
export function check(schema: Schema, value: unknown, path = 'input'): string[] {
	const out: string[] = [];
	switch (schema.type) {
		case 'object': {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${path} must be an object`];
			const obj = value as Record<string, unknown>;
			for (const key of schema.required ?? []) if (!(key in obj)) out.push(`${path}.${key} is required`);
			for (const [key, v] of Object.entries(obj)) {
				const sub = schema.properties?.[key];
				if (sub) out.push(...check(sub, v, `${path}.${key}`));
				else if (schema.additionalProperties === false) out.push(`${path}.${key} is not a known field`);
			}
			return out;
		}
		case 'string':
			if (typeof value !== 'string') return [`${path} must be a string`];
			if (schema.minLength !== undefined && value.length < schema.minLength) out.push(`${path} must not be empty`);
			if (schema.maxLength !== undefined && value.length > schema.maxLength) out.push(`${path} is longer than ${schema.maxLength} characters`);
			break;
		case 'integer':
			if (typeof value !== 'number' || !Number.isInteger(value)) return [`${path} must be a whole number`];
			if (schema.minimum !== undefined && value < schema.minimum) out.push(`${path} must be at least ${schema.minimum}`);
			break;
		case 'number':
			if (typeof value !== 'number' || !Number.isFinite(value)) return [`${path} must be a number`];
			break;
		case 'boolean':
			if (typeof value !== 'boolean') return [`${path} must be true or false`];
			break;
		case 'array': {
			if (!Array.isArray(value)) return [`${path} must be an array`];
			if (schema.minItems !== undefined && value.length < schema.minItems) out.push(`${path} needs at least ${schema.minItems} item(s)`);
			if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push(`${path} has more than ${schema.maxItems} items`);
			if (schema.items) value.forEach((v, i) => out.push(...check(schema.items!, v, `${path}[${i}]`)));
			break;
		}
	}
	if (schema.enum && !schema.enum.includes(value)) out.push(`${path} must be one of ${schema.enum.join(', ')}`);
	return out;
}
