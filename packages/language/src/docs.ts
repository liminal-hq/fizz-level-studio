// The language, documented: one entry for every word a script can use, with its syntax, an example and what it does.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The editor's code completion and the manual read this. A test keeps it complete: every word the parser accepts
// has an entry here.

import { ITEMS, KINDS, SEGS, TILES } from './tables.ts';

export type DocKind = 'statement' | 'section' | 'segment' | 'tile' | 'item' | 'enemy' | 'field';
export type DocScope = 'level' | 'overworld' | 'both';

export interface Doc {
	word: string;
	kind: DocKind;
	scope: DocScope;
	/** The section a statement lives in, or `top` for header lines. */
	section: string;
	syntax: string;
	example: string;
	note: string;
	/** The field names the statement takes, for completion after the word. */
	fields: string[];
}

const d = (word: string, kind: DocKind, scope: DocScope, section: string, syntax: string, example: string, note: string, fields: string[] = []): Doc => ({ word, kind, scope, section, syntax, example, note, fields });

// Plain-language notes on every tile word, from the game's tile definitions.
export const TILE_NOTES: Record<string, { group: string; id: number; note: string }> = {
	"fill": { group: "Ground and solids", id: 1, note: "Solid ground. The basic filler for terrain, and what fill-by-range lines write." },
	"block": { group: "Ground and solids", id: 2, note: "A solid block Ben can stand on and bump into." },
	"cracked": { group: "Ground and solids", id: 37, note: "A cracked wall: solid until a fizz shot hits it, then it and any cracked tiles touching it crumble away." },
	"tree": { group: "Ground and solids", id: 23, note: "A solid tree, for the overworld and park levels." },
	"rock": { group: "Ground and solids", id: 24, note: "A solid rock." },
	"river": { group: "Ground and solids", id: 22, note: "Solid river water on the overworld." },
	"house-a": { group: "Ground and solids", id: 38, note: "A solid town building, drawn over grass." },
	"house-b": { group: "Ground and solids", id: 39, note: "A second solid town building style." },
	"shop": { group: "Ground and solids", id: 40, note: "A solid shop front on the overworld." },
	"fountain": { group: "Ground and solids", id: 41, note: "A solid fountain on the overworld." },
	"one-way": { group: "Platforms and climbing", id: 3, note: "A platform Ben can jump up through and stand on. In the engine this is PLAT." },
	"bridge": { group: "Platforms and climbing", id: 14, note: "A bridge that is gone or there depending on its switch (channel 0)." },
	"rung": { group: "Platforms and climbing", id: 28, note: "A ladder rung Ben can climb. Not solid." },
	"rung-top": { group: "Platforms and climbing", id: 29, note: "The top rung of a ladder: climbable, and a one-way ledge Ben can stand on." },
	"vine": { group: "Platforms and climbing", id: 36, note: "A crystal vine on a cave wall. Not solid; Ben can climb it in any direction." },
	"conveyor-l": { group: "Platforms and climbing", id: 25, note: "A solid belt that carries Ben to the left." },
	"conveyor-r": { group: "Platforms and climbing", id: 26, note: "A solid belt that carries Ben to the right." },
	"slope-r45": { group: "Slopes", id: 6, note: "A 45 degree slope that rises toward the right, one tile wide." },
	"slope-l45": { group: "Slopes", id: 7, note: "A 45 degree slope that rises toward the left, one tile wide." },
	"slope-r22a": { group: "Slopes", id: 8, note: "The lower half of a gentle slope rising to the right (0 to half a tile). Place it left of slope-r22b." },
	"slope-r22b": { group: "Slopes", id: 9, note: "The upper half of a gentle slope rising to the right (half a tile to a full tile)." },
	"slope-l22a": { group: "Slopes", id: 10, note: "The higher half of a gentle slope falling to the right (a full tile to half a tile)." },
	"slope-l22b": { group: "Slopes", id: 11, note: "The lower half of a gentle slope falling to the right (half a tile to nothing). Place it right of slope-l22a." },
	"spike": { group: "Hazards", id: 4, note: "Spikes. Touching them kills Ben." },
	"choc": { group: "Hazards", id: 5, note: "A chocolate fudge pool. Lethal liquid." },
	"furnace": { group: "Hazards", id: 27, note: "Molten metal. Lethal liquid with its own look." },
	"red-door": { group: "Doors, gates and exits", id: 12, note: "A solid red cookie door, opened by the red key." },
	"blue-door": { group: "Doors, gates and exits", id: 13, note: "A solid blue cookie door, opened by the blue key." },
	"green-door": { group: "Doors, gates and exits", id: 35, note: "A solid green cookie door, opened by the green key." },
	"gate": { group: "Doors, gates and exits", id: 32, note: "A gate that blocks a shaft while its switch is on; a crystal switch turns it off (channel 1)." },
	"gate-2": { group: "Doors, gates and exits", id: 33, note: "The same, on its own switch channel 2, so a level can hold several puzzles." },
	"gate-3": { group: "Doors, gates and exits", id: 34, note: "The same, on switch channel 3." },
	"exit": { group: "Doors, gates and exits", id: 17, note: "The level exit." },
	"grass": { group: "Scenery and rooms", id: 20, note: "Grass. Not solid; ground cover for the overworld." },
	"path": { group: "Scenery and rooms", id: 21, note: "A path. Not solid." },
	"crystal-tile": { group: "Scenery and rooms", id: 16, note: "A decorative crystal on the ground. The script name differs from the game's CRYS so it does not clash with the crystal statement." },
	"mural-origin": { group: "Scenery and rooms", id: 18, note: "The bottom-left tile of a 3 by 2 wall mural, and the one that draws the whole picture." },
	"mural-part": { group: "Scenery and rooms", id: 19, note: "The other five tiles of a mural. They do not draw." },
	"wall-bg": { group: "Scenery and rooms", id: 30, note: "Decorative interior wall behind a building's rooms, stairs and ladders. Not solid." },
	"facade": { group: "Scenery and rooms", id: 31, note: "Paint that hides a room; it fades out while Ben is inside." },
	'empty': { group: 'Ground and solids', id: 0, note: 'Nothing. `clear` writes it.' },
};

const ITEM_NOTES: Record<string, string> = {
	cheezie: 'The basic snack: 1 point. A hundred points earn an extra life.',
	choc: 'A chocolate bar: 2 points. (`choc` is also a tile, the fudge pool; the section tells them apart.)',
	cookie: 'A cookie: 5 points.',
	soda: 'A soda: five more fizz shots.',
	'key-red': 'A red gumdrop. It opens red doors.',
	'key-blue': 'A blue gumdrop. It opens blue doors.',
	'key-green': 'A green gumdrop. It opens green doors.',
	usb: 'The gold USB drive. A terminal needs it to be hacked.',
};

const KIND_NOTES: Record<string, string> = {
	gloop: 'Walks along the ground and turns at a wall or where the ground ahead ends. A stomp or a fizz shot stuns it.',
	hopper: 'Waits until Ben is behind it, inside 10 tiles across and 4 up or down, then jumps at him.',
	marsh: 'A bouncing marshmallow: it hops along and turns only at walls, so it can leave a ledge. Harmless, and Ben can bounce off it.',
	beetle: 'Charges at Ben, and stuns itself when it hits a wall.',
	bat: 'Hangs from the ceiling, drops towards Ben and rises again.',
	pod: 'A pod that puffs a cloud. Harmless until it puffs, and the puff hurts.',
	phantom: 'A tall ghost that turns to face Ben and sends shots at him.',
	roller: 'A big rolling ball that bounces off walls. Shots and stomps do nothing to it.',
	sentry: 'A flying turret that faces Ben and fires at him.',
	drone: 'Flies a fixed oval around its spawn point, 2.6 tiles each way across and 1.4 up and down. Shots and stomps do nothing to it, so the only answer is timing.',
	boss: 'The boss of a level, fought in its arena (see `arena`).',
	switch: 'A floor switch. Touching it toggles switch channel 0, which is the bridge.',
	terminal: 'A computer. It needs the gold USB drive; hacking it ends the level.',
	cage: 'A cage that holds something to free.',
	mirror: 'A fixed 45-degree mirror that bounces fizz. `dir=1` is `/` and `dir=-1` is `\\`.',
	swivel: 'A mirror that swings to the other angle after every bounce.',
	'crystal-switch': 'Opens the gate on switch channel 1 when a fizz bubble hits it.',
	press: 'A crushing press that rises and falls over a floor. It is harmless while raised.',
	target: 'Shootable scenery: a fizz bubble pops it and it drops `dir` cheezies (3 if unset).',
	glyph: 'Painted wall art. Touching it shows a line of lore, chosen by `dir`.',
	cameo: 'A chalk drawing of a familiar face: `dir=1` is Mortimer, otherwise Billy.',
};

const SEG_NOTES: Record<string, string> = {
	flat: 'Level ground for N tiles.',
	up: 'A 45 degree slope rising N tiles to the right.',
	down: 'A 45 degree slope falling N tiles to the right.',
	up22: 'A gentle slope rising to the right; each tile of the count spans two tiles across.',
	down22: 'A gentle slope falling to the right.',
	gap: 'N tiles with no ground: a pit to jump. A gap of 3 or fewer clears, 4 is tight and 5 or more needs a ledge.',
	pool: 'N tiles of the current liquid, two deep.',
	spikes: 'N tiles of spikes on the ground.',
	'belt-r': 'A conveyor belt that carries Ben to the right.',
	'belt-l': 'A conveyor belt that carries Ben to the left.',
};

export const DOCS: Doc[] = [
	// header and top-level lines of a level
	d('level', 'statement', 'level', 'top', 'level "Name" WxH ground=N id=ID', 'level "Crater Fields" 192x28 ground=4 id=crater', 'The header of a level script: its name, its size in tiles, the height of the ground and the level table id. It comes first.', ['ground', 'id']),
	d('theme', 'statement', 'level', 'top', 'theme NAME', 'theme crater', 'The look of the level. It has to agree with the level table for the id.'),
	d('area', 'statement', 'level', 'top', 'area NAME', 'area crater-fields', 'The area of the world the level belongs to. It has to agree with the level table for the id.'),
	d('start', 'statement', 'both', 'top', 'start X,Y', 'start 3,4', "Where Ben stands when the level opens: the tile, x then y, counting y up from the bottom. On an overworld the numbers may be fractions."),
	d('arena', 'statement', 'level', 'top', 'arena x=A..B floor=N', 'arena x=118..147 floor=4', 'The boss arena: the columns it spans and the height of its floor. A level has at most one. It may also sit in the edits block, where the studio puts an arena it adds.', ['x', 'floor']),
	d('walls', 'statement', 'level', 'top', 'walls', 'walls', 'Closes the level in with a wall at each end. It can appear more than once.'),
	// sections
	d('terrain', 'section', 'level', 'section', 'terrain', 'terrain', 'Runs of ground, one run per line, left to right. The height carries on from line to line.'),
	d('blocks', 'section', 'both', 'section', 'blocks', 'blocks', 'Tile fills and the things made of tiles: platforms, rooms, ladders and the like. In an overworld, also routes and the scatter.'),
	d('treats', 'section', 'level', 'section', 'treats', 'treats', 'Snacks and keys. Each one sits in the middle of a whole block.'),
	d('enemies', 'section', 'level', 'section', 'enemies', 'enemies', 'Enemies and the objects that act like them.'),
	d('points', 'section', 'overworld', 'section', 'points', 'points', 'The places on the map: levels, teleporters, signs and the saucer.'),
	d('edits', 'section', 'both', 'section', 'edits', 'edits', 'What the studio and Claude add. The hand-written sections stay as written. It comes last and appears once.'),
	// terrain
	...Object.keys(SEGS).map((w) => d(w, 'segment', 'level', 'terrain', `${w} N`, `${w} 4`, SEG_NOTES[w])),
	d('liquid', 'statement', 'level', 'terrain', 'liquid choc | furnace', 'liquid furnace', 'Chooses what the pool segments on later lines are filled with.'),
	// blocks
	d('plat', 'statement', 'level', 'blocks', 'plat x=A..B y=N', 'plat x=107..108 y=5', 'A one-way platform across the columns.', ['x', 'y']),
	d('hover', 'statement', 'level', 'blocks', 'hover from=X,Y to=X,Y speed=S [size=WxH] [dwell=SECONDS]', 'hover from=18,47.5 to=18,56.5 speed=0.1 size=3x0.5 dwell=2', 'A moving platform between two points. `size` is its width and height (2 by 0.5 if left out) and `dwell` the seconds it rests at each end (0, constant motion, if left out).', ['from', 'to', 'speed', 'size', 'dwell']),
	d('channel', 'statement', 'level', 'blocks', 'channel LIST on|off', 'channel 1,2,3 on', 'Sets which switch channels start on. A gate blocks while its channel is on.'),
	d('crystal', 'statement', 'level', 'blocks', 'crystal x=LIST', 'crystal x=10,26,60', 'Decorative crystals on the ground. A terrain line has to come earlier.', ['x']),
	d('room', 'statement', 'level', 'blocks', 'room x=A..B y=A..B', 'room x=1..5 y=22..25', 'A hidden room: a facade covers it until Ben steps inside.', ['x', 'y']),
	d('secret-room', 'statement', 'level', 'blocks', 'secret-room x=A..B y=A..B', 'secret-room x=2..6 y=4..8', 'A room whose discovery counts as finding the secret.', ['x', 'y']),
	d('wall-behind', 'statement', 'level', 'blocks', 'wall-behind x=A..B y=A..B', 'wall-behind x=1..38 y=3..80', 'A backdrop wall behind the empty cells of the rectangle.', ['x', 'y']),
	d('mural', 'statement', 'level', 'blocks', 'mural x=N y=N', 'mural x=30 y=8', 'A wall mural, three tiles wide and two high, with its bottom-left corner at the tile.', ['x', 'y']),
	d('ladder', 'statement', 'level', 'blocks', 'ladder x=N y=BOTTOM..TOP', 'ladder x=18 y=3..11', 'A ladder up a column.', ['x', 'y']),
	d('stairs-right', 'statement', 'level', 'blocks', 'stairs-right x=N y=N count=N', 'stairs-right x=24 y=12 count=9', 'Stairs rising to the right.', ['x', 'y', 'count']),
	d('stairs-left', 'statement', 'level', 'blocks', 'stairs-left x=N y=N count=N', 'stairs-left x=6 y=39 count=9', 'Stairs rising to the left.', ['x', 'y', 'count']),
	d('vine-nook', 'statement', 'level', 'blocks', 'vine-nook x= foot= shelf= dir= depth= h=', 'vine-nook x=30 foot=4 shelf=12 dir=1 depth=6 h=4', 'A carved nook with a climbable vine up to a shelf.', ['x', 'foot', 'shelf', 'dir', 'depth', 'h']),
	// treats
	...Object.keys(ITEMS).map((w) => d(w, 'item', 'level', 'treats', `${w} x=LIST y=N`, `${w} x=36 y=5`, ITEM_NOTES[w], ['x', 'y'])),
	d('row', 'statement', 'level', 'treats', 'row ITEM x=A..B y=N [by=N]', 'row cheezie x=17..20 y=7', 'A row of items on neighbouring blocks, or every `by` blocks.', ['x', 'y', 'by']),
	d('pogo-cache', 'statement', 'level', 'treats', 'pogo-cache x=A..B rise=N', 'pogo-cache x=8..10 rise=7', 'A ledge of snacks for a pogo bounce, `rise` tiles above the ground.', ['x', 'rise']),
	// enemies
	...Object.keys(KINDS).map((w) => d(w, 'enemy', 'level', 'enemies', `${w} x=LIST [y=N] [dir=N] [ride]`, `${w} x=35,62,85`, KIND_NOTES[w], ['x', 'y', 'dir', 'ride'])),
	// edits
	d('paint', 'statement', 'level', 'edits', 'paint TILE x=LIST y=LIST', 'paint one-way x=26,28,30 y=9', 'Sets cells to a tile. It takes tile words only.', ['x', 'y']),
	d('clear', 'statement', 'level', 'edits', 'clear x=LIST y=LIST', 'clear x=12..14 y=8', 'Empties tiles. It does not remove items, enemies, platforms or rooms.', ['x', 'y']),
	d('place', 'statement', 'level', 'edits', 'place ITEM x=LIST y=LIST', 'place cheezie x=26,28,30 y=10', 'Adds items, after every hand-written item.', ['x', 'y']),
	// overworld
	d('overworld', 'statement', 'overworld', 'top', 'overworld "Name" WxH id=ID', 'overworld "Overworld" 60x44 id=main', 'The header of an overworld script: its name, its size in tiles and its id.', ['id']),
	d('area', 'statement', 'overworld', 'top', 'area NAME x=A..B y=A..B', 'area crater-fields x=0..24 y=0..22', 'A region of the map that belongs to an area, which decides its scatter. The first area to match a tile decides it, so list a lake before the regions around it.', ['x', 'y']),
	d('path', 'statement', 'overworld', 'blocks', 'path from=X,Y to=X,Y', 'path from=8,9 to=14,6', 'A route between two tiles, running x first and then y. (`path x=.. y=..` fills the path tile instead.)', ['from', 'to']),
	d('scatter', 'statement', 'overworld', 'blocks', 'scatter', 'scatter', 'Trees and rocks on free grass, by each area\'s rates, keeping clear of every point and every path drawn before it. Each tile rolls the same way every time.'),
	d('level', 'statement', 'overworld', 'points', 'level LEVEL at=X,Y [req=LIST] [big] [hidden]', 'level meteor-mesa at=16,14 req=crater', 'A level on the map. `req` lists the levels to clear first, or `secret`; `big` draws it larger and `hidden` keeps it off the map until `req` is met.', ['at', 'req', 'big', 'hidden']),
	d('tele', 'statement', 'overworld', 'points', 'tele NAME at=X,Y with=NAME [req=LIST] [hidden]', 'tele crater-down at=12,19 with=meadows-up req=crater', 'A teleporter. It pairs with another by name.', ['at', 'with', 'req', 'hidden']),
	d('saucer', 'statement', 'overworld', 'points', 'saucer at=X,Y', 'saucer at=8,10', "Ben's saucer, where the map begins.", ['at']),
	d('sign', 'statement', 'overworld', 'points', 'sign N at=X,Y', 'sign 0 at=8,16', 'A signpost in a town; N picks its text.', ['at']),
	// tiles last, so that `choc` the item is found before `choc` the tile
	...Object.keys(TILES).map((w) => d(w, 'tile', 'both', 'blocks', `${w} x=A..B y=A..B`, `${w} x=10..12 y=4`, `${TILE_NOTES[w].group}: ${TILE_NOTES[w].note}`, ['x', 'y'])),
];

export const FIELD_NOTES: Record<string, string> = {
	x: 'The columns: a number, a range `3..7` or a list `3,5,9`.',
	y: 'The rows, counting up from the bottom: a number, a range or a list.',
	from: 'Where a lift or a route starts, as X,Y.',
	to: 'Where it ends, as X,Y.',
	speed: 'How fast a lift moves.',
	size: 'Width and height of a lift in tiles, such as 3x0.5.',
	dwell: 'Seconds a lift rests at each end.',
	dir: 'A direction or a choice, depending on the enemy: 1 right, -1 left.',
	ride: 'The enemy rides the platform it stands on.',
	by: 'Step between items in a row.',
	count: 'How many steps.',
	rise: 'How many tiles above the ground.',
	floor: 'The height of the arena floor.',
	id: 'The level table id, such as crater.',
	ground: 'The height of the ground, in tiles.',
	at: 'Where it sits on the map, as X,Y.',
	with: 'The teleporter it pairs with, by name.',
	req: 'Levels to clear first, such as crater,meteor-mesa, or secret.',
	big: 'Draw the point larger.',
	hidden: 'Not drawn, and not reachable, until its requirements are met.',
	foot: 'Where the nook meets the ground.',
	shelf: 'Height of the shelf the vine leads to.',
	depth: 'How deep the nook is cut.',
	h: 'Height in tiles.',
};

/** Every word the language knows, grouped by what it is, for completion. */
export function docsFor(scope: 'level' | 'overworld'): Doc[] {
	return DOCS.filter((x) => x.scope === 'both' || x.scope === scope);
}
