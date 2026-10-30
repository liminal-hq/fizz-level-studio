// The person's command line: set the mode, accept or reject proposals, see status, undo.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { resolve } from 'node:path';
import { Studio, StudioError } from './studio.ts';

const USAGE = `usage:
  bun packages/mcp/src/cli.ts mode propose|direct <level.fizz>
  bun packages/mcp/src/cli.ts status <level.fizz>
  bun packages/mcp/src/cli.ts accept <proposal-id|all> <level.fizz> [--reason "text"]
  bun packages/mcp/src/cli.ts reject <proposal-id|all> <level.fizz> [--reason "text"]
  bun packages/mcp/src/cli.ts undo <level.fizz>`;

function main(argv: string[]): number {
	const args = [...argv];
	let reason: string | undefined;
	const ri = args.indexOf('--reason');
	if (ri >= 0) {
		reason = args[ri + 1];
		args.splice(ri, 2);
	}
	const [cmd, ...rest] = args;
	const need = cmd === 'mode' || cmd === 'accept' || cmd === 'reject' ? 2 : 1;
	if (!cmd || rest.length !== need || (cmd === 'mode' && rest[0] !== 'propose' && rest[0] !== 'direct')) {
		console.error(USAGE);
		return 2;
	}
	const studio = new Studio(resolve(rest[need - 1]));
	try {
		switch (cmd) {
			case 'mode':
				studio.setMode(rest[0] as 'propose' | 'direct');
				console.log(`mode is now ${rest[0]}`);
				return 0;
			case 'status': {
				const s = studio.state();
				console.log(`mode: ${s.mode}`);
				if (s.history.length === 0) console.log('no proposals or edits yet');
				for (const h of s.history) {
					console.log(`${h.id}  ${h.status.padEnd(8)}  ${h.mode.padEnd(7)}  by ${h.by}  ${h.title}${h.reason ? `  (${h.reason})` : ''}`);
					if (h.status === 'pending' || h.status === 'applied') for (const l of h.lines) console.log(`      ${l}`);
				}
				return 0;
			}
			case 'accept': {
				const r = studio.accept(rest[0], reason);
				for (const id of r.accepted) console.log(`accepted ${id}`);
				for (const f of r.failed) console.error(`could not accept ${f.id}: ${f.problem}`);
				if (r.accepted.length === 0 && r.failed.length === 0) console.log('nothing pending');
				return r.failed.length > 0 ? 1 : 0;
			}
			case 'reject': {
				const ids = studio.reject(rest[0], reason);
				for (const id of ids) console.log(`rejected ${id}`);
				if (ids.length === 0) console.log('nothing pending');
				return 0;
			}
			case 'undo': {
				const r = studio.undo();
				console.log(`undid ${r.undone}`);
				return 0;
			}
			default:
				console.error(USAGE);
				return 2;
		}
	} catch (e) {
		if (e instanceof StudioError) {
			console.error(e.message);
			return 1;
		}
		throw e;
	}
}

process.exit(main(process.argv.slice(2)));
