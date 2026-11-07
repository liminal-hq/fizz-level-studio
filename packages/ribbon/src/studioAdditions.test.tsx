// Tests for the studio's three additions to the copied ribbon: no mode switch, app icons and the after slot
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassicToolbar } from './ClassicToolbar';
import { Ribbon } from './Ribbon';
import type { RibbonModel, ToolbarModel } from './types';

const icon = (px: number) => <svg data-testid="app-icon" width={px} height={px} />;
const toolbar: ToolbarModel = { groups: [[{ id: 'save', label: 'Save', icon }]] };
const ribbon: RibbonModel = {
	tabs: [
		{
			id: 'home',
			label: 'Home',
			groups: [
				{ id: 'file', label: 'File', items: [{ id: 'save', label: 'Save', icon, size: 'large' }] },
			],
		},
	],
};

describe('the studio’s additions', () => {
	it('draws an app icon in place of the path, at the size of the button', () => {
		render(<ClassicToolbar model={toolbar} onCommand={vi.fn()} />);
		const drawn = screen.getByTestId('app-icon');
		expect(drawn).toHaveAttribute('width', '14');
		expect(screen.getByRole('button', { name: 'Save' })).toContainElement(drawn);
		expect(drawn.closest('button')!.querySelectorAll('path')).toHaveLength(0);
	});

	it('draws a large ribbon button’s icon at 22 px', () => {
		render(<Ribbon model={ribbon} onCommand={vi.fn()} />);
		expect(screen.getByTestId('app-icon')).toHaveAttribute('width', '22');
	});

	it('has no Easy and Expert switch without a mode, and has one with it', () => {
		const { rerender } = render(<ClassicToolbar model={toolbar} onCommand={vi.fn()} />);
		expect(screen.queryByRole('radiogroup')).toBeNull();
		rerender(<ClassicToolbar model={toolbar} mode="easy" onCommand={vi.fn()} />);
		expect(screen.getByRole('radiogroup')).toBeInTheDocument();
		rerender(<Ribbon model={ribbon} onCommand={vi.fn()} />);
		expect(screen.queryByRole('radiogroup')).toBeNull();
		rerender(<Ribbon model={ribbon} mode="expert" onCommand={vi.fn()} />);
		expect(screen.getByRole('radiogroup')).toBeInTheDocument();
	});

	it('shows every control without a mode, expert ones included', () => {
		const model: RibbonModel = {
			tabs: [
				{
					id: 'home',
					label: 'Home',
					groups: [
						{ id: 'a', label: 'A', items: [{ id: 'plain', label: 'Plain', icon }] },
						{ id: 'b', label: 'B', expert: true, items: [{ id: 'deep', label: 'Deep', icon }] },
					],
				},
			],
		};
		render(<Ribbon model={model} onCommand={vi.fn()} />);
		expect(screen.getByRole('button', { name: 'Deep' })).toBeInTheDocument();
	});

	it('draws the after slot between the groups and the end', () => {
		render(
			<ClassicToolbar
				model={toolbar}
				onCommand={vi.fn()}
				after={<span data-testid="after" />}
				end={<span data-testid="end" />}
			/>,
		);
		const after = screen.getByTestId('after');
		const end = screen.getByTestId('end');
		expect(after.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'Save' }).compareDocumentPosition(after) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});
});
