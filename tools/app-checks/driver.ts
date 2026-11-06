// A small driver for the running app: launches the debug build and talks to it through tauri-mcp-server
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const root = resolve(import.meta.dir, '../..');
export const binary = process.env.FIZZ_APP_BINARY ?? join(root, 'target/debug/fizz-level-studio');

/** An isolated profile: the app's config and data live here, never in the person's own. */
export interface Profile {
	dir: string;
	config: string;
	data: string;
}

export function makeProfile(): Profile {
	const dir = mkdtempSync(join(tmpdir(), 'fizz-app-checks-'));
	return { dir, config: join(dir, 'config'), data: join(dir, 'data') };
}

/**
 * The port this run's app listens on for the debug automation bridge, and the one the harness talks
 * to. The bridge takes the first free port from its base, so a fixed port meant that while another
 * copy of the app was up (a build someone was trying by hand, another check run, a helper's run) the
 * checks silently drove THAT app and failed in confusing ways that looked like flaky tests. Each run
 * now picks its own base port (set `FIZZ_BRIDGE_PORT` to choose one) and tells the app through the
 * environment.
 */
export let bridgePort = 9223;

/**
 * This run's app identity for the single-instance guard (see `single_instance` in the app's lib.rs):
 * the first copy on a machine would otherwise take every other copy's launch and make it quit.
 */
export const instanceId = `${process.pid}`;

/** Whether something is already listening on `port` on this machine. */
function listening(port: number): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		Bun.connect({
			hostname: '127.0.0.1',
			port,
			socket: {
				open(socket) {
					socket.end();
					resolve(true);
				},
				error() {
					resolve(false);
				},
				connectError() {
					resolve(false);
				},
				data() {},
			},
		}).catch(() => resolve(false));
	});
}

/**
 * Picks this run's bridge port: `FIZZ_BRIDGE_PORT` when set, otherwise a random base in 9400 to 9899
 * (the bridge scans up to 100 ports from its base, so bases are 100 apart) that nothing is using.
 */
export async function chooseBridgePort(): Promise<number> {
	const fixed = Number(process.env.FIZZ_BRIDGE_PORT);
	if (Number.isInteger(fixed) && fixed > 0) {
		bridgePort = fixed;
		return bridgePort;
	}
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const base = 9400 + Math.floor(Math.random() * 5) * 100;
		if (!(await listening(base))) {
			bridgePort = base;
			return bridgePort;
		}
	}
	throw new Error('no free port for the automation bridge between 9400 and 9899');
}

export function sleep(ms: number): Promise<void> {
	return new Promise((done) => setTimeout(done, ms));
}

/** Polls `test` until it is true or `ms` pass; returns how long it took, or null on timeout. */
export async function within(
	ms: number,
	test: () => boolean | Promise<boolean>,
): Promise<number | null> {
	const started = performance.now();
	while (performance.now() - started < ms) {
		if (await test()) return performance.now() - started;
		await sleep(25);
	}
	return null;
}

/** The app process under test. */
export class App {
	child: ChildProcess;
	log = '';

	constructor(profile: Profile, args: string[]) {
		this.child = spawn(binary, args, {
			env: {
				...process.env,
				XDG_CONFIG_HOME: profile.config,
				XDG_DATA_HOME: profile.data,
				FIZZ_BRIDGE_PORT: String(bridgePort),
				FIZZ_INSTANCE_ID: instanceId,
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const collect = (chunk: Buffer) => (this.log += chunk.toString());
		this.child.stdout?.on('data', collect);
		this.child.stderr?.on('data', collect);
	}

	get alive(): boolean {
		return this.child.exitCode === null && this.child.signalCode === null;
	}

	/** Ends the app the way a crash does: no chance to clean up. */
	async crash(): Promise<void> {
		this.child.kill('SIGKILL');
		await within(5000, () => !this.alive);
	}

	async quit(): Promise<void> {
		this.child.kill('SIGTERM');
		if ((await within(5000, () => !this.alive)) === null) await this.crash();
	}
}

/** A session with the app's automation bridge, through tauri-mcp-server. */
export class Bridge {
	private constructor(private client: Client) {}

	static async connect(): Promise<Bridge> {
		const transport = new StdioClientTransport({
			command: 'bun',
			args: [join(root, 'node_modules/@hypothesi/tauri-mcp-server/dist/index.js')],
		});
		const client = new Client({ name: 'fizz-app-checks', version: '0.0.0' });
		await client.connect(transport);
		return new Bridge(client);
	}

	async call(name: string, args: Record<string, unknown>): Promise<string> {
		const result = await this.client.callTool({ name, arguments: args });
		const text = (result.content as { type: string; text?: string }[])
			.map((part) => part.text ?? '')
			.join('\n');
		if (result.isError) throw new Error(`${name}: ${text}`);
		return text;
	}

	/** Starts a session with the app on 127.0.0.1, waiting for the bridge to come up. */
	async start(): Promise<void> {
		const up = await within(30_000, async () => {
			try {
				const text = await this.call('driver_session', {
					action: 'start',
					host: '127.0.0.1',
					port: bridgePort,
				});
				if (!/Session started/.test(text)) return false;
				// When the app is not up on our port yet the bridge server falls back to any app it can
				// find (another run's, a helper's), and says "Session started" all the same. Only a
				// session on OUR port counts; anything else is dropped and tried again.
				const status = JSON.parse(await this.call('driver_session', { action: 'status' })) as {
					port?: number;
				};
				if (status.port === bridgePort) return true;
				await this.call('driver_session', { action: 'stop' }).catch(() => undefined);
				return false;
			} catch {
				return false;
			}
		});
		if (up === null) throw new Error('the automation bridge did not come up in 30 s');
	}

	async stop(): Promise<void> {
		await this.call('driver_session', { action: 'stop' }).catch(() => undefined);
	}

	async close(): Promise<void> {
		await this.stop();
		await this.client.close();
	}

	/** Runs an async function body in the window and returns its JSON-serialisable result. */
	async js<T>(body: string, windowId = 'main-1', timeout = 10_000): Promise<T> {
		const text = await this.call('webview_execute_js', {
			windowId,
			script: `(async () => { ${body} })()`,
			timeout,
		});
		const json = text.split('\n\n[Executed')[0] ?? '';
		return JSON.parse(json) as T;
	}

	/** Calls a plugin or app command from the window. */
	invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
		return this.js<T>(
			`return await window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)});`,
		);
	}

	/** Waits for the window to exist and its page to run scripts. */
	async ready(windowId = 'main-1'): Promise<boolean> {
		const found = await within(30_000, async () => {
			try {
				return (
					(await this.windows()).includes(windowId) &&
					(await this.js<boolean>('return document.readyState === "complete";', windowId))
				);
			} catch {
				return false;
			}
		});
		return found !== null;
	}

	async windows(): Promise<string[]> {
		const text = await this.call('manage_window', { action: 'list' });
		const parsed = JSON.parse(text) as { windows: { label: string }[] };
		return parsed.windows.map((w) => w.label);
	}
}
