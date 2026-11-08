// Tests for the number field with Decrease and Increase keycaps
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CoordField } from './CoordField';

function setup(over: Partial<Parameters<typeof CoordField>[0]> = {}) {
	const onCommit = vi.fn();
	const view = render(
		<CoordField label="x" value={5} min={0} max={11} whole onCommit={onCommit} {...over} />,
	);
	return { onCommit, ...view };
}

describe('CoordField', () => {
	it('shows the value in a labelled field between two named keycaps', () => {
		setup();
		const input = screen.getByRole('spinbutton', { name: 'x' });
		expect(input).toHaveValue(5);
		expect(screen.getByRole('button', { name: 'Decrease x' })).toHaveAttribute(
			'aria-controls',
			input.id,
		);
		expect(screen.getByRole('button', { name: 'Increase x' })).toBeEnabled();
	});

	it('commits one more or one less when a keycap is pressed', async () => {
		const user = userEvent.setup();
		const { onCommit } = setup();
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		expect(onCommit).toHaveBeenLastCalledWith(6);
		await user.click(screen.getByRole('button', { name: 'Decrease x' }));
		// The level has not answered yet, so this counts on from the press before.
		expect(onCommit).toHaveBeenLastCalledWith(5);
	});

	it('counts a quick run of presses on from the last, not from the old value', async () => {
		const user = userEvent.setup();
		const { onCommit } = setup();
		const more = screen.getByRole('button', { name: 'Increase x' });
		await user.click(more);
		await user.click(more);
		await user.click(more);
		expect(onCommit.mock.calls.map(([v]) => v)).toEqual([6, 7, 8]);
	});

	it('keeps counting on from the last press while earlier ones are still being answered', async () => {
		const user = userEvent.setup();
		const answers: Array<() => void> = [];
		const onCommit = vi.fn(
			(_value: number) => new Promise<void>((resolve) => answers.push(resolve)),
		);
		const { rerender } = render(
			<CoordField label="x" value={5} min={0} max={11} whole onCommit={onCommit} />,
		);
		const more = screen.getByRole('button', { name: 'Increase x' });
		await user.click(more);
		await user.click(more);
		// The level takes the first change and shows it before the others have been answered.
		rerender(<CoordField label="x" value={6} min={0} max={11} whole onCommit={onCommit} />);
		answers[0]!();
		await user.click(more);
		expect(onCommit.mock.calls.map(([v]) => v)).toEqual([6, 7, 8]);
	});

	it('steps with the arrows by one and Page Up and Page Down by ten, and goes to the ends with Home and End', async () => {
		const user = userEvent.setup();
		const { onCommit } = setup({ max: 40 });
		screen.getByRole('spinbutton').focus();
		await user.keyboard('{ArrowUp}');
		expect(onCommit).toHaveBeenLastCalledWith(6);
		await user.keyboard('{ArrowDown}{ArrowDown}');
		expect(onCommit).toHaveBeenLastCalledWith(4);
		await user.keyboard('{PageUp}');
		expect(onCommit).toHaveBeenLastCalledWith(14);
		await user.keyboard('{PageDown}');
		expect(onCommit).toHaveBeenLastCalledWith(4);
		await user.keyboard('{End}');
		expect(onCommit).toHaveBeenLastCalledWith(40);
		await user.keyboard('{Home}');
		expect(onCommit).toHaveBeenLastCalledWith(0);
	});

	it('stops at the ends and disables the keycap that would pass them', () => {
		setup({ value: 0 });
		expect(screen.getByRole('button', { name: 'Decrease x' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Increase x' })).toBeEnabled();
	});

	it('clamps typed values and commits them on Enter or when focus leaves', async () => {
		const user = userEvent.setup();
		const { onCommit } = setup();
		const input = screen.getByRole('spinbutton');
		await user.clear(input);
		await user.type(input, '40{Enter}');
		expect(onCommit).toHaveBeenLastCalledWith(11);
		await user.clear(input);
		await user.type(input, '2');
		await user.tab();
		expect(onCommit).toHaveBeenLastCalledWith(2);
	});

	it('puts back what was there on Escape, committing nothing', async () => {
		const user = userEvent.setup();
		const { onCommit } = setup();
		const input = screen.getByRole('spinbutton');
		await user.clear(input);
		await user.type(input, '9');
		await user.keyboard('{Escape}');
		expect(input).toHaveValue(5);
		await user.tab();
		expect(onCommit).not.toHaveBeenCalled();
	});

	it('commits nothing for the value it already has, or for text that is not a number', async () => {
		const user = userEvent.setup();
		const { onCommit } = setup();
		const input = screen.getByRole('spinbutton');
		await user.clear(input);
		await user.type(input, '5{Enter}');
		await user.clear(input);
		await user.tab();
		expect(onCommit).not.toHaveBeenCalled();
	});

	it('rounds to a whole cell when only whole numbers make sense, and keeps a fraction otherwise', async () => {
		const user = userEvent.setup();
		const whole = setup();
		await user.type(screen.getByRole('spinbutton'), '{Backspace}7.6{Enter}');
		expect(whole.onCommit).toHaveBeenLastCalledWith(8);
		whole.unmount();
		const loose = setup({ whole: false, value: 8.5 });
		await user.click(screen.getByRole('button', { name: 'Increase x' }));
		expect(loose.onCommit).toHaveBeenLastCalledWith(9.5);
	});

	it('does nothing while disabled', () => {
		setup({ disabled: true });
		expect(screen.getByRole('spinbutton')).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Increase x' })).toBeDisabled();
	});
});
