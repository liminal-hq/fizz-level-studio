// The curated inputs for the Fizz 1 conformance corpus: test sources and edge cases, each with an id.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** One curated input. `id` is `<group>/<name>` and names the fixture files. */
export interface Case {
	id: string;
	/** Where the input came from, so a failing fixture can be traced back. */
	from: string;
	source: string;
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
