// Builds the guest-js bundle for the fizz-studio-settings plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import typescript from '@rollup/plugin-typescript';

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
const external = [/^@tauri-apps\/api/, /^@liminal-hq\//, ...Object.keys(pkg.dependencies || {})];

export default {
	input: 'guest-js/index.ts',
	output: [
		{ file: pkg.exports.import, format: 'es', sourcemap: true },
		{ file: pkg.exports.require, format: 'cjs', sourcemap: true },
	],
	external,
	plugins: [typescript({ declaration: true, declarationDir: './dist-js' })],
	onwarn(warning) {
		throw Object.assign(new Error(), warning);
	},
};
