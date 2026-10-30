// The MCP tools: names, input schemas, descriptions and handlers, over the studio core.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { appendEdits } from '../../language/src/edits.ts';
import type { Edit } from '../../language/src/edits.ts';
import { AREAS, ITEMS, KINDS, LEVEL_IDS, LIQUIDS, SEGS, THEMES, TILES } from '../../language/src/tables.ts';
import { check } from './schema.ts';
import type { Schema } from './schema.ts';
import { Studio, StudioError, validateLines } from './studio.ts';
import type { HistoryEntry, Where } from './studio.ts';
import { findGaps, IGNORED_STATEMENTS, rasterise, render, renderPending } from './world.ts';
import type { World } from './world.ts';

export interface ToolResult {
	structured: Record<string, unknown>;
	text: string;
	isError?: boolean;
}

interface Tool {
	name: string;
	description: string;
	inputSchema: Schema;
	run(studio: Studio, args: Record<string, unknown>): ToolResult;
}

const int = (description: string): Schema => ({ type: 'integer', description });

/** What the rasteriser draws and what it leaves out, shown in `get_region` and the README. */
export const DRAWN =
	'terrain segments (flat, up, down, up22, down22, gap, pool, spikes, belts), liquid, walls, every tile fill, plat, ladder, stairs, crystal, mural, wall-behind, vine-nook, room and secret-room (as facade tiles), pogo-cache, treat and row items, enemy and prop spawns, hover platforms (the path between their end points), start, exit tiles, and the edits block (paint, clear, place)';
export const IGNORED = 'theme and area (no effect on the grid), arena (bounds not drawn), room and secret-room boundaries and flags (only the facade tiles are drawn); animation, physics and anything the Builder computes at run time are not simulated';

function entryView(e: HistoryEntry): Record<string, unknown> {
	return {
		id: e.id,
		by: e.by,
		time: e.time,
		mode: e.mode,
		title: e.title,
		...(e.why ? { why: e.why } : {}),
		lines: e.lines,
		status: e.status,
		...(e.resolved_at ? { resolved_at: e.resolved_at, resolved_by: e.resolved_by } : {}),
		...(e.reason ? { reason: e.reason } : {}),
	};
}

function fail(message: string, extra: Record<string, unknown> = {}): ToolResult {
	return { structured: { ok: false, error: message, ...extra }, text: message, isError: true };
}

interface Loaded {
	world: World;
	pendingWorld: World | null;
}

/** Rasterises the file, and the file plus every pending proposal when asked. */
function load(studio: Studio, withPending: boolean): Loaded | ToolResult {
	const level = studio.level();
	if (level.errors.length > 0) {
		return fail(`the level file has parse errors: ${level.errors.map((e) => `line ${e.line} ${e.code} ${e.message} (fix: ${e.fix})`).join('; ')}`, { errors: level.errors });
	}
	const world = rasterise(level.ast)!;
	let pendingWorld: World | null = null;
	if (withPending) {
		const pending = studio.state().history.filter((h) => h.status === 'pending');
		let ast = level.ast;
		for (const p of pending) {
			try {
				ast = appendEdits(ast, validateLines({ ...level, ast, errors: [] }, p.lines).edits);
			} catch {
				// A pending proposal that no longer fits the file is left out of the preview.
			}
		}
		pendingWorld = rasterise(ast)!;
	}
	return { world, pendingWorld };
}

const isResult = (x: Loaded | ToolResult): x is ToolResult => 'structured' in x;

function notesIn(studio: Studio, r: { x0: number; y0: number; x1: number; y1: number } | null) {
	return studio
		.state()
		.notes.filter((n) => {
			if (!r) return true;
			const a = 'x' in n.at ? { x0: n.at.x, y0: n.at.y, x1: n.at.x, y1: n.at.y } : n.at;
			return a.x0 <= r.x1 && a.x1 >= r.x0 && a.y0 <= r.y1 && a.y1 >= r.y0;
		})
		.map((n) => ({ id: n.id, at: n.at, text: n.text, time: n.time }));
}

function countBy<T>(xs: T[], key: (x: T) => string): Record<string, number> {
	const out: Record<string, number> = {};
	for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1;
	return out;
}

const getLevel: Tool = {
	name: 'get_level',
	description:
		'Read the whole level. Returns the header (name, id, size, ground, theme, area), the script text with line numbers, counts (tiles by kind, enemies by kind, treats by kind), the start and exit if present, the session mode (read-only: the person sets it), pending proposals and your notes. The script is reloaded from disk on every call, so it shows anything the person changed. Call this first.',
	inputSchema: { type: 'object', properties: {}, additionalProperties: false },
	run(studio) {
		const level = studio.level();
		const textLines = level.text.split('\n');
		if (textLines[textLines.length - 1] === '') textLines.pop();
		const script = textLines.map((text, i) => ({ line: i + 1, text }));
		const state = studio.state();
		const base = {
			mode: state.mode,
			script,
			parse_errors: level.errors,
			pending: state.history.filter((h) => h.status === 'pending').map(entryView),
			notes: notesIn(studio, null),
		};
		const loaded = load(studio, false);
		if (isResult(loaded)) {
			return { structured: { ok: false, ...base, error: loaded.text }, text: loaded.text, isError: true };
		}
		const w = loaded.world;
		const tileCells: string[] = [];
		const exits: { x: number; y: number }[] = [];
		for (let y = 0; y < w.h; y++) {
			for (let x = 0; x < w.w; x++) {
				const i = y * w.w + x;
				const t = w.tiles[i];
				if (w.liquid[i]) tileCells.push(`liquid:${t}`);
				else if (t !== 'empty') tileCells.push(t);
				if (t === 'exit' && !w.liquid[i]) exits.push({ x, y });
			}
		}
		const structured = {
			ok: true,
			...base,
			header: { name: w.name, id: w.id, width: w.w, height: w.h, ground: w.ground, theme: w.theme ?? LEVEL_IDS[w.id]?.theme ?? null, area: w.area ?? LEVEL_IDS[w.id]?.area ?? null },
			counts: {
				tiles_by_kind: countBy(tileCells, (t) => t),
				enemies_by_kind: countBy(w.spawns, (s) => s.kind),
				enemies: w.spawns.length,
				treats_by_kind: countBy(w.items, (i) => i.kind),
				treats: w.items.length,
			},
			start: w.start,
			exit: exits.length > 0 ? { cells: exits.length, first: exits[0], all: exits.slice(0, 20) } : null,
		};
		return {
			structured,
			text: `${w.name} (${w.id}) ${w.w}x${w.h}, ${w.spawns.length} enemies, ${w.items.length} treats, start ${w.start ? `${w.start.x},${w.start.y}` : 'none'}, exit ${exits.length > 0 ? 'yes' : 'none'}. Mode: ${state.mode}. ${structured.pending.length} pending proposal(s), ${structured.notes.length} note(s).`,
		};
	},
};

const getRegion: Tool = {
	name: 'get_region',
	description: `Render a rectangle of the level as text, one character per cell with the top row first, an x ruler, a y label on each row and a legend, plus the entities (items, enemies, hover platforms, start) and your notes inside it. x and y are tile coordinates; y grows upwards and row 0 is the bottom; both corners are inclusive and are clamped to the level. The picture is rasterised from the script by running its statements in file order, as the Builder does. It draws: ${DRAWN}. It ignores: ${IGNORED}. With include_pending true, proposals still awaiting the person are applied in a second, separate picture (pending_lines) that shows only the cells they would change, over blanks; the main picture never includes them.`,
	inputSchema: {
		type: 'object',
		properties: {
			x0: int('left column, inclusive'),
			y0: int('bottom row, inclusive'),
			x1: int('right column, inclusive'),
			y1: int('top row, inclusive'),
			include_pending: { type: 'boolean', description: 'also render pending proposals as a separate layer (default false)' },
		},
		required: ['x0', 'y0', 'x1', 'y1'],
		additionalProperties: false,
	},
	run(studio, a) {
		const includePending = a.include_pending === true;
		const loaded = load(studio, includePending);
		if (isResult(loaded)) return loaded;
		const region = { x0: a.x0 as number, y0: a.y0 as number, x1: a.x1 as number, y1: a.y1 as number };
		const w = loaded.world;
		if (region.x1 < 0 || region.y1 < 0 || region.x0 >= w.w || region.y0 >= w.h || Math.max(region.x0, region.x1) < 0) {
			return fail(`the region is outside the level (x runs 0..${w.w - 1}, y runs 0..${w.h - 1})`);
		}
		const r = render(w, region);
		const inside = (x: number, y: number) => x >= r.region.x0 && x < r.region.x1 + 1 && y >= r.region.y0 && y < r.region.y1 + 1;
		const entities = {
			items: w.items.filter((i) => inside(i.x, i.y)),
			enemies: w.spawns.filter((s) => s.y !== null && inside(Math.floor(s.x), Math.floor(s.y))),
			hover_platforms: w.hovers.filter((h) => inside(Math.floor(h.from[0]), Math.floor(h.from[1])) || inside(Math.floor(h.to[0]), Math.floor(h.to[1]))),
			start: w.start && inside(w.start.x, w.start.y) ? w.start : null,
		};
		const out: Record<string, unknown> = {
			ok: true,
			region: r.region,
			lines: r.lines,
			legend: r.legend,
			entities,
			notes: notesIn(studio, r.region),
			rasteriser: { draws: DRAWN, ignores: IGNORED },
		};
		let text = r.lines.join('\n') + '\n\nLegend: ' + Object.entries(r.legend).map(([k, v]) => `${k} ${v}`).join('; ');
		if (loaded.pendingWorld) {
			const p = renderPending(w, loaded.pendingWorld, region);
			out.pending_lines = p.lines;
			out.pending_legend = p.legend;
			text += '\n\nPending layer (only cells a pending proposal would change):\n' + p.lines.join('\n');
		}
		return { structured: out, text };
	},
};

const listKinds: Tool = {
	name: 'list_kinds',
	description:
		'List every word the language knows, taken from the language package: tile words, item words, enemy and prop words, terrain segments, liquids, level ids, themes and areas, each with the statement that places it. In edit_level only paint, clear and place lines are accepted: paint takes a tile word, place takes an item word, and clear removes tiles only. Enemies and terrain cannot be written through edit_level.',
	inputSchema: { type: 'object', properties: {}, additionalProperties: false },
	run() {
		const tiles = Object.keys(TILES).map((word) => ({
			word,
			places: word === 'empty' ? '`clear x=.. y=..` in edits' : `\`${word} x=.. y=..\` under blocks; \`paint ${word} x=.. y=..\` in edits`,
		}));
		const items = Object.keys(ITEMS).map((word) => ({ word, places: `\`${word} x=.. y=..\` under treats; \`row ${word} x=A..B y=N [by=S]\`; \`place ${word} x=.. y=..\` in edits` }));
		const enemies = Object.keys(KINDS).map((word) => ({ word, places: `\`${word} x=.. [y=..] [dir=..] [ride]\` under enemies (hand-written script only; not available through edit_level)` }));
		const segments = Object.keys(SEGS).map((word) => ({ word, places: `\`${word} N\` on a line under terrain (hand-written script only)` }));
		return {
			structured: { ok: true, tiles, items, enemies, terrain_segments: segments, liquids: LIQUIDS, level_ids: Object.keys(LEVEL_IDS), themes: THEMES, areas: AREAS },
			text: `${tiles.length} tiles, ${items.length} items, ${enemies.length} enemy and prop kinds, ${segments.length} terrain segments.`,
		};
	},
};

const editLevel: Tool = {
	name: 'edit_level',
	description:
		'Change the level by appending lines to its edits block. Each line is a statement the language defines: `paint <tile> x=.. y=..`, `clear x=.. y=..` or `place <item> x=.. y=..` (x and y take numbers, ranges such as 3..7 and comma lists). Every line is checked by the language parser before anything is stored; if any line is bad, the whole call is rejected with each bad line\'s error code, line number and suggested fix, and nothing is stored. Hand-written lines are never rewritten and cannot be changed this way. What happens next depends on the session mode, which the person sets and you cannot change: in propose mode (the default) your edit becomes a pending proposal that only the person can accept or reject, and the level file does not change; in direct mode it is applied at once and recorded as one step that undo can revert. The result tells you which mode applied and the status (pending or applied). Give a short title; explain in why.',
	inputSchema: {
		type: 'object',
		properties: {
			lines: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, maxItems: 200, description: 'edit lines, one statement per entry, without indentation' },
			title: { type: 'string', minLength: 1, maxLength: 120, description: 'a short title the person will see' },
			why: { type: 'string', maxLength: 1000, description: 'optional reason for the change' },
		},
		required: ['lines', 'title'],
		additionalProperties: false,
	},
	run(studio, a) {
		try {
			const e = studio.edit({ lines: a.lines as string[], title: a.title as string, why: a.why as string | undefined });
			const text =
				e.mode === 'propose'
					? `Mode: propose. Created pending proposal ${e.id} (${e.title}). The level file has not changed; only the person can accept or reject it.`
					: `Mode: direct. Applied ${e.id} (${e.title}) to the level file. It is one undo step.`;
			return { structured: { ok: true, mode: e.mode, id: e.id, proposal_id: e.id, status: e.status, lines: e.lines }, text };
		} catch (err) {
			if (err instanceof StudioError) {
				const detail = err.problems.map((p) => `line ${p.line}: ${p.code} ${p.message} (fix: ${p.fix})`).join('\n');
				return fail(`${err.message}${detail ? '\n' + detail : ''}`, { stored: false, errors: err.problems });
			}
			throw err;
		}
	},
};

const getProposalState: Tool = {
	name: 'get_proposal_state',
	description:
		'Look up what happened to your proposals. Give an id such as "h3", or omit it for every entry in the history. Each entry has its status (pending, accepted, rejected, applied or undone), and the reason the person gave when they accepted, rejected or edited it, if they gave one.',
	inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'a history id such as h3; omit for all' } }, additionalProperties: false },
	run(studio, a) {
		const state = studio.state();
		const list = a.id ? state.history.filter((h) => h.id === a.id) : state.history;
		if (a.id && list.length === 0) return fail(`no history entry with id ${a.id}`);
		const entries = list.map(entryView);
		return {
			structured: { ok: true, mode: state.mode, entries },
			text: entries.length === 0 ? 'No proposals or edits yet.' : entries.map((e) => `${e.id} ${e.status}${e.reason ? ` — ${e.reason}` : ''} (${e.title})`).join('\n'),
		};
	},
};

const addNote: Tool = {
	name: 'add_note',
	description:
		'Pin a comment to a tile {x, y} or to a rectangle {x0, y0, x1, y1} (give one or the other). The note is kept in the sidecar file, not in the level script, and is shown by get_level and by get_region for any window it touches. Use it for design remarks the person should see, such as why a ledge is where it is.',
	inputSchema: {
		type: 'object',
		properties: {
			x: int('tile column, for a single tile'),
			y: int('tile row, for a single tile'),
			x0: int('left column of a rectangle'),
			y0: int('bottom row of a rectangle'),
			x1: int('right column of a rectangle'),
			y1: int('top row of a rectangle'),
			text: { type: 'string', minLength: 1, maxLength: 500, description: 'the note' },
		},
		required: ['text'],
		additionalProperties: false,
	},
	run(studio, a) {
		const single = a.x !== undefined || a.y !== undefined;
		const rect = ['x0', 'y0', 'x1', 'y1'].some((k) => a[k] !== undefined);
		if (single === rect) return fail('give either {x, y} or {x0, y0, x1, y1}, not both and not neither');
		let at: Where;
		if (single) {
			if (a.x === undefined || a.y === undefined) return fail('a single-tile note needs both x and y');
			at = { x: a.x as number, y: a.y as number };
		} else {
			if (['x0', 'y0', 'x1', 'y1'].some((k) => a[k] === undefined)) return fail('a rectangle note needs x0, y0, x1 and y1');
			at = { x0: Math.min(a.x0 as number, a.x1 as number), y0: Math.min(a.y0 as number, a.y1 as number), x1: Math.max(a.x0 as number, a.x1 as number), y1: Math.max(a.y0 as number, a.y1 as number) };
		}
		const level = studio.level();
		const head = level.ast.nodes.find((n) => n.type === 'level');
		if (head && head.type === 'level') {
			const b = 'x' in at ? { x0: at.x, y0: at.y, x1: at.x, y1: at.y } : at;
			if (b.x0 < 0 || b.y0 < 0 || b.x1 >= head.w || b.y1 >= head.h) return fail(`the note is outside the level (x runs 0..${head.w - 1}, y runs 0..${head.h - 1})`);
		}
		const note = studio.addNote(at, a.text as string);
		return { structured: { ok: true, note }, text: `Pinned note ${note.id}.` };
	},
};

const runChecks: Tool = {
	name: 'run_checks',
	description:
		'Run structural checks and the gap check on the rasterised level. Structural: has a start, has an exit, treats are placed, and every place and paint is inside the level bounds. Gap check: each gap is a run of cells with nothing to stand on, on a surface row, bounded on the left and right by standing surfaces in that same row; up to 3 wide is "a normal jump clears it", exactly 4 is "tight: only a jump timed within a tenth of a second of the edge", 5 or more is "needs a ledge or a hover platform". Hover platforms are not counted as surfaces, so check a flagged gap by eye. The playtest bot is not implemented: the result always says playtest_bot "not run", and no pass or fail of a playthrough is claimed. Pending proposals are included only when include_pending is true.',
	inputSchema: { type: 'object', properties: { include_pending: { type: 'boolean', description: 'check the level as it would be if every pending proposal were accepted (default false)' } }, additionalProperties: false },
	run(studio, a) {
		const loaded = load(studio, a.include_pending === true);
		if (isResult(loaded)) return loaded;
		const w = a.include_pending === true && loaded.pendingWorld ? loaded.pendingWorld : loaded.world;
		const level = studio.level();
		let ast = level.ast;
		if (a.include_pending === true) {
			for (const p of studio.state().history.filter((h) => h.status === 'pending')) {
				try {
					ast = appendEdits(ast, validateLines({ ...level, ast, errors: [] }, p.lines).edits);
				} catch {
					// skipped, as in the preview
				}
			}
		}
		const outside: string[] = [];
		for (const n of ast.nodes) {
			if (n.type === 'paint' || n.type === 'place' || n.type === 'clear') {
				for (const r of n.xs) if (r.lo < 0 || r.hi >= w.w) outside.push(`line ${n.line}: x ${r.lo}..${r.hi}`);
				for (const r of n.ys) if (r.lo < 0 || r.hi >= w.h) outside.push(`line ${n.line}: y ${r.lo}..${r.hi}`);
			}
		}
		const exit = w.tiles.some((t, i) => t === 'exit' && !w.liquid[i]);
		const checks = [
			{ name: 'has_start', ok: w.start !== null, detail: w.start ? `start at ${w.start.x},${w.start.y}` : 'no start' },
			{ name: 'has_exit', ok: exit, detail: exit ? 'an exit tile is placed' : 'no `exit` tile is placed; add `exit x=.. y=..` under blocks' },
			{ name: 'has_treats', ok: w.items.length > 0, detail: `${w.items.length} treat(s) placed` },
			{ name: 'edits_in_bounds', ok: outside.length === 0, detail: outside.length === 0 ? 'every paint, clear and place is inside the level' : outside.join('; ') },
		];
		const gaps = findGaps(w);
		const bad = gaps.filter((g) => g.verdict !== 'clear');
		const summary = `${checks.filter((c) => c.ok).length}/${checks.length} structural checks pass; ${gaps.length} gap(s): ${gaps.filter((g) => g.verdict === 'clear').length} clear, ${gaps.filter((g) => g.verdict === 'tight').length} tight, ${gaps.filter((g) => g.verdict === 'needs_ledge').length} need a ledge or hover platform. Playtest bot: not run.`;
		return {
			structured: { ok: true, checks, gaps, gap_rules: { clear: 'width 1..3: a normal jump clears it', tight: 'width 4: only a jump timed within a tenth of a second of the edge', needs_ledge: 'width 5 or more: needs a ledge or a hover platform' }, playtest_bot: 'not run', includes_pending: a.include_pending === true, needs_attention: bad.length },
			text: summary + (checks.filter((c) => !c.ok).map((c) => `\n- ${c.name}: ${c.detail}`).join('') || '') + gaps.filter((g) => g.verdict !== 'clear').map((g) => `\n- x ${g.x0}..${g.x1} on row ${g.row} is ${g.width} wide — ${g.message}`).join(''),
		};
	},
};

const undo: Tool = {
	name: 'undo',
	description:
		'Revert your own last applied step (direct mode only: proposals are not applied until the person accepts them). It removes exactly the lines that step added. It refuses, and changes nothing, if the file has been edited after that step in a way that conflicts, meaning its lines are no longer the last statements in the file. It never touches the person\'s own edits or anything you did not apply.',
	inputSchema: { type: 'object', properties: {}, additionalProperties: false },
	run(studio) {
		try {
			const r = studio.undo();
			return { structured: { ok: true, undone: r.undone }, text: `Undid ${r.undone}.` };
		} catch (err) {
			if (err instanceof StudioError) return fail(err.message, { undone: null });
			throw err;
		}
	},
};

const getChanges: Tool = {
	name: 'get_changes',
	description:
		'Read the history of changes, so you can see what the person did with your proposals (accepted, rejected, undone). Give since, a history id such as "h4", to get everything after it, or last, a count of the most recent entries (default 10). Edits the person made by hand in an editor are not in the history; get_level always shows the current script.',
	inputSchema: {
		type: 'object',
		properties: { since: { type: 'string', description: 'return entries with an id after this history id, such as h4' }, last: int('return only the most recent N entries') },
		additionalProperties: false,
	},
	run(studio, a) {
		const state = studio.state();
		let entries = state.history;
		if (a.since !== undefined) {
			const m = /^h(\d+)$/.exec(a.since as string);
			if (!m) return fail('`since` must be a history id such as h4');
			const n = Number(m[1]);
			entries = entries.filter((h) => Number(h.id.slice(1)) > n);
		} else {
			const last = (a.last as number | undefined) ?? 10;
			entries = entries.slice(Math.max(0, entries.length - Math.max(0, last)));
		}
		const views = entries.map(entryView);
		return { structured: { ok: true, mode: state.mode, entries: views }, text: views.length === 0 ? 'No changes.' : views.map((e) => `${e.id} ${e.status}: ${e.title}${e.reason ? ` — ${e.reason}` : ''}`).join('\n') };
	},
};

export const TOOLS: Tool[] = [getLevel, getRegion, listKinds, editLevel, getProposalState, addNote, runChecks, undo, getChanges];

/** Validates the arguments, then runs the tool. Never throws for caller mistakes. */
export function callTool(studio: Studio, name: string, args: unknown): ToolResult {
	const tool = TOOLS.find((t) => t.name === name);
	if (!tool) return fail(`unknown tool ${name}`);
	const input = args === undefined || args === null ? {} : args;
	const problems = check(tool.inputSchema, input);
	if (problems.length > 0) return fail(`invalid input: ${problems.join('; ')}`, { errors: problems });
	try {
		return tool.run(studio, input as Record<string, unknown>);
	} catch (err) {
		return fail(`${name} failed: ${(err as Error).message}`);
	}
}

export type { Edit };
