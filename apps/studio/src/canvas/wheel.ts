// What a wheel event does to the canvas: zoom, or pan along one axis
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** The parts of a wheel event that decide what it means. */
export interface WheelInput {
	deltaX: number;
	deltaY: number;
	shiftKey: boolean;
	altKey: boolean;
}

export type WheelAction =
	| { kind: 'none' }
	| { kind: 'zoom'; step: 1 | -1 }
	| { kind: 'pan'; dx: number; dy: number };

/**
 * A horizontal wheel (a tilt wheel's left and right buttons, a trackpad's sideways swipe) pans
 * sideways by its own amount. A vertical wheel zooms, one step a notch, and with Shift pans sideways
 * or with Alt pans up and down. Whichever axis moved more decides, so a trackpad swipe that is
 * mostly sideways does not zoom.
 */
export function wheelAction(event: WheelInput): WheelAction {
	const { deltaX, deltaY } = event;
	if (deltaX === 0 && deltaY === 0) return { kind: 'none' };
	if (Math.abs(deltaX) > Math.abs(deltaY)) return { kind: 'pan', dx: deltaX, dy: 0 };
	if (event.shiftKey) return { kind: 'pan', dx: deltaY, dy: 0 };
	if (event.altKey) return { kind: 'pan', dx: 0, dy: deltaY };
	return { kind: 'zoom', step: deltaY < 0 ? 1 : -1 };
}
