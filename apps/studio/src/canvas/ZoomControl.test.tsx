// Tests for the floating zoom control: the factor, the buttons and what they ask for
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ZoomControl } from './ZoomControl';

function setup(over: Partial<Parameters<typeof ZoomControl>[0]> = {}) {
	const onZoom = vi.fn();
	render(<ZoomControl zoom={4} canIn canOut onZoom={onZoom} {...over} />);
	return onZoom;
}

describe('ZoomControl', () => {
	it('shows the factor, not a percentage, and announces it politely', () => {
		setup({ zoom: 7 });
		const group = screen.getByRole('group', { name: 'Canvas zoom' });
		const status = within(group).getByRole('status');
		expect(status).toHaveAttribute('aria-live', 'polite');
		expect(status).toHaveTextContent('Zoom 7×7×');
		expect(group).not.toHaveTextContent('%');
	});

	it('asks to zoom out, in and fit', async () => {
		const user = userEvent.setup();
		const onZoom = setup();
		await user.click(screen.getByRole('button', { name: 'Zoom out' }));
		await user.click(screen.getByRole('button', { name: 'Zoom in' }));
		await user.click(screen.getByRole('button', { name: 'Fit level' }));
		expect(onZoom.mock.calls.map((call) => call[0])).toEqual(['out', 'in', 'fit']);
	});

	it('dims the end of the range it is at, but always offers Fit', () => {
		setup({ zoom: 16, canIn: false });
		expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
		expect(screen.getByRole('button', { name: 'Fit level' })).toBeEnabled();
	});
});
