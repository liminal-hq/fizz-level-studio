// End to end: spawn the server as a child process and speak MCP (JSON-RPC 2.0, newline-delimited) over stdio.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { expect, test } from 'bun:test';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CRATER = join(import.meta.dir, '../../../levels/crater.fizz');
const SERVER = join(import.meta.dir, '../src/server.ts');

test('initialize, tools/list, a propose and a get_region over real stdio', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'fizz-mcp-e2e-'));
	const level = join(dir, 'crater.fizz');
	copyFileSync(CRATER, level);
	const before = readFileSync(level, 'utf8');
	const child = Bun.spawn(['bun', SERVER, level], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
	const reader = child.stdout.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	const pending = new Map<number, (m: any) => void>();
	(async () => {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) return;
			buffer += decoder.decode(value);
			let nl: number;
			while ((nl = buffer.indexOf('\n')) >= 0) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (!line) continue;
				const msg = JSON.parse(line);
				pending.get(msg.id)?.(msg);
			}
		}
	})();
	const send = (obj: unknown) => child.stdin.write(JSON.stringify(obj) + '\n');
	let nextId = 1;
	const request = (method: string, params: unknown = {}) =>
		new Promise<any>((resolve, reject) => {
			const id = nextId++;
			const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15000);
			pending.set(id, (m) => {
				clearTimeout(timer);
				resolve(m);
			});
			send({ jsonrpc: '2.0', id, method, params });
		});

	try {
		const init = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
		expect(init.result.serverInfo.name).toBe('fizz-level-studio');
		expect(init.result.capabilities.tools).toBeDefined();
		send({ jsonrpc: '2.0', method: 'notifications/initialized' });

		const list = await request('tools/list');
		const names = list.result.tools.map((t: any) => t.name).sort();
		expect(names).toEqual(['add_note', 'edit_level', 'get_changes', 'get_level', 'get_proposal_state', 'get_region', 'list_kinds', 'run_checks', 'undo']);
		for (const t of list.result.tools) {
			expect(t.inputSchema.type).toBe('object');
			expect(t.description.length).toBeGreaterThan(20);
		}

		const edit = await request('tools/call', { name: 'edit_level', arguments: { lines: ['paint one-way x=20..22 y=12'], title: 'Ledge', why: 'a rest stop' } });
		expect(edit.result.isError).toBe(false);
		expect(edit.result.structuredContent).toMatchObject({ mode: 'propose', status: 'pending', id: 'h1' });
		expect(edit.result.content[0].text).toContain('pending proposal h1');
		expect(readFileSync(level, 'utf8')).toBe(before);

		const region = await request('tools/call', { name: 'get_region', arguments: { x0: 18, y0: 11, x1: 24, y1: 13, include_pending: true } });
		expect(region.result.structuredContent.pending_lines.join('\n')).toContain('===');
		expect(region.result.structuredContent.lines.join('\n')).not.toContain('===');

		const bad = await request('tools/call', { name: 'edit_level', arguments: { lines: ['paint one-wy x=1 y=1'], title: 'typo' } });
		expect(bad.result.isError).toBe(true);
		expect(bad.result.structuredContent.errors[0]).toMatchObject({ code: 'E002', line: 1 });

		const ping = await request('ping');
		expect(ping.result).toEqual({});
	} finally {
		child.kill();
		rmSync(dir, { recursive: true, force: true });
	}
}, 30000);
