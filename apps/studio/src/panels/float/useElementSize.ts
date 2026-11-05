// A hook that follows an element's size, for the area panels float in
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState, type RefObject } from 'react';
import type { Size } from './panelGeometry';

/** The element's content size, 0 × 0 until it is laid out (and always in a test DOM). */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
	const [size, setSize] = useState<Size>({ w: 0, h: 0 });
	useEffect(() => {
		const element = ref.current;
		if (!element || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const w = Math.floor(element.clientWidth);
			const h = Math.floor(element.clientHeight);
			setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return size;
}
