// Name tables that map Fizz script words to the Rust names the Builder uses.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** Terrain segments: script word to the `Seg` variant in `levels.rs`. */
export const SEGS: Record<string, string> = {
	'flat': 'Flat',
	'up': 'Up',
	'down': 'Down',
	'up22': 'Up22',
	'down22': 'Down22',
	'gap': 'Gap',
	'pool': 'Pool',
	'spikes': 'Spikes',
	'belt-r': 'BeltR',
	'belt-l': 'BeltL',
};

/** Tiles: script word to the constant in `tiles.rs`. `empty` is the tile `clear` paints. */
export const TILES: Record<string, string> = {
	'empty': 'EMPTY',
	'fill': 'FILL',
	'block': 'BLOCK',
	'one-way': 'PLAT',
	'spike': 'SPIKE',
	'choc': 'CHOC',
	'slope-r45': 'R45',
	'slope-l45': 'L45',
	'slope-r22a': 'R22A',
	'slope-r22b': 'R22B',
	'slope-l22a': 'L22A',
	'slope-l22b': 'L22B',
	'red-door': 'DOOR_R',
	'blue-door': 'DOOR_B',
	'green-door': 'DOOR_G',
	'bridge': 'BRIDGE',
	'mural-origin': 'MURAL',
	'mural-part': 'MURAL_PART',
	'crystal-tile': 'CRYS',
	'exit': 'EXIT',
	'grass': 'GRASS',
	'path': 'PATH',
	'river': 'RIVER',
	'tree': 'TREE',
	'rock': 'ROCK',
	'conveyor-l': 'CONV_L',
	'conveyor-r': 'CONV_R',
	'furnace': 'FURNACE',
	'wall-bg': 'WALLBG',
	'rung': 'RUNG',
	'rung-top': 'RUNG_TOP',
	'facade': 'FACADE',
	'gate': 'GATE',
	'gate-2': 'GATE_2',
	'gate-3': 'GATE_3',
	'vine': 'VINE',
	'cracked': 'CRACKED',
	'house-a': 'HOUSE_A',
	'house-b': 'HOUSE_B',
	'shop': 'SHOP',
	'fountain': 'FOUNTAIN',
};

/** Tiles a `liquid` line may name: the ones `Pool` segments can be filled with. */
export const LIQUIDS = ['choc', 'furnace'];

/** Items: script word to the `ItemKind` variant in `ents.rs`. */
export const ITEMS: Record<string, string> = {
	'cheezie': 'Cheezie',
	'choc': 'Choc',
	'cookie': 'Cookie',
	'soda': 'Soda',
	'key-red': 'KeyRed',
	'key-blue': 'KeyBlue',
	'key-green': 'KeyGreen',
	'usb': 'Usb',
};

/** Spawn kinds: script word to the `Kind` variant in `ents.rs`. */
export const KINDS: Record<string, string> = {
	'gloop': 'Gloop',
	'hopper': 'Hopper',
	'marsh': 'Marsh',
	'beetle': 'Beetle',
	'bat': 'Bat',
	'pod': 'Pod',
	'phantom': 'Phantom',
	'roller': 'Roller',
	'sentry': 'Sentry',
	'drone': 'Drone',
	'boss': 'Boss',
	'switch': 'Switch',
	'terminal': 'Terminal',
	'cage': 'Cage',
	'mirror': 'Mirror',
	'swivel': 'Swivel',
	'crystal-switch': 'CrystalSwitch',
	'press': 'Press',
	'target': 'Target',
	'glyph': 'Glyph',
	'cameo': 'Cameo',
};

export interface LevelDef {
	rust: string;
	theme: string;
	area: string;
}

/** The `LEVELS` table in `levels.rs`: `Builder::out` takes the theme and area from it by id. */
export const LEVEL_IDS: Record<string, LevelDef> = {
	'crater': { rust: 'CRATER', theme: 'crater', area: 'crater-fields' },
	'caves': { rust: 'CAVES', theme: 'caves', area: 'rock-candy-reach' },
	'citadel': { rust: 'CITADEL', theme: 'citadel', area: 'frosting-frontier' },
	'meteor-mesa': { rust: 'METEOR_MESA', theme: 'open-sky', area: 'crater-fields' },
	'zarg-lookout': { rust: 'ZARG_LOOKOUT', theme: 'building', area: 'crater-fields' },
	'marshmallow-meadows': { rust: 'MARSHMALLOW_MEADOWS', theme: 'open-sky', area: 'marshmallow-meadows' },
	'bonbon-playhouse': { rust: 'BONBON_PLAYHOUSE', theme: 'theatre', area: 'marshmallow-meadows' },
	'fudge-bog': { rust: 'FUDGE_BOG', theme: 'crater', area: 'marshmallow-meadows' },
	'mirror-shafts': { rust: 'MIRROR_SHAFTS', theme: 'shaft', area: 'rock-candy-reach' },
	'sugar-glass-gallery': { rust: 'SUGAR_GLASS_GALLERY', theme: 'theatre', area: 'rock-candy-reach' },
	'frosting-flats': { rust: 'FROSTING_FLATS', theme: 'open-sky', area: 'frosting-frontier' },
	'frosting-spire': { rust: 'FROSTING_SPIRE', theme: 'building', area: 'frosting-frontier' },
	'cocoa-foundry': { rust: 'COCOA_FOUNDRY', theme: 'foundry', area: 'frosting-frontier' },
	'gumdrop-isle': { rust: 'GUMDROP_ISLE', theme: 'open-sky', area: 'gumdrop-isle' },
	'whisper-hollow': { rust: 'WHISPER_HOLLOW', theme: 'caves', area: 'rock-candy-reach' },
	'saucer': { rust: 'SAUCER', theme: 'building', area: 'crater-fields' },
};

export const THEMES = ['crater', 'caves', 'citadel', 'open-sky', 'building', 'theatre', 'shaft', 'foundry'];
export const AREAS = ['crater-fields', 'marshmallow-meadows', 'rock-candy-reach', 'frosting-frontier', 'gumdrop-isle'];
