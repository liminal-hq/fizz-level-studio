// MCP server over stdio for one Fizz level file: `bun packages/mcp/src/server.ts levels/crater.fizz`.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Studio } from './studio.ts';
import { callTool, TOOLS } from './tools.ts';

const arg = process.argv[2];
if (!arg || !arg.endsWith('.fizz')) {
	console.error('usage: bun packages/mcp/src/server.ts <level.fizz>');
	process.exit(2);
}
const levelPath = resolve(arg);
if (!existsSync(levelPath)) {
	console.error(`level file not found: ${levelPath}`);
	process.exit(2);
}
const studio = new Studio(levelPath);

const server = new Server(
	{ name: 'fizz-level-studio', version: '0.1.0' },
	{
		capabilities: { tools: {} },
		instructions:
			'Fizz Level Studio. Read the level with get_level and get_region, then change it with edit_level. In the default propose mode your edits are only proposals that the person accepts or rejects; you cannot change the mode or accept anything yourself.',
	},
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
	const r = callTool(studio, req.params.name, req.params.arguments);
	return { content: [{ type: 'text' as const, text: r.text }], structuredContent: r.structured, isError: r.isError === true };
});

await server.connect(new StdioServerTransport());
