// Tests for the ⋮ button: opening its menu must not change the header's layout
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PanelMenuButton } from './PanelMenuButton';

describe('PanelMenuButton', () => {
	it('adds no box next to the button while its menu is open, so the header does not reflow', async () => {
		const user = userEvent.setup();
		render(
			<div data-testid="header" style={{ display: 'flex', gap: '0.4rem' }}>
				<PanelMenuButton
					title="Palette"
					items={[{ type: 'action', id: 'palette.float', label: 'Float' }]}
					onSelect={() => undefined}
				/>
			</div>,
		);
		const header = screen.getByTestId('header');
		expect(header.children).toHaveLength(1);
		await user.click(screen.getByRole('button', { name: 'Palette menu' }));
		expect(screen.getByRole('menu')).toBeInTheDocument();
		// The menu itself is in a portal; what the header keeps is the button and the pointer-event
		// wrapper, which must have no box (display: contents) or the header's gap pushes the button
		// left by the gap's width (6.4 px) as the menu opens.
		const extra = [...header.children].filter((c) => c.tagName !== 'BUTTON');
		for (const element of extra) expect(element.className).toContain('menuHost');
	});
});
