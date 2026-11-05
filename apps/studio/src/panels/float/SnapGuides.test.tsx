// Tests for the snap guide lines
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SnapGuides } from './SnapGuides';

describe('SnapGuides', () => {
	it('draws one hidden line per guide, placed by a custom property', () => {
		const { container } = render(
			<SnapGuides
				guides={[
					{ axis: 'x', at: 8 },
					{ axis: 'y', at: 120 },
				]}
			/>,
		);
		const layer = container.firstElementChild as HTMLElement;
		expect(layer).toHaveAttribute('aria-hidden', 'true');
		const lines = [...layer.children] as HTMLElement[];
		expect(lines.map((l) => l.style.getPropertyValue('--fls-guide-at'))).toEqual(['8px', '120px']);
	});

	it('draws nothing when there are no guides', () => {
		const { container } = render(<SnapGuides guides={[]} />);
		expect(container.firstElementChild?.children).toHaveLength(0);
	});
});
