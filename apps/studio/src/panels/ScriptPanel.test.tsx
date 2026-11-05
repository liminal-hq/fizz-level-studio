// Tests for the script panel: the editor shows the text, marks problems and reveals lines
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ScriptPanel } from './ScriptPanel';

const TEXT = 'script fizz1 0\nlevel test\n  paint grass\n';

function editorText(container: HTMLElement): string {
	return Array.from(container.querySelectorAll('.cm-line'))
		.map((line) => line.textContent)
		.join('\n');
}

describe('ScriptPanel', () => {
	it('shows every line of the script in an editor with line numbers', () => {
		const { container } = render(<ScriptPanel text={TEXT} diagnostics={[]} />);
		expect(editorText(container)).toBe(TEXT);
		expect(container.querySelector('.cm-lineNumbers')).not.toBeNull();
		expect(screen.getByRole('textbox', { name: 'Script text' })).toHaveAttribute(
			'aria-readonly',
			'true',
		);
		expect(screen.getByText('No problems')).toBeInTheDocument();
	});

	it('follows the text it is given and keeps it exactly', () => {
		const { container, rerender } = render(<ScriptPanel text={TEXT} diagnostics={[]} />);
		rerender(<ScriptPanel text={`${TEXT}  paint dirt\n`} diagnostics={[]} />);
		expect(editorText(container)).toBe(`${TEXT}  paint dirt\n`);
	});

	it('marks a problem on its line and lists it as a button', async () => {
		const user = userEvent.setup();
		const { container } = render(
			<ScriptPanel
				text={TEXT}
				diagnostics={[{ line: 3, code: 'E004', message: 'unknown tile' }]}
			/>,
		);
		const lines = container.querySelectorAll('.cm-line');
		expect(lines[2]?.querySelector('.cm-lintRange-error')).not.toBeNull();
		const link = screen.getByRole('button', { name: 'Line 3: E004 unknown tile' });
		await user.click(link);
		expect(container.querySelector('.cm-revealedLine')?.textContent).toBe('  paint grass');
		expect(screen.getByRole('textbox', { name: 'Script text' })).toHaveFocus();
	});

	it('marks the line the caller asks to focus, without taking the focus', () => {
		const { container } = render(<ScriptPanel text={TEXT} diagnostics={[]} focusLine={2} />);
		expect(container.querySelector('.cm-revealedLine')?.textContent).toBe('level test');
		expect(screen.getByRole('textbox', { name: 'Script text' })).not.toHaveFocus();
	});
});
