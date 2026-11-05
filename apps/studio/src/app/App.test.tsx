// Tests for the root component
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
	it('names the window it is running in', () => {
		render(<App windowLabel="main-1" />);
		expect(screen.getByRole('heading', { name: 'Fizz Level Studio' })).toBeInTheDocument();
		expect(screen.getByTestId('window-label')).toHaveTextContent('main-1');
	});
});
