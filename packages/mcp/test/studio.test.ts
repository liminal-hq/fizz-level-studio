// Tests for the MCP tools and the person's command line, on a copy of the level in a temp directory.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLocks, Studio, sidecarPath, writeState } from '../src/studio.ts';
import { callTool, TOOLS } from '../src/tools.ts';

const CRATER = join(import.meta.dir, '../../../levels/crater.fizz');
const CLI = join(import.meta.dir, '../src/cli.ts');

let dir: string;
let level: string;
let studio: Studio;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'fizz-mcp-'));
	level = join(dir, 'crater.fizz');
	copyFileSync(CRATER, level);
	studio = new Studio(level);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function cli(...args: string[]) {
	const r = Bun.spawnSync(['bun', CLI, ...args], { stdout: 'pipe', stderr: 'pipe' });
	return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
}

const text = () => readFileSync(level, 'utf8');
const call = (name: string, args: unknown = {}) => callTool(studio, name, args);

describe('propose mode', () => {
	test('defaults to propose, leaves the file alone, and CLI accept appends under edits', () => {
		const before = text();
		const r = call('edit_level', { lines: ['paint one-way x=26,28,30 y=9', 'place cheezie x=26..30 y=10'], title: 'A little stair' });
		expect(r.isError).toBeUndefined();
		expect(r.structured).toMatchObject({ mode: 'propose', status: 'pending', id: 'h1' });
		expect(text()).toBe(before);

		const done = cli('accept', 'h1', level);
		expect(done.code).toBe(0);
		const after = text();
		expect(after.startsWith(before.trimEnd())).toBe(true);
		expect(after).toContain('\nedits\n  paint one-way x=26,28,30 y=9\n  place cheezie x=26..30 y=10');
		expect(call('get_proposal_state', { id: 'h1' }).structured.entries).toMatchObject([{ status: 'accepted', resolved_by: 'person' }]);
	});

	test('CLI reject leaves the file byte-identical and records the reason', () => {
		const before = readFileSync(level);
		call('edit_level', { lines: ['clear x=12..14 y=8'], title: 'Open a hole' });
		expect(cli('reject', 'all', level, '--reason', 'too mean').code).toBe(0);
		expect(Buffer.compare(readFileSync(level), before)).toBe(0);
		const s = call('get_proposal_state', { id: 'h1' }).structured.entries as { status: string; reason: string }[];
		expect(s[0]).toMatchObject({ status: 'rejected', reason: 'too mean' });
	});

	test('the mode cannot be changed through any tool', () => {
		expect(TOOLS.map((t) => t.name)).not.toContain('set_mode');
		expect(TOOLS.map((t) => t.name).filter((n) => /mode|accept|reject/.test(n))).toEqual([]);
		const r = call('edit_level', { lines: ['clear x=1 y=5'], title: 't', mode: 'direct' });
		expect(r.isError).toBe(true);
		expect(existsSync(sidecarPath(level))).toBe(false);
		const ok = call('edit_level', { lines: ['clear x=1 y=5'], title: 't' });
		expect(ok.structured.mode).toBe('propose');
		expect(call('undo').isError).toBe(true);
		for (const t of TOOLS) expect(JSON.stringify(t.inputSchema)).not.toContain('"mode"');
	});

	test('a malformed line is rejected with code, line and fix and nothing is stored', () => {
		const before = text();
		const r = call('edit_level', { lines: ['paint one-way x=1 y=5', 'paint one-wy x=2 y=5', 'clear x=999 y=1'], title: 'bad' });
		expect(r.isError).toBe(true);
		expect(r.structured.stored).toBe(false);
		const errors = r.structured.errors as { line: number; code: string; fix: string }[];
		expect(errors[0]).toMatchObject({ line: 2, code: 'E002' });
		expect(errors[0].fix).toContain('one-way');
		expect(errors[1]).toMatchObject({ line: 3, code: 'E013' });
		expect(r.text).toContain('E002');
		expect(text()).toBe(before);
		expect(existsSync(sidecarPath(level))).toBe(false);
		const notEdit = call('edit_level', { lines: ['soda x=3 y=4'], title: 'x' });
		expect(notEdit.isError).toBe(true);
	});

	test('hand-written lines are never rewritten', () => {
		const before = text();
		call('edit_level', { lines: ['paint block x=5 y=12'], title: 'one' });
		cli('accept', 'all', level);
		const after = text();
		expect(after.slice(0, before.trimEnd().length)).toBe(before.trimEnd());
	});
});

describe('direct mode and undo', () => {
	test('direct applies at once and undo restores the file byte-identically', () => {
		const before = readFileSync(level);
		expect(cli('mode', 'direct', level).code).toBe(0);
		const r = call('edit_level', { lines: ['paint one-way x=40..42 y=9'], title: 'Ledge' });
		expect(r.structured).toMatchObject({ mode: 'direct', status: 'applied' });
		expect(text()).toContain('edits\n  paint one-way x=40..42 y=9');
		const u = call('undo');
		expect(u.structured).toMatchObject({ ok: true, undone: 'h1' });
		expect(Buffer.compare(readFileSync(level), before)).toBe(0);
	});

	test('two direct steps undo one at a time, and CLI undo works too', () => {
		cli('mode', 'direct', level);
		const before = readFileSync(level);
		call('edit_level', { lines: ['paint block x=40 y=9'], title: 'one' });
		const mid = readFileSync(level);
		call('edit_level', { lines: ['paint block x=41 y=9'], title: 'two' });
		expect(call('undo').structured.undone).toBe('h2');
		expect(Buffer.compare(readFileSync(level), mid)).toBe(0);
		expect(cli('undo', level).code).toBe(0);
		expect(Buffer.compare(readFileSync(level), before)).toBe(0);
		expect(call('undo').isError).toBe(true);
	});

	test('undo refuses when someone has edited after the step', () => {
		cli('mode', 'direct', level);
		call('edit_level', { lines: ['paint block x=40 y=9'], title: 'mine' });
		appendFileSync(level, '  clear x=3 y=20   // the person, by hand\n');
		const snapshot = text();
		const u = call('undo');
		expect(u.isError).toBe(true);
		expect(u.text).toContain('conflicts');
		expect(text()).toBe(snapshot);
		expect(call('get_proposal_state', { id: 'h1' }).structured.entries).toMatchObject([{ status: 'applied' }]);
	});

	test('undo still works when the person edited elsewhere in the file', () => {
		cli('mode', 'direct', level);
		call('edit_level', { lines: ['paint block x=40 y=9'], title: 'mine' });
		writeFileSync(level, text().replace('// Crater Fields', '// Crater Fields (renamed)'));
		expect(call('undo').isError).toBeUndefined();
		expect(text()).toContain('(renamed)');
		expect(text()).not.toContain('paint block');
	});
});

describe('reading', () => {
	test('get_level reports header, numbered script, counts, start and exit', () => {
		const r = call('get_level').structured as any;
		expect(r.header).toMatchObject({ name: 'Crater Fields', id: 'crater', width: 192, height: 28, ground: 4, theme: 'crater', area: 'crater-fields' });
		expect(r.script[0]).toEqual({ line: 1, text: expect.stringContaining('Crater Fields') });
		expect(r.start).toEqual({ x: 3, y: 4 });
		expect(r.exit.cells).toBe(2);
		expect(r.counts.enemies).toBe(9);
		expect(r.counts.treats_by_kind.soda).toBe(2);
		expect(r.mode).toBe('propose');
	});

	test('get_region renders painted cells and shows pending as a separate layer', () => {
		cli('mode', 'direct', level);
		call('edit_level', { lines: ['paint one-way x=20..22 y=12'], title: 'applied' });
		cli('mode', 'propose', level);
		call('edit_level', { lines: ['paint block x=30..31 y=12', 'place soda x=25 y=13'], title: 'pending' });

		const plain = call('get_region', { x0: 18, y0: 10, x1: 34, y1: 14 });
		const rowOf = (lines: string[], y: number) => lines.find((l) => l.startsWith(`${String(y).padStart(3)} |`))!.slice(5);
		const lines = plain.structured.lines as string[];
		expect(rowOf(lines, 12).slice(0, 5)).toBe('..===');
		expect(rowOf(lines, 12)).not.toContain('#');
		expect(plain.structured.pending_lines).toBeUndefined();

		const withPending = call('get_region', { x0: 18, y0: 10, x1: 34, y1: 14, include_pending: true });
		const pl = withPending.structured.pending_lines as string[];
		expect(rowOf(pl, 12)).toBe(' '.repeat(12) + '##' + ' '.repeat(3));
		expect(rowOf(pl, 13).trim()).toBe('s');
		expect(rowOf(withPending.structured.lines as string[], 12)).toBe(rowOf(lines, 12));
		expect((withPending.structured.legend as Record<string, string>)['=']).toContain('one-way');
		expect(withPending.text).toContain('Pending layer');
	});

	test('get_region draws terrain, entities and start with a legend', () => {
		const r = call('get_region', { x0: 0, y0: 2, x1: 22, y1: 9 });
		const body = (r.structured.lines as string[]).join('\n');
		expect(body).toContain('S');
		expect(body).toContain('#');
		expect(body).toContain('z');
		expect((r.structured.legend as Record<string, string>).S).toBe('start');
		expect(r.structured.entities).toMatchObject({ start: { x: 3, y: 4 } });
	});

	test('list_kinds comes from the language tables', () => {
		const r = call('list_kinds').structured as any;
		expect(r.tiles.map((t: any) => t.word)).toContain('one-way');
		expect(r.items.map((t: any) => t.word)).toContain('key-red');
		expect(r.enemies.map((t: any) => t.word)).toContain('crystal-switch');
	});

	test('notes are stored in the sidecar and shown by get_level and get_region', () => {
		const before = text();
		call('add_note', { x: 20, y: 6, text: 'jump here' });
		call('add_note', { x0: 100, y0: 4, x1: 110, y1: 9, text: 'hover goes here' });
		expect(text()).toBe(before);
		expect((call('get_level').structured as any).notes).toHaveLength(2);
		expect((call('get_region', { x0: 15, y0: 3, x1: 25, y1: 8 }).structured as any).notes).toHaveLength(1);
		expect(call('add_note', { x: 999, y: 1, text: 'x' }).isError).toBe(true);
		expect(call('add_note', { x: 1, text: 'x' }).isError).toBe(true);
	});

	test('get_changes lists history since an id or the last N', () => {
		call('edit_level', { lines: ['clear x=1 y=5'], title: 'a' });
		call('edit_level', { lines: ['clear x=2 y=5'], title: 'b' });
		cli('reject', 'h1', level, '--reason', 'no');
		expect((call('get_changes', { since: 'h1' }).structured as any).entries.map((e: any) => e.id)).toEqual(['h2']);
		expect((call('get_changes', { last: 1 }).structured as any).entries.map((e: any) => e.id)).toEqual(['h2']);
		const all = (call('get_changes').structured as any).entries;
		expect(all[0]).toMatchObject({ status: 'rejected', reason: 'no' });
	});
});

describe('run_checks', () => {
	function gapLevel(): void {
		writeFileSync(
			level,
			`level "Gaps" 60x20 ground=4 id=crater
start 3,4

terrain
  flat 5, gap 3, flat 5, gap 4, flat 5, gap 5, flat 5, pool 6, flat 4

treats
  soda x=1 y=5
`,
		);
	}

	test('reports gaps of 3, 4 and 5 and a pool with the three rules', () => {
		gapLevel();
		const r = call('run_checks').structured as any;
		const gaps = r.gaps.map((g: any) => [g.x0, g.width, g.verdict]);
		expect(gaps).toEqual([
			[5, 3, 'clear'],
			[13, 4, 'tight'],
			[22, 5, 'needs_ledge'],
			[32, 6, 'needs_ledge'],
		]);
		const byWidth = Object.fromEntries(r.gaps.map((g: any) => [g.width, g.message]));
		expect(byWidth[3]).toBe('a normal jump clears it');
		expect(byWidth[4]).toBe('tight: only a jump timed within a tenth of a second of the edge');
		expect(byWidth[5]).toBe('needs a ledge or a hover platform');
		expect(r.playtest_bot).toBe('not run');
	});

	test('structural checks, and the playtest bot is never claimed', () => {
		const r = call('run_checks');
		const s = r.structured as any;
		expect(s.playtest_bot).toBe('not run');
		expect(r.text).toContain('Playtest bot: not run');
		expect(s.checks.map((c: any) => [c.name, c.ok])).toEqual([
			['has_start', true],
			['has_exit', true],
			['has_treats', true],
			['edits_in_bounds', true],
		]);
		expect(JSON.stringify(s)).not.toMatch(/passed the playtest|bot passed/i);
	});

	test('flags a missing exit', () => {
		gapLevel();
		const s = call('run_checks').structured as any;
		expect(s.checks.find((c: any) => c.name === 'has_exit').ok).toBe(false);
	});

	test('include_pending checks the level as if the proposals were accepted', () => {
		gapLevel();
		call('edit_level', { lines: ['paint block x=6..8 y=3', 'paint block x=6..8 y=2', 'paint block x=6..8 y=1', 'paint block x=6..8 y=0', 'paint block x=6..8 y=4'], title: 'fill the gap' });
		expect((call('run_checks').structured as any).gaps[0].x0).toBe(5);
		const withP = call('run_checks', { include_pending: true }).structured as any;
		expect(withP.gaps.find((g: any) => g.x0 === 5)).toBeUndefined();
	});

	test('the crater has four-wide and wider pools reported', () => {
		const gaps = (call('run_checks').structured as any).gaps as { width: number; verdict: string }[];
		expect(gaps.some((g) => g.width === 3 && g.verdict === 'clear')).toBe(true);
		expect(gaps.some((g) => g.width === 4 && g.verdict === 'tight')).toBe(true);
		expect(gaps.some((g) => g.width === 6 && g.verdict === 'needs_ledge')).toBe(true);
	});
});

/** The person's lock, as the studio writes it: the `layers.locked` key in the sidecar. */
function lock(...layers: string[]) {
	const path = sidecarPath(level);
	const state = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
	state.layers = { locked: layers };
	writeFileSync(path, JSON.stringify(state, null, 2) + '\n');
}

describe('layer locks', () => {
	test('locked treats refuse a place in propose mode: nothing stored, the layer named', () => {
		lock('treats');
		const before = text();
		const r = call('edit_level', { lines: ['place cheezie x=26..30 y=10'], title: 'Snacks' });
		expect(r.isError).toBe(true);
		expect(r.text).toContain('Treats is locked');
		expect(r.text).toContain('binds you exactly as it binds them');
		expect(r.structured).toMatchObject({ stored: false, locked_layers: ['treats'] });
		expect(text()).toBe(before);
		expect(studio.state().history).toEqual([]);
	});

	test('the same refusal in direct mode leaves the level file alone', () => {
		cli('mode', 'direct', level);
		lock('treats');
		const before = readFileSync(level);
		const r = call('edit_level', { lines: ['place cheezie x=26 y=10'], title: 'Snacks' });
		expect(r.isError).toBe(true);
		expect(Buffer.compare(readFileSync(level), before)).toBe(0);
		expect(studio.state().history).toEqual([]);
		// A line that builds nothing locked still goes through.
		const ok = call('edit_level', { lines: ['paint one-way x=40..42 y=9'], title: 'Ledge' });
		expect(ok.structured).toMatchObject({ mode: 'direct', status: 'applied' });
	});

	test('a locked edits layer stops every line, and several locked layers are all named', () => {
		lock('treats', 'edits');
		const r = call('edit_level', { lines: ['place cheezie x=26 y=10'], title: 'Snacks' });
		expect(r.text).toContain('Treats and Edits are locked');
		expect(r.structured.locked_layers).toEqual(['treats', 'edits']);
		lock('edits');
		expect(call('edit_level', { lines: ['paint block x=5 y=12'], title: 'one' }).isError).toBe(true);
	});

	test('markers are the exits and doors, and a lock on another layer does not stop them', () => {
		lock('markers');
		expect(call('edit_level', { lines: ['paint exit x=20 y=9'], title: 'Exit' }).structured.locked_layers).toEqual(['markers']);
		expect(call('edit_level', { lines: ['paint red-door x=20 y=9'], title: 'Door' }).isError).toBe(true);
		lock('terrain', 'blocks', 'enemies');
		expect(call('edit_level', { lines: ['paint exit x=20 y=9', 'place cheezie x=1 y=9'], title: 'Free' }).isError).toBeUndefined();
	});

	test('the locks are read again for every edit, so an unlock takes effect at once', () => {
		lock('edits');
		expect(call('edit_level', { lines: ['clear x=1 y=5'], title: 'a' }).isError).toBe(true);
		lock();
		expect(call('edit_level', { lines: ['clear x=1 y=5'], title: 'a' }).isError).toBeUndefined();
	});

	test('get_level reports the locks, and a pending proposal that a lock now blocks', () => {
		call('edit_level', { lines: ['place cheezie x=26 y=10'], title: 'Snacks' });
		call('edit_level', { lines: ['paint block x=5 y=12'], title: 'Block' });
		expect(call('get_level').structured.locked_layers).toEqual([]);
		lock('treats');
		const r = call('get_level').structured as { locked_layers: string[]; pending: { id: string; blocked_by_locked_layers?: string[] }[] };
		expect(r.locked_layers).toEqual(['treats']);
		expect(r.pending[0]).toMatchObject({ id: 'h1', blocked_by_locked_layers: ['treats'] });
		expect(r.pending[1].blocked_by_locked_layers).toBeUndefined();
	});

	test('accepting a proposal that touches a locked layer is refused and leaves it pending', () => {
		call('edit_level', { lines: ['place cheezie x=26 y=10'], title: 'Snacks' });
		lock('treats');
		const before = text();
		const r = cli('accept', 'h1', level);
		expect(r.code).toBe(1);
		expect(r.err).toContain('Treats is locked');
		expect(text()).toBe(before);
		expect(studio.state().history[0].status).toBe('pending');
		lock();
		expect(cli('accept', 'h1', level).code).toBe(0);
	});

	test('the sidecar keeps the studio\'s lock key and any other key when the server writes', () => {
		lock('enemies');
		const path = sidecarPath(level);
		const state = JSON.parse(readFileSync(path, 'utf8'));
		state.future = { kept: true };
		writeFileSync(path, JSON.stringify(state));
		call('edit_level', { lines: ['paint block x=5 y=12'], title: 'one' });
		call('add_note', { x: 3, y: 4, text: 'hello' });
		cli('reject', 'all', level);
		const after = JSON.parse(readFileSync(path, 'utf8'));
		expect(after.layers).toEqual({ locked: ['enemies'] });
		expect(after.future).toEqual({ kept: true });
		expect(after.history).toHaveLength(1);
		expect(after.notes).toHaveLength(1);
	});

	test('a lock written between the server reading and writing its state is not lost', () => {
		call('edit_level', { lines: ['paint block x=5 y=12'], title: 'one' });
		const held = studio.state();
		lock('treats');
		held.notes.push({ id: 'n1', by: 'claude', time: 'now', at: { x: 1, y: 1 }, text: 't' });
		writeState(level, held);
		expect(readLocks(level)).toEqual(['treats']);
	});

	test('a sidecar with no lock, or one that is broken, locks nothing', () => {
		expect(readLocks(level)).toEqual([]);
		writeFileSync(sidecarPath(level), 'not json');
		expect(readLocks(level)).toEqual([]);
		writeFileSync(sidecarPath(level), JSON.stringify({ layers: { locked: ['nonsense', 'treats', 7] } }));
		expect(readLocks(level)).toEqual(['treats']);
	});
});
