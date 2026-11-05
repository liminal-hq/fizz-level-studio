// Tests for the history panel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HistoryPanel, historyShortcut } from './HistoryPanel';

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
