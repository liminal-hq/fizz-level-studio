// Command line for the Fizz language: check a script, round-trip it, or export it as Rust.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readFileSync, writeFileSync } from 'node:fs';
import { formatError } from './errors.ts';
import { parse } from './parser.ts';
import { print } from './printer.ts';
import { isOverworld, overworldToRust, parseOverworld, printOverworld } from './overworld.ts';
import { toRust } from './rust.ts';

const [cmd, file, fnName, out] = process.argv.slice(2);
if (!cmd || !file || (cmd === 'export' && !fnName)) {
	console.error('usage: bun cli.ts check <file.fizz>\n       bun cli.ts export <file.fizz> <rust_fn_name> [out.rs]');
	process.exit(2);
}
const text = readFileSync(file, 'utf8');
if (isOverworld(text)) {
	const ow = parseOverworld(text);
	if (ow.errors.length > 0) {
		console.error(ow.errors.map(formatError).join('\n'));
		process.exit(1);
	}
	if (cmd === 'check') console.log(`ok: ${ow.ast.nodes.length} lines, prints back ${printOverworld(ow.ast) === text ? 'identically' : 'DIFFERENTLY'}`);
	else if (cmd === 'export') {
		const rust = overworldToRust(ow.ast, fnName);
		if (out) writeFileSync(out, rust);
		else process.stdout.write(rust);
	} else {
		console.error(`unknown command ${cmd}`);
		process.exit(2);
	}
	process.exit(0);
}
const { ast, errors } = parse(text);
if (errors.length > 0) {
	console.error(errors.map(formatError).join('\n'));
	process.exit(1);
}
if (cmd === 'check') {
	console.log(`ok: ${ast.nodes.length} lines, prints back ${print(ast) === readFileSync(file, 'utf8') ? 'identically' : 'DIFFERENTLY'}`);
} else if (cmd === 'export') {
	const rust = toRust(ast, fnName);
	if (out) writeFileSync(out, rust);
	else process.stdout.write(rust);
} else {
	console.error(`unknown command ${cmd}`);
	process.exit(2);
}
