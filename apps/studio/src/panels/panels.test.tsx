// Tests for the script and history panels
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HistoryPanel, historyShortcut } from './HistoryPanel';
import { ScriptPanel, scriptLines } from './ScriptPanel';

describe('scriptLines', () => {
	it('splits on newlines and drops only the one after the last line', () => {
		expect(scriptLines('a\nb\n')).toEqual(['a', 'b']);
		expect(scriptLines('a\n\nb')).toEqual(['a', '', 'b']);
		expect(scriptLines('')).toEqual([]);
	});
});

describe('ScriptPanel', () => {
	const text = 'script fizz1 0\nlevel test\n  paint grass\n';

	it('shows every line with its number, exactly as written', () => {
		render(<ScriptPanel text={text} diagnostics={[]} />);
		const lines = within(screen.getByRole('list', { name: 'Script text' })).getAllByRole(
			'listitem',
		);
		expect(lines).toHaveLength(3);
		expect(lines[0]).toHaveTextContent('1script fizz1 0');
		expect(lines[2]?.querySelector('code')?.textContent).toBe('  paint grass');
		expect(screen.getByText('No problems')).toBeInTheDocument();
	});

	it('lists each problem as a button that marks and focuses its line', async () => {
		const user = userEvent.setup();
		render(
			<ScriptPanel
				text={text}
				diagnostics={[{ line: 3, code: 'E004', message: 'unknown tile' }]}
			/>,
		);
		const link = screen.getByRole('button', { name: 'Line 3: E004 unknown tile' });
		await user.click(link);
		const lines = within(screen.getByRole('list', { name: 'Script text' })).getAllByRole(
			'listitem',
		);
		expect(lines[2]).toHaveFocus();
		expect(lines[2]?.className).toContain('active');
		expect(lines[2]?.className).toContain('problem');
		expect(lines[1]?.className).not.toContain('active');
	});

	it('marks the line the caller asks to focus', () => {
		render(<ScriptPanel text={text} diagnostics={[]} focusLine={2} />);
		const lines = within(screen.getByRole('list', { name: 'Script text' })).getAllByRole(
			'listitem',
		);
		expect(lines[1]?.className).toContain('active');
	});
});

describe('HistoryPanel', () => {
	const base = {
		canUndo: true,
		canRedo: true,
		undoName: 'Paint grass',
		redoName: 'Clear',
		onUndo: vi.fn(),
		onRedo: vi.fn(),
	};

	it('names the steps and calls undo and redo', async () => {
		const user = userEvent.setup();
		const onUndo = vi.fn();
		const onRedo = vi.fn();
		render(<HistoryPanel {...base} onUndo={onUndo} onRedo={onRedo} />);
		await user.click(screen.getByRole('button', { name: 'Undo Paint grass' }));
		await user.click(screen.getByRole('button', { name: 'Redo Clear' }));
		expect(onUndo).toHaveBeenCalledTimes(1);
		expect(onRedo).toHaveBeenCalledTimes(1);
	});

	it('disables the buttons the history cannot use and falls back to plain names', () => {
		render(
			<HistoryPanel {...base} canUndo={false} canRedo={false} undoName={null} redoName={null} />,
		);
		expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
	});
});

describe('historyShortcut', () => {
	const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({
		key: k,
		ctrlKey: true,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		...extra,
	});

	it('maps Ctrl+Z to undo and Ctrl+Shift+Z or Ctrl+Y to redo', () => {
		expect(historyShortcut(key('z'))).toBe('undo');
		expect(historyShortcut(key('Z', { shiftKey: true }))).toBe('redo');
		expect(historyShortcut(key('y'))).toBe('redo');
		expect(historyShortcut(key('z', { ctrlKey: false, metaKey: true }))).toBe('undo');
	});

	it('ignores unmodified and other keys', () => {
		expect(historyShortcut(key('z', { ctrlKey: false }))).toBeNull();
		expect(historyShortcut(key('x'))).toBeNull();
		expect(historyShortcut(key('z', { altKey: true }))).toBeNull();
	});
});
