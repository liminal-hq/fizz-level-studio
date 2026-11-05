// An in-memory panel bridge for tests: windows are ends of one hub that delivers synchronously
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	addressedTo,
	type BridgeEnvelope,
	type BridgeTopic,
	type PanelBridge,
} from './panelBridge';

export interface BridgeHub {
	/** The end for the window `label` (a panel window when its label starts `panel-`). */
	bridgeFor(label: string): PanelBridge;
	/** Every envelope sent so far, in order. */
	readonly sent: BridgeEnvelope[];
}

export function createBridgeHub(): BridgeHub {
	const listeners = new Set<{
		label: string;
		topic: BridgeTopic;
		handler: (payload: never, from: string) => void;
	}>();
	const sent: BridgeEnvelope[] = [];
	return {
		sent,
		bridgeFor(label) {
			return {
				label,
				send(to, topic, payload) {
					const envelope = { from: label, to, topic, payload } as BridgeEnvelope;
					sent.push(envelope);
					for (const listener of [...listeners]) {
						if (
							listener.topic === topic &&
							addressedTo(envelope, listener.label, listener.label.startsWith('panel-'))
						) {
							listener.handler(envelope.payload as never, label);
						}
					}
				},
				on(topic, handler) {
					const entry = {
						label,
						topic,
						handler: handler as (payload: never, from: string) => void,
					};
					listeners.add(entry);
					return () => listeners.delete(entry);
				},
			};
		},
	};
}
