// The curated inputs for the Fizz 1 conformance corpus: test sources and edge cases, each with an id.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Edit } from '../packages/language/src/edits.ts';

/** One curated input. `id` is `<group>/<name>` and names the fixture files. */
export interface Case {
	id: string;
	/** Where the input came from, so a failing fixture can be traced back. */
	from: string;
	source: string;
}

/** A curated input with studio edits appended to it, recorded with the text that results. */
export interface EditCase extends Case {
	edits: Edit[];
}

const HEAD = 'level "T" 40x20 ground=4 id=crater\nstart 3,4\n';
const T = `${HEAD}terrain\n  flat 40\n`; // terrain ends on line 4
const OBJ_HEAD = 'level "T" 40x20 ground=4 id=crater\nstart 3,4\nblocks\n';

const PARSER = 'packages/language/test/parser.test.ts';
const PRINTER = 'packages/language/test/printer.test.ts';
const ERRORS = 'packages/language/test/errors.test.ts';
const OBJECTS = 'packages/language/test/objects.test.ts';
const EDGE = 'tools/fizz1-cases.ts';

const parserCases: Case[] = [
	{ id: 'parser/level-header', from: `${PARSER}: reads the level header`, source: HEAD },
	{
		id: 'parser/terrain-segments',
		from: `${PARSER}: reads terrain segments across commas and spaces`,
		source: `${HEAD}terrain\n  flat 14, up 2,flat 6\n`,
	},
	{
		id: 'parser/ranges-and-lists',
		from: `${PARSER}: reads ranges, lists and single values`,
		source: `${HEAD}terrain\n  flat 30\nblocks\n  block x=5..7 y=10\n  crystal x=1, 3 ,5..6\n`,
	},
	{
		id: 'parser/row-step',
		from: `${PARSER}: row takes a range and a step, and counts items from them`,
		source: `${HEAD}treats\n  row choc x=6..12 y=8 by=3\n`,
	},
	{
		id: 'parser/spawns',
		from: `${PARSER}: spawns: ground-based, explicit y, ride, and dir`,
		source: `${HEAD}terrain\n  flat 30\nenemies\n  gloop x=3, 5\n  drone x=8.5 y=7.5\n  hopper x=9 y=5 ride\n  mirror x=11 y=6 dir=1\n`,
	},
	{
		id: 'parser/top-level-between-sections',
		from: `${PARSER}: top-level statements may sit between sections`,
		source: `${HEAD}terrain\n  flat 30\nwalls\nblocks\n  block x=1 y=1\n`,
	},
	{
		id: 'parser/trailing-comment',
		from: `${PARSER}: trailing comments are kept apart from the statement`,
		source: `${HEAD}terrain\n  flat 3 // short\n`,
	},
	{
		id: 'parser/slashes-in-quoted-name',
		from: `${PARSER}: a // inside a quoted level name is not a comment`,
		source: 'level "A // B" 10x10 ground=2 id=crater\nstart 1,1\n',
	},
	{
		id: 'parser/theme-and-area',
		from: `${PARSER}: theme and area agree with the level table`,
		source: `${HEAD}theme crater\narea crater-fields\n`,
	},
	{
		id: 'parser/every-builder-statement',
		from: `${PARSER}: every Builder-backed statement parses`,
		source: `${HEAD}terrain
  liquid furnace
  flat 30, belt-r 2, belt-l 2
blocks
  plat x=1..3 y=6
  hover from=2,4.5 to=8,4.5 speed=0.3
  room x=1..5 y=4..8
  secret-room x=6..9 y=4..8
  wall-behind x=1..9 y=1..9
  mural x=2 y=3
  ladder x=4 y=4..9
  stairs-right x=10 y=4 count=3
  stairs-left x=14 y=4 count=3
  vine-nook x=20 foot=4 shelf=9 dir=-1 depth=3 h=3
  gate x=3 y=1..2
treats
  pogo-cache x=8..10 rise=7
  usb x=2 y=2
arena x=1..5 floor=4
`,
	},
];

const printerCases: Case[] = [
	{
		id: 'printer/odd-spacing-crlf-no-final-newline',
		from: `${PRINTER}: odd spacing, comments, blank lines, CRLF and no final newline survive`,
		source:
			'// top\r\n\r\nlevel   "X"  10x10   ground=2 id=crater   // why\r\nstart  1 , 2\r\n\r\n\r\nterrain\r\n      flat   3,up 1\r\n// last',
	},
	{
		id: 'printer/errors-print-back',
		from: `${PRINTER}: scripts with errors still print back unchanged`,
		source: 'level "X" 10x10 ground=2 id=crater\nstart 1,2\nterrain\n  flatt 3\n  ???\n',
	},
	{
		id: 'printer/empty-script',
		from: `${PRINTER}: the empty script and a lone newline round-trip`,
		source: '',
	},
	{
		id: 'printer/lone-newline',
		from: `${PRINTER}: the empty script and a lone newline round-trip`,
		source: '\n',
	},
];

const errorCases: Case[] = [
	{
		id: 'errors/e001-unknown-statement',
		from: `${ERRORS}: E001 unknown statement suggests the nearest word`,
		source: `${T}blocks\n  plot x=1..2 y=3\n`,
	},
	{
		id: 'errors/e002-unknown-tile',
		from: `${ERRORS}: E002 unknown tile, item and segment name the nearest match`,
		source: `${T}edits\n  paint one-wy x=1 y=1\n`,
	},
	{
		id: 'errors/e002-unknown-item',
		from: `${ERRORS}: E002 unknown tile, item and segment name the nearest match`,
		source: `${T}edits\n  place chezie x=1 y=1\n`,
	},
	{
		id: 'errors/e002-unknown-segment',
		from: `${ERRORS}: E002 unknown tile, item and segment name the nearest match`,
		source: `${HEAD}terrain\n  flat 3, ramp 2\n`,
	},
	{
		id: 'errors/e002-unknown-level-id',
		from: `${ERRORS}: E002 unknown tile, item and segment name the nearest match`,
		source: 'level "T" 40x20 ground=4 id=crator\nstart 3,4\n',
	},
	{
		id: 'errors/e003-missing-field',
		from: `${ERRORS}: E003 missing field says what to add`,
		source: `${T}blocks\n  block x=1..2\n`,
	},
	{
		id: 'errors/e004-bad-number',
		from: `${ERRORS}: E004 bad number and E005 backwards range`,
		source: `${T}blocks\n  block x=a y=2\n`,
	},
	{
		id: 'errors/e005-backwards-range',
		from: `${ERRORS}: E004 bad number and E005 backwards range`,
		source: `${T}blocks\n  block x=9..3 y=2\n`,
	},
	{
		id: 'errors/e006-second-start',
		from: `${ERRORS}: E006 duplicate header lines and a second edits block`,
		source: `${HEAD}start 1,1\n`,
	},
	{
		id: 'errors/e006-second-edits',
		from: `${ERRORS}: E006 duplicate header lines and a second edits block`,
		source: `${T}edits\n  clear x=1 y=1\nedits\n`,
	},
	{
		id: 'errors/e007-statement-before-level',
		from: `${ERRORS}: E007 a statement before the level header, and an empty script`,
		source: 'start 3,4\nlevel "T" 10x10 ground=2 id=crater\n',
	},
	{
		id: 'errors/e008-wrong-section',
		from: `${ERRORS}: E008 a statement under the wrong section, or before any section`,
		source: `${T}enemies\n  soda x=1 y=1\n`,
	},
	{
		id: 'errors/e008-before-any-section',
		from: `${ERRORS}: E008 a statement under the wrong section, or before any section`,
		source: `${HEAD}flat 3\n`,
	},
	{
		id: 'errors/e008-top-word-in-edits',
		from: `${ERRORS}: E008 a statement under the wrong section, or before any section`,
		source: `${T}edits\n  clear x=1 y=1\n  walls\n`,
	},
	{
		id: 'errors/e009-unknown-field',
		from: `${ERRORS}: E009 unknown field and stray word`,
		source: `${T}blocks\n  block x=1 y=2 z=3\n`,
	},
	{
		id: 'errors/e009-stray-word',
		from: `${ERRORS}: E009 unknown field and stray word`,
		source: `${T}blocks\n  block x=1 y=2 loud\n`,
	},
	{
		id: 'errors/e010-no-start',
		from: `${ERRORS}: E010 a script with no start line is reported on the level line`,
		source: 'level "T" 10x10 ground=2 id=crater\n',
	},
	{
		id: 'errors/e011-crystal-before-terrain',
		from: `${ERRORS}: E011 ground-based statements need terrain first`,
		source: `${HEAD}blocks\n  crystal x=5\nterrain\n  flat 40\n`,
	},
	{
		id: 'errors/e011-spawn-before-terrain',
		from: `${ERRORS}: E011 ground-based statements need terrain first`,
		source: `${HEAD}enemies\n  gloop x=5\n`,
	},
	{
		id: 'errors/e012-row-step',
		from: `${ERRORS}: E012 a row range that misses its step suggests both neighbours`,
		source: `${T}treats\n  row choc x=46..53 y=8 by=3\n`,
	},
	{
		id: 'errors/e013-block-outside-level',
		from: `${ERRORS}: E013 coordinates outside the level`,
		source: `${T}blocks\n  block x=38..40 y=2\n`,
	},
	{
		id: 'errors/e013-clear-outside-level',
		from: `${ERRORS}: E013 coordinates outside the level`,
		source: `${T}edits\n  clear x=1 y=20\n`,
	},
	{
		id: 'errors/e014-theme-contradicts-id',
		from: `${ERRORS}: E014 theme or area that contradicts the level id`,
		source: `${HEAD}theme caves\n`,
	},
	{
		id: 'errors/e014-area-contradicts-id',
		from: `${ERRORS}: E014 theme or area that contradicts the level id`,
		source: `${HEAD}area gumdrop-isle\n`,
	},
	{
		id: 'errors/e015-zero-count',
		from: `${ERRORS}: E015 counts below one and tiny levels`,
		source: `${HEAD}terrain\n  flat 0\n`,
	},
	{
		id: 'errors/e015-zero-step',
		from: `${ERRORS}: E015 counts below one and tiny levels`,
		source: `${T}treats\n  row cookie x=1..2 y=3 by=0\n`,
	},
	{
		id: 'errors/e016-ride-without-y',
		from: `${ERRORS}: E016 spawn field combinations the Builder cannot make`,
		source: `${T}enemies\n  gloop x=3 ride\n`,
	},
	{
		id: 'errors/e016-ride-and-dir',
		from: `${ERRORS}: E016 spawn field combinations the Builder cannot make`,
		source: `${T}enemies\n  gloop x=3 y=5 ride dir=1\n`,
	},
	{
		id: 'errors/malformed-level-header',
		from: `${ERRORS}: a malformed level header is one error, not a cascade`,
		source: 'level Crater 10x10\nstart 1,1\nterrain\n  flat 3\n',
	},
	{
		id: 'errors/several-bad-lines',
		from: `${ERRORS}: several bad lines are all reported, in line order`,
		source: `${T}blocks\n  blok x=1 y=1\n  block x=1\n`,
	},
	{
		id: 'errors/format-error-missing-y',
		from: `${ERRORS}: formatError and parseOrThrow carry the line, code and fix`,
		source: `${T}blocks\n  block x=1\n`,
	},
];

const objectCases: Case[] = [
	{
		id: 'objects/hover-size-and-dwell',
		from: `${OBJECTS}: hover with a size and a rest time (exports, and prints back as written)`,
		source: OBJ_HEAD + '  hover from=18,10.5 to=18,16.5 speed=0.1 size=3x0.5 dwell=2\n',
	},
	{
		id: 'objects/hover-plain',
		from: `${OBJECTS}: the plain form still uses b.hover`,
		source: OBJ_HEAD + '  hover from=1,5 to=4,5 speed=0.3\n',
	},
	{
		id: 'objects/hover-malformed-size',
		from: `${OBJECTS}: a malformed size is explained`,
		source: OBJ_HEAD + '  hover from=1,5 to=4,5 speed=0.3 size=3\n',
	},
	{
		id: 'objects/channel-on',
		from: `${OBJECTS}: channel turns switch channels on, one call each`,
		source: OBJ_HEAD + '  channel 1,2,3 on\n',
	},
	{
		id: 'objects/channel-maybe',
		from: `${OBJECTS}: channel rejects a word other than on or off`,
		source: OBJ_HEAD + '  channel 1 maybe\n',
	},
	{
		id: 'objects/edits-fractional-enemy',
		from: `${OBJECTS}: the edits block takes an enemy with a fractional position`,
		source: OBJ_HEAD + 'edits\n  drone x=28.5 y=7.5\n',
	},
	{
		id: 'objects/edits-lift-and-room',
		from: `${OBJECTS}: the edits block takes a lift and a room`,
		source: OBJ_HEAD + 'edits\n  hover from=1,5 to=4,5 speed=0.3\n  room x=2..6 y=4..8\n',
	},
	{
		id: 'objects/edits-one-arena',
		from: `${OBJECTS}: the edits block takes the boss arena once`,
		source: OBJ_HEAD + 'edits\n  arena x=10..30 floor=4\n',
	},
	{
		id: 'objects/edits-two-arenas',
		from: `${OBJECTS}: the edits block takes the boss arena once`,
		source: OBJ_HEAD + 'edits\n  arena x=10..30 floor=4\n  arena x=2..9 floor=4\n',
	},
	{
		id: 'objects/edits-refuses-terrain',
		from: `${OBJECTS}: the edits block still refuses a terrain segment`,
		source: OBJ_HEAD + 'edits\n  flat 4\n',
	},
];

const BIG = '9'.repeat(400);

const edgeCases: Case[] = [
	{
		id: 'edge/crlf',
		from: `${EDGE}: CRLF line endings throughout`,
		source:
			'level "T" 40x20 ground=4 id=crater\r\nstart 3,4\r\nterrain\r\n  flat 40\r\nblocks\r\n  block x=1..2 y=3 // note\r\n',
	},
	{
		id: 'edge/crlf-blank-line',
		from: `${EDGE}: a line holding only a carriage return is blank`,
		source: 'level "T" 40x20 ground=4 id=crater\r\n\r\nstart 3,4\r\n',
	},
	{
		id: 'edge/no-final-newline',
		from: `${EDGE}: no newline after the last statement`,
		source: 'level "T" 40x20 ground=4 id=crater\nstart 3,4\nterrain\n  flat 40',
	},
	{
		id: 'edge/comment-slashes-in-quotes',
		from: `${EDGE}: a // inside quotes, then a real comment after them`,
		source: 'level "a // b // c" 40x20 ground=4 id=crater // real comment\nstart 3,4\n',
	},
	{
		id: 'edge/unterminated-quote-comment',
		from: `${EDGE}: a lone quote hides the // that follows it`,
		source: 'level "T 40x20 ground=4 id=crater // not a comment\nstart 3,4\n',
	},
	{
		id: 'edge/empty-comment',
		from: `${EDGE}: a comment with no text, and a comment after a statement with no text`,
		source: '//\nlevel "T" 40x20 ground=4 id=crater //\nstart 3,4 //   \n',
	},
	{
		id: 'edge/large-integers',
		from: `${EDGE}: integers beyond the safe range for a double`,
		source:
			'level "T" 99999999999999999999x30 ground=9007199254740993 id=crater\nstart 3,4\nterrain\n  flat 9007199254740993\nblocks\n  block x=0..9007199254740993 y=1\n',
	},
	{
		id: 'edge/exponent-sized-integers',
		from: `${EDGE}: integers whose text needs an exponent when printed as a number`,
		source:
			'level "T" 1000000000000000000000x1000000000000000000000 ground=1 id=crater\nstart 3,4\nterrain\n  flat 123456789012345678901234\nblocks\n  block x=1000000000000000000000 y=2000000000000000000000\n',
	},
	{
		id: 'edge/infinite-integers',
		from: `${EDGE}: integers so large they overflow to Infinity`,
		source: `level "T" ${BIG}x${BIG} ground=${BIG} id=crater\nstart 3,4\nblocks\n  block x=${BIG} y=1\n  block x=-1 y=1\n`,
	},
	{
		id: 'edge/infinite-spawn-position',
		from: `${EDGE}: a spawn position that overflows to Infinity in a small level`,
		source: `${T}enemies\n  gloop x=${BIG}\n`,
	},
	{
		id: 'edge/large-negative-integer',
		from: `${EDGE}: a very large negative integer`,
		source: `${T}blocks\n  block x=-99999999999999999999 y=2\n`,
	},
	{
		id: 'edge/backwards-huge-range',
		from: `${EDGE}: a backwards range whose bounds print with an exponent`,
		source: `${T}blocks\n  block x=1000000000000000000000..5 y=2\n`,
	},
	{
		id: 'edge/negative-zero',
		from: `${EDGE}: negative zero and leading zeros keep their text`,
		source: `${T}blocks\n  block x=-0 y=007\nenemies\n  drone x=1.50 y=-0.0\n`,
	},
	{
		id: 'edge/float-text',
		from: `${EDGE}: decimals print as written, trailing zeros included`,
		source:
			'level "T" 40x20 ground=4 id=crater\nstart 3.50,4.0\nblocks\n  hover from=1.10,5.0 to=4.250,5.00 speed=0.30 size=3.0x0.50 dwell=2.0\n',
	},
	{
		id: 'edge/unicode-whitespace-separators',
		from: `${EDGE}: no-break and ideographic spaces count as whitespace, as in JavaScript`,
		source: 'level "T" 40x20　ground=4 id=crater\nstart 3,4\nterrain\n　 flat 40 \n',
	},
	{
		id: 'edge/unicode-byte-order-mark',
		from: `${EDGE}: a byte order mark is trimmed as whitespace by JavaScript`,
		source: '﻿level "T" 40x20 ground=4 id=crater\nstart 3,4\n﻿\n﻿// note\n',
	},
	{
		id: 'edge/unicode-next-line-is-not-whitespace',
		from: `${EDGE}: U+0085 is whitespace to Rust but not to JavaScript`,
		source:
			'level "T" 40x20 ground=4 id=crater\nstart 3,4\nterrain\n\u0085flat 40\n  flat\u008540\n\u0085\n',
	},
	{
		id: 'edge/unicode-line-separators',
		from: `${EDGE}: U+2028 and U+2029 are not line breaks to the parser but are whitespace`,
		source: 'level "T" 40x20 ground=4 id=crater \nstart 3,4\nterrain\n  flat 40 \n \n',
	},
	{
		id: 'edge/unicode-line-separator-in-header-tail',
		from: `${EDGE}: a line terminator inside the level header tail stops it matching`,
		source: 'level "T" 40x20 ground=4 id=crater\nstart 3,4\n',
	},
	{
		id: 'edge/unicode-names',
		from: `${EDGE}: non-ASCII level names, comments and unknown words`,
		source:
			'level "Crème brûlée \u{1f36e}" 40x20 ground=4 id=crater // café \u{1f36e}\nstart 3,4\nterrain\n  flat 40\nblocks\n  \u{1f36e}\u{1f36e} x=1 y=1\n  blöck x=1 y=1\n',
	},
	{
		id: 'edge/unicode-astral-did-you-mean',
		from: `${EDGE}: edit distance counts UTF-16 units, so an astral character costs two`,
		source: `${T}blocks\n  bl\u{1f36e}ck x=1 y=1\n  bl\u{1f36e} x=1 y=1\n  böck x=1 y=1\n`,
	},
	{ id: 'edge/empty-file', from: `${EDGE}: an empty file`, source: '' },
	{
		id: 'edge/lone-comment',
		from: `${EDGE}: a file holding one comment and nothing else`,
		source: '// nothing here',
	},
	{
		id: 'edge/lone-comment-newline',
		from: `${EDGE}: one comment and a final newline`,
		source: '// nothing here\n',
	},
	{
		id: 'edge/whitespace-only',
		from: `${EDGE}: a file of whitespace only`,
		source: '  \n\t\n \r\n',
	},
	{
		id: 'edge/tabs-for-indentation',
		from: `${EDGE}: tabs as separators and indentation`,
		source: 'level\t"T"\t40x20\tground=4\tid=crater\nstart\t3,\t4\nterrain\n\tflat\t40,\tup\t2\n',
	},
	{
		id: 'edge/spaces-around-commas',
		from: `${EDGE}: whitespace before and after commas in lists and pairs`,
		source: `${T}blocks\n  hover from=1 , 5 to=4 ,5 speed=0.3\n  crystal x=1 ,\t3 , 5..6\n`,
	},
	{
		id: 'edge/duplicate-field',
		from: `${EDGE}: a field given twice`,
		source: `${T}blocks\n  block x=1 x=2 y=3\n`,
	},
	{
		id: 'edge/start-with-fields',
		from: `${EDGE}: start ignores fields but the duplicate check still runs`,
		source: 'level "T" 40x20 ground=4 id=crater\nstart 3,4 a=1 a=2\n',
	},
	{
		id: 'edge/terrain-segment-faults',
		from: `${EDGE}: every way a terrain segment can be malformed`,
		source: `${HEAD}terrain\n  flat\n  flat 1 2\n  flat 3,\n  flat -4\n  flat 1.5\n  FLAT 3\n  liquid\n  liquid block\n  liquid choc extra\n`,
	},
	{
		id: 'edge/level-header-faults',
		from: `${EDGE}: level headers that are too small, mistyped or repeated`,
		source: 'level "T" 2x2 ground=4 id=crater\nlevel "T" 5x5 ground=x id=crater\nstart 1,1\n',
	},
	{
		id: 'edge/level-header-missing-id',
		from: `${EDGE}: a level header without ground or id`,
		source: 'level "T" 40x20\nstart 3,4\nterrain\n  flat 40\n',
	},
	{
		id: 'edge/level-header-extra-field',
		from: `${EDGE}: a level header with an unknown field`,
		source: 'level "T" 40x20 ground=4 id=crater colour=red\nstart 3,4\n',
	},
	{
		id: 'edge/level-header-empty-value',
		from: `${EDGE}: a field with an equals sign and no value`,
		source: 'level "T" 40x20 ground= id=crater\nstart 3,4\n',
	},
	{
		id: 'edge/second-level-header',
		from: `${EDGE}: a second level header`,
		source: 'level "T" 40x20 ground=4 id=crater\nlevel "U" 40x20 ground=4 id=crater\nstart 3,4\n',
	},
	{
		id: 'edge/section-before-level',
		from: `${EDGE}: a section header before the level header is accepted`,
		source: 'terrain\nlevel "T" 40x20 ground=4 id=crater\nstart 3,4\n  flat 40\n',
	},
	{
		id: 'edge/section-after-edits',
		from: `${EDGE}: a section header after the edits block`,
		source: `${HEAD}edits\nterrain\nedits\n`,
	},
	{
		id: 'edge/section-header-with-trailing-words',
		from: `${EDGE}: a section word with something after it is not a header`,
		source: `${HEAD}terrain extra\nterrain\n  flat 40\ntreats now\n`,
	},
	{
		id: 'edge/channel-faults',
		from: `${EDGE}: channel lists with gaps, numbers out of bounds and extra words`,
		source: `${OBJ_HEAD}  channel 1,,2 on\n  channel 32 on\n  channel -1 off\n  channel 1,2\n  channel 1 on extra\n  channel 0,31 off\n`,
	},
	{
		id: 'edge/hover-size-faults',
		from: `${EDGE}: hover sizes and positions that are malformed or empty`,
		source: `${OBJ_HEAD}  hover from=1,5 to=4,5 speed=0.3 size=3x\n  hover from=1,5 to=4,5 speed=0.3 size=x2\n  hover from=1,5 to=4,5 speed=0.3 size=\n  hover from=1,5,6 to=4,5 speed=0.3\n  hover from=1 to=4,5 speed=0.3\n  hover from=1,5 to=4,5 speed=fast\n`,
	},
	{
		id: 'edge/vine-nook-direction',
		from: `${EDGE}: vine-nook direction other than 1 or -1, and a zero depth`,
		source: `${OBJ_HEAD}  vine-nook x=20 foot=4 shelf=9 dir=2 depth=3 h=3\n  vine-nook x=20 foot=4 shelf=9 dir=1 depth=0 h=3\n`,
	},
	{
		id: 'edge/range-forms',
		from: `${EDGE}: range syntax variations, valid and not`,
		source: `${T}blocks\n  block x=1...3 y=2\n  block x=-3..-1 y=2\n  block x=1..-3 y=2\n  block x=..3 y=2\n  block x=3.. y=2\n  block x=1,2 y=2\n  block x=1.5 y=2\n  block x= y=2\n`,
	},
	{
		id: 'edge/treats-and-edits',
		from: `${EDGE}: item rows, placed items and painted tiles with lists`,
		source: `${T}treats\n  cheezie x=1..3,7,9 y=5\n  cheezie x=1 y=4..6\n  row cheezie x=2..8 y=5 by=2\n  row key-red x=2..9 y=5 by=2\n  pogo-cache x=2..4 rise=7\nedits\n  paint one-way x=1,3,5..6 y=4,8\n  clear x=1..3 y=5\n  place usb x=4 y=5\n  place choc x=4 y=5\n`,
	},
	{
		id: 'edge/spawn-faults',
		from: `${EDGE}: spawn positions, flags and directions`,
		source: `${T}enemies\n  gloop x=3.5, 7\n  gloop x=40\n  gloop x=-0.5\n  bat x=3 y=5 dir=-1\n  bat x=3 dir=1\n  bat x=3 y=5 ride ride\n  boss x=\n`,
	},
	{
		id: 'edge/crystal-faults',
		from: `${EDGE}: crystal with a height, before terrain and outside the level`,
		source: `${HEAD}blocks\n  crystal x=1 y=2\n  crystal x=1\nterrain\n  flat 40\nblocks\n  crystal x=1 y=2\n  crystal x=40\n`,
	},
	{
		id: 'edge/top-word-faults',
		from: `${EDGE}: top-level statements that are repeated, malformed or unknown`,
		source: `${HEAD}theme crater\ntheme crater\ntheme\ntheme volcano\narea crater-fields extra\narea\nstart\nstart 1\nstart 1,2,3\nstart a,b\nwalls\nwalls\nwalls now\narena x=1..2\narena x=1..2 floor=4\narena x=1..2 floor=4\n`,
	},
	{
		id: 'edge/words-in-the-wrong-places',
		from: `${EDGE}: words that belong to another section, or to none`,
		source: `${HEAD}hover from=1,5 to=4,5 speed=0.3\nterrain\n  block x=1 y=1\n  empty x=1 y=1\n  gloop x=1\n  paint block x=1 y=1\n  ???\nblocks\n  empty x=1 y=1\n  flatt 3\ntreats\n  gloop x=1\n  rowx x=1\nenemies\n  row cheezie x=1 y=1\n  gloo x=1\n`,
	},
	{
		id: 'edge/unknown-word-no-neighbour',
		from: `${EDGE}: an unknown word with nothing close enough lists the section's words`,
		source: `${HEAD}terrain\n  zzzzzzzz 3\nblocks\n  qqqqqqqq x=1 y=1\nqqqqqqqq\n`,
	},
	{
		id: 'edge/unknown-statement-before-level',
		from: `${EDGE}: an unknown statement before the level header`,
		source: 'floop 1\nlevel "T" 40x20 ground=4 id=crater\nstart 3,4\n',
	},
	{
		id: 'edge/only-start-line',
		from: `${EDGE}: a script of one statement and no level header`,
		source: 'start 3,4',
	},
];

export const CASES: Case[] = [
	...parserCases,
	...printerCases,
	...errorCases,
	...objectCases,
	...edgeCases,
];

const one = (n: number) => [{ lo: n, hi: n }];
const span = (lo: number, hi: number) => [{ lo, hi }];
const EDITS = 'packages/language/test/edits.test.ts';
const BASE = `${HEAD}\nterrain\n  flat 40   // all flat\n\ntreats\n  soda x=5 y=5\n`;
const clear = (x: number, y: number): Edit => ({ op: 'clear', xs: one(x), ys: one(y) });

export const EDIT_CASES: EditCase[] = [
	{
		id: 'edits/creates-block',
		from: `${EDITS}: appending creates the block after one blank line and keeps the final newline`,
		source: BASE,
		edits: [{ op: 'paint', tile: 'one-way', xs: [...one(26), ...one(28)], ys: one(9) }],
	},
	{
		id: 'edits/two-rounds-folded',
		from: `${EDITS}: appending never rewrites a hand-written line (both edits in one call)`,
		source: BASE,
		edits: [clear(1, 5), { op: 'place', kind: 'cookie', xs: one(2), ys: one(6) }],
	},
	{
		id: 'edits/ranges-and-cross-product',
		from: `${EDGE}: ranges and lists on both axes print as a cross product line`,
		source: BASE,
		edits: [
			{
				op: 'paint',
				tile: 'block',
				xs: [...span(3, 5), ...one(9)],
				ys: [...one(7), ...span(10, 12)],
			},
			{ op: 'place', kind: 'cheezie', xs: span(26, 30), ys: span(10, 10) },
		],
	},
	{
		id: 'edits/existing-block-trailing-blanks',
		from: `${EDITS}: appending to an existing block adds after its last line, before trailing blanks`,
		source: `${BASE}\nedits\n  clear x=1 y=1\n\n\n`,
		edits: [clear(2, 2)],
	},
	{
		id: 'edits/existing-block-with-comment',
		from: `${EDGE}: an existing edits block with a header comment and an edit comment`,
		source: `${BASE}\nedits   // painted in the studio\n  paint block x=3..4 y=7   // a ledge\n`,
		edits: [{ op: 'paint', tile: 'one-way', xs: one(4), ys: one(7) }],
	},
	{
		id: 'edits/no-final-newline',
		from: `${EDGE}: a final line without a newline`,
		source: BASE.trimEnd(),
		edits: [clear(1, 1)],
	},
	{
		id: 'edits/no-final-newline-existing-block',
		from: `${EDGE}: an existing edits block whose last line has no newline`,
		source: `${BASE}\nedits\n  clear x=1 y=1`,
		edits: [clear(2, 2)],
	},
	{
		id: 'edits/crlf',
		from: `${EDGE}: CRLF line endings`,
		source: BASE.replaceAll('\n', '\r\n'),
		edits: [clear(1, 1)],
	},
	{
		id: 'edits/crlf-existing-block',
		from: `${EDGE}: CRLF line endings with an existing edits block`,
		source: `${BASE}\nedits\n  clear x=1 y=1\n`.replaceAll('\n', '\r\n'),
		edits: [clear(2, 2)],
	},
	{
		id: 'edits/no-edits',
		from: `${EDGE}: an empty edit list returns the script unchanged`,
		source: BASE,
		edits: [],
	},
	{
		id: 'edits/only-blank-lines',
		from: `${EDGE}: a script of blank lines only`,
		source: '\n\n',
		edits: [clear(1, 1)],
	},
	{
		id: 'edits/empty-script',
		from: `${EDGE}: an empty script`,
		source: '',
		edits: [clear(1, 1)],
	},
	{
		id: 'edits/with-errors',
		from: `${EDGE}: a script with errors keeps its error lines as written`,
		source: `${BASE}floop 1\n`,
		edits: [clear(1, 1)],
	},
	{
		id: 'edits/block-in-the-middle',
		from: `${EDGE}: an edits block that is not last, with a section after it`,
		source: `${BASE}\nedits\n  clear x=1 y=1\n\nenemies\n  gloop x=9\n`,
		edits: [clear(2, 2)],
	},
];

// ---------------------------------------------------------------- overworld scripts

const OW = 'packages/language/test/overworld.test.ts';
/** The test file's header: a 20x20 map of grass with a start, then the `points` section open. */
const OW_HEAD = 'overworld "T" 20x20 id=test\nstart 3,3\nblocks\n  grass x=0..19 y=0..19\npoints\n';
const OW_TOP = 'overworld "T" 20x20 id=test\nstart 3,3\n';
const OW_BLOCKS = `${OW_TOP}blocks\n`;
const OW_POINTS = `${OW_TOP}points\n`;

/** Curated overworld inputs; the corpus parses these with `parseOverworld`. */
export const OVERWORLD_CASES: Case[] = [
	{
		id: 'overworld/header-and-start',
		from: `${OW}: the smallest valid overworld`,
		source: OW_TOP,
	},
	{
		id: 'overworld/everything',
		from: `${EDGE}: one of every statement, with a trailing comment on some`,
		source:
			'// A small map\noverworld "Everything" 30x24 id=main   // header\nstart 9.2, 8.2\narea crater-fields x=0..14 y=0..23\narea gumdrop-isle x=15..29 y=0..23\n\nblocks\n  grass x=0..29 y=0..23\n  river x=10..11 y=0..23   // the river\n  path from=8,9 to=14,6\n  path x=3..4 y=3\n  scatter\npoints\n  level crater at=14,6 big\n  level caves at=20.5,10 req=crater,secret hidden\n  tele pad-a at=12,19 with=pad-b\n  tele pad-b at=2,2 with=pad-a req=crater\n  saucer at=3,3\n  sign 0 at=8,16\nedits\n  tree x=5 y=5\n  sign 1 at=6,6\n',
	},
	{
		id: 'overworld/tele-needs-a-partner',
		from: `${OW}: a teleporter must pair with one that exists`,
		source: `${OW_HEAD}  tele a at=3,3 with=nope\n`,
	},
	{
		id: 'overworld/tele-pair-forward',
		from: `${OW}: a teleporter may pair with one declared later`,
		source: `${OW_HEAD}  tele a at=3,3 with=b\n  tele b at=9,9 with=a req=crater,secret\n`,
	},
	{
		id: 'overworld/tele-two-missing-partners',
		from: `${EDGE}: two teleporters with missing partners list the names that exist`,
		source: `${OW_HEAD}  tele a at=3,3 with=x\n  tele b at=4,4 with=y\n`,
	},
	{
		id: 'overworld/tele-duplicate-name',
		from: `${EDGE}: a second teleporter with the same name`,
		source: `${OW_HEAD}  tele a at=3,3 with=a\n  tele a at=4,4 with=a\n`,
	},
	{
		id: 'overworld/tele-name-kept-after-failure',
		from: `${EDGE}: a teleporter whose line fails after its name is read still holds the name`,
		source: `${OW_HEAD}  tele a at=99,3 with=b\n  tele b at=4,4 with=a\n`,
	},
	{
		id: 'overworld/unknown-level',
		from: `${OW}: a level must be a known level`,
		source: `${OW_HEAD}  level crator at=3,3\n`,
	},
	{
		id: 'overworld/unknown-level-far',
		from: `${EDGE}: an unknown level with no close match lists the choices`,
		source: `${OW_HEAD}  level zzzzzzzz at=3,3\n`,
	},
	{
		id: 'overworld/point-outside-the-map',
		from: `${OW}: a point outside the map is refused`,
		source: `${OW_HEAD}  saucer at=30,3\n`,
	},
	{
		id: 'overworld/point-below-the-map',
		from: `${EDGE}: a negative y is outside the map`,
		source: `${OW_HEAD}  saucer at=3,-1\n`,
	},
	{
		id: 'overworld/point-fraction-floors',
		from: `${EDGE}: a fractional point is checked on the tile it floors to`,
		source: `${OW_HEAD}  saucer at=19.9,0.5\n  saucer at=20.1,3\n`,
	},
	{
		id: 'overworld/level-in-blocks',
		from: `${OW}: a level point belongs under points`,
		source: `${OW_BLOCKS}  saucer at=3,3\n`,
	},
	{
		id: 'overworld/tile-in-points',
		from: `${EDGE}: a tile line belongs under blocks`,
		source: `${OW_POINTS}  grass x=0 y=0\n`,
	},
	{
		id: 'overworld/scatter-in-points',
		from: `${EDGE}: a scatter belongs under blocks`,
		source: `${OW_POINTS}  scatter\n  path from=1,1 to=2,2\n`,
	},
	{
		id: 'overworld/edits-take-both',
		from: `${EDGE}: the edits block takes tile lines and points`,
		source: `${OW_TOP}edits\n  river x=1 y=1\n  saucer at=2,2\n  scatter\n`,
	},
	{
		id: 'overworld/paint-and-clear',
		from: `${EDGE}: paint and clear are not overworld words`,
		source: `${OW_BLOCKS}  paint grass x=1 y=1\n  clear x=1 y=1\n`,
	},
	{
		id: 'overworld/empty-is-not-a-block-word',
		from: `${EDGE}: the empty tile is not a blocks word`,
		source: `${OW_BLOCKS}  empty x=1 y=1\n`,
	},
	{
		id: 'overworld/before-any-section',
		from: `${EDGE}: a statement before any section header`,
		source: `${OW_TOP}grass x=1 y=1\nsaucer at=2,2\n`,
	},
	{
		id: 'overworld/section-before-header',
		from: `${EDGE}: a section header is allowed before the overworld header`,
		source: 'blocks\noverworld "T" 20x20 id=test\nstart 3,3\n',
	},
	{
		id: 'overworld/statement-before-header',
		from: `${EDGE}: a statement before the overworld header`,
		source: 'start 3,3\noverworld "T" 20x20 id=test\n',
	},
	{
		id: 'overworld/second-header',
		from: `${EDGE}: a second overworld header`,
		source: `${OW_TOP}overworld "U" 10x10 id=other\n`,
	},
	{
		id: 'overworld/no-header',
		from: `${EDGE}: a script with no header and no other error`,
		source: '// nothing here\n\n',
	},
	{
		id: 'overworld/header-malformed',
		from: `${EDGE}: a malformed header puts the error on its line and the missing start on line 0`,
		source: 'overworld T 20x20 id=test\n',
	},
	{
		id: 'overworld/header-no-id',
		from: `${EDGE}: a header with no id`,
		source: 'overworld "T" 20x20\nstart 3,3\n',
	},
	{
		id: 'overworld/header-extra-field',
		from: `${EDGE}: a header with an unknown field and a stray word`,
		source: 'overworld "T" 20x20 id=a size=3\nstart 3,3\noverworld "U" 20x20 id=a loose\n',
	},
	{
		id: 'overworld/too-small',
		from: `${EDGE}: an overworld smaller than 3x3`,
		source: 'overworld "T" 2x40 id=test\nstart 0,0\n',
	},
	{
		id: 'overworld/huge',
		from: `${EDGE}: sizes past what a double holds`,
		source: `overworld "T" ${'9'.repeat(400)}x3 id=test\nstart 0,0\nblocks\n  grass x=0..99999 y=0..2\n`,
	},
	{
		id: 'overworld/no-start',
		from: `${EDGE}: a header with no start line`,
		source: 'overworld "T" 20x20 id=test\nblocks\n  grass x=0 y=0\n',
	},
	{
		id: 'overworld/second-start',
		from: `${EDGE}: a second start line`,
		source: `${OW_TOP}start 4,4\n`,
	},
	{
		id: 'overworld/start-forms',
		from: `${EDGE}: start with spaces around the comma`,
		source: 'overworld "T" 20x20 id=test\nstart 1 , 2\n',
	},
	{
		id: 'overworld/start-one-number',
		from: `${EDGE}: start with one number`,
		source: 'overworld "T" 20x20 id=test\nstart 3\n',
	},
	{
		id: 'overworld/start-not-a-number',
		from: `${EDGE}: start with words`,
		source: 'overworld "T" 20x20 id=test\nstart a,2\nstart 1,b\n',
	},
	{
		id: 'overworld/start-three',
		from: `${EDGE}: start with three numbers, an empty one and none`,
		source: 'overworld "T" 20x20 id=test\nstart 1,2,3\nstart 1,\nstart ,\nstart\n',
	},
	{
		id: 'overworld/area-unknown',
		from: `${EDGE}: an unknown area, near and far`,
		source: `${OW_TOP}area crater-field x=0..1 y=0..1\narea moon x=0..1 y=0..1\n`,
	},
	{
		id: 'overworld/area-missing-parts',
		from: `${EDGE}: an area with no name, no x and no y`,
		source: `${OW_TOP}area\narea crater-fields y=0..1\narea crater-fields x=0..1\n`,
	},
	{
		id: 'overworld/area-outside',
		from: `${EDGE}: an area that runs off the map`,
		source: `${OW_TOP}area crater-fields x=0..20 y=-1..3\narea crater-fields x=5 y=19..20\n`,
	},
	{
		id: 'overworld/area-bad-range',
		from: `${EDGE}: an area with a backwards range, a list and an extra field`,
		source: `${OW_TOP}area crater-fields x=5..1 y=0\narea crater-fields x=1,2 y=0\narea crater-fields x=1 y=0 z=3\n`,
	},
	{
		id: 'overworld/area-in-a-section',
		from: `${EDGE}: an area line may sit inside any section`,
		source: `${OW_POINTS}  area gumdrop-isle x=0..4 y=0..4\n`,
	},
	{
		id: 'overworld/req-unknown',
		from: `${EDGE}: an unknown requirement, near and far`,
		source: `${OW_HEAD}  level caves at=1,1 req=crator\n  level caves at=1,1 req=secrt\n  level caves at=1,1 req=crater,moon\n`,
	},
	{
		id: 'overworld/req-empty-item',
		from: `${EDGE}: a requirement list with an empty item`,
		source: `${OW_HEAD}  level caves at=1,1 req=crater,,secret\n  level caves at=1,1 req=crater, secret\n`,
	},
	{
		id: 'overworld/req-without-value',
		from: `${EDGE}: req= with no value`,
		source: `${OW_HEAD}  level caves at=1,1 req=\n`,
	},
	{
		id: 'overworld/path-fractional',
		from: `${EDGE}: a path between fractional tiles, and whole numbers written with a fraction`,
		source: `${OW_BLOCKS}  path from=1.5,2 to=4,4\n  path from=1.0,2.0 to=4,4\n`,
	},
	{
		id: 'overworld/path-outside',
		from: `${EDGE}: a path that leaves the map`,
		source: `${OW_BLOCKS}  path from=1,2 to=40,4\n  path from=1,2 to=4,-3\n`,
	},
	{
		id: 'overworld/path-missing-end',
		from: `${EDGE}: a path with no end, with a single number, and with a stray word`,
		source: `${OW_BLOCKS}  path from=1,2\n  path from=1 to=2,2\n  path from=1,2 to=3,3 loose\n`,
	},
	{
		id: 'overworld/path-as-a-tile',
		from: `${EDGE}: path as a tile word, with and without its fields`,
		source: `${OW_BLOCKS}  path x=1..2 y=3\n  path\n  path y=1\n`,
	},
	{
		id: 'overworld/sign-numbers',
		from: `${EDGE}: sign numbers as JavaScript's Number() reads them`,
		source: `${OW_HEAD}  sign 0 at=1,1\n  sign 0x10 at=1,1\n  sign 1e1 at=1,1\n  sign 5. at=1,1\n  sign -0 at=1,1\n  sign +3 at=1,1\n`,
	},
	{
		id: 'overworld/sign-bad',
		from: `${EDGE}: sign numbers that are refused`,
		source: `${OW_HEAD}  sign -1 at=1,1\n  sign 1.5 at=1,1\n  sign x at=1,1\n  sign Infinity at=1,1\n  sign\n  sign 2\n`,
	},
	{
		id: 'overworld/unknown-in-blocks',
		from: `${EDGE}: an unknown statement under blocks lists the first twelve words`,
		source: `${OW_BLOCKS}  floop x=1\n  grasss x=1 y=1\n`,
	},
	{
		id: 'overworld/unknown-in-points',
		from: `${EDGE}: an unknown statement under points lists all four words`,
		source: `${OW_POINTS}  lvl crater at=1,1\n`,
	},
	{
		id: 'overworld/unknown-in-edits',
		from: `${EDGE}: an unknown statement in the edits block`,
		source: `${OW_TOP}edits\n  floop\n`,
	},
	{
		id: 'overworld/section-after-edits',
		from: `${EDGE}: a section after the edits block`,
		source: `${OW_TOP}edits\nblocks\npoints\nedits\n`,
	},
	{
		id: 'overworld/section-with-words',
		from: `${EDGE}: a section word followed by something else is not a section header`,
		source: `${OW_TOP}blocks extra\npoints\n`,
	},
	{
		id: 'overworld/tile-fields',
		from: `${EDGE}: tile lines with missing, repeated and unknown fields`,
		source: `${OW_BLOCKS}  grass y=1\n  grass x=1\n  grass x=1 x=2 y=0\n  grass x=1 y=0 z=1\n  grass x=1..30 y=0\n  grass x=1 y=0 loose\n`,
	},
	{
		id: 'overworld/tile-outside',
		from: `${EDGE}: tile ranges that leave the map`,
		source: `${OW_BLOCKS}  grass x=-1..3 y=0\n  grass x=0 y=0..20\n  grass x=0..19 y=19\n`,
	},
	{
		id: 'overworld/scatter-with-words',
		from: `${EDGE}: scatter takes nothing`,
		source: `${OW_BLOCKS}  scatter now\n  scatter x=1\n`,
	},
	{
		id: 'overworld/level-flags',
		from: `${EDGE}: level flags in any order, and a repeated flag`,
		source: `${OW_POINTS}  level crater hidden at=1,1 big\n  level crater at=2,2 big big\n  level crater at=3,3 req=caves\n`,
	},
	{
		id: 'overworld/level-missing-parts',
		from: `${EDGE}: level points with a missing name or position`,
		source: `${OW_POINTS}  level\n  level crater\n  level crater at=1\n  level crater at=a,b\n  level crater at=1,2,3\n`,
	},
	{
		id: 'overworld/tele-missing-parts',
		from: `${EDGE}: teleporters with a missing name, position or partner`,
		source: `${OW_POINTS}  tele\n  tele a\n  tele b at=1,1\n  tele c at=1,1 with=\n`,
	},
	{
		id: 'overworld/saucer-extra',
		from: `${EDGE}: a saucer with extra words`,
		source: `${OW_POINTS}  saucer\n  saucer at=1,1 hidden\n  saucer at=1,1 req=crater\n`,
	},
	{
		id: 'overworld/duplicate-fields-before-a-name',
		from: `${EDGE}: a repeated field fails before the statement is read, even on start`,
		source: `${OW_TOP}start a=1 a=2\narea x=1 x=2\n`,
	},
	{
		id: 'overworld/comments',
		from: `${EDGE}: comments, a quoted // in the name, and comment-only lines`,
		source:
			'// top\noverworld "A // B" 20x20 id=test // header\n  // indented\nstart 3,3   //\n\n   \nblocks // here\n  grass x=0 y=0 // tile\n',
	},
	{
		id: 'overworld/whitespace',
		from: `${EDGE}: tabs, odd spacing and a non-breaking space`,
		source:
			'overworld\t"T"\t20x20\tid=test\n\tstart\t3 ,\t4\nblocks\n\t\tgrass\tx=0..1\ty=0\n  river x=2 y=2\n',
	},
	{
		id: 'overworld/unicode-name',
		from: `${EDGE}: a name with accents and an emoji`,
		source: 'overworld "Café 🍬" 20x20 id=test\nstart 3,3\n',
	},
	{
		id: 'overworld/bom',
		from: `${EDGE}: a byte order mark before the header`,
		source: '﻿overworld "T" 20x20 id=test\nstart 3,3\n',
	},
	{
		id: 'overworld/edge-crlf',
		from: `${EDGE}: CRLF line endings`,
		source: `${OW_HEAD}  saucer at=3,3\n  tele a at=4,4 with=a\n`.replaceAll('\n', '\r\n'),
	},
	{
		id: 'overworld/edge-no-final-newline',
		from: `${EDGE}: a last line with no newline`,
		source: `${OW_HEAD}  saucer at=3,3`,
	},
	{
		id: 'overworld/edge-empty',
		from: `${EDGE}: an empty file`,
		source: '',
	},
	{
		id: 'overworld/edge-lone-comment',
		from: `${EDGE}: a file that is one comment`,
		source: '// just a comment',
	},
	{
		id: 'overworld/edge-lone-comment-and-newline',
		from: `${EDGE}: a comment and a final newline`,
		source: '// just a comment\n',
	},
	{
		id: 'overworld/edge-blank-lines',
		from: `${EDGE}: blank lines only`,
		source: '\n\n  \n',
	},
	{
		id: 'overworld/edge-level-script',
		from: `${EDGE}: a level script read as an overworld`,
		source: HEAD,
	},
	{
		id: 'overworld/edge-line-separator',
		from: `${EDGE}: a line separator inside a header and inside a comment`,
		source: 'overworld "T" 20x20 id=a b\nstart 3,3 // x y\n',
	},
	{
		id: 'overworld/edge-lone-cr',
		from: `${EDGE}: a lone carriage return in the middle of a header`,
		source: 'overworld "T" 20x20 id=a\rb\nstart 3,3\n',
	},
	{
		id: 'overworld/is-overworld-comment-first',
		from: `${EDGE}: an overworld header after comment and blank lines`,
		source: '\n// c\n  // d\n\noverworld "T" 20x20 id=test\nstart 3,3\n',
	},
];
