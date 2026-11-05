// Makes a new level through the worlds plugin; the target is fixed by the request
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	createLevel,
	type LevelSnapshot,
	type NewLevelRequest,
} from '@liminal-hq/fizz-studio-plugin-worlds';
import { normaliseSnapshot } from './tauriLevelClient';

/** Makes a level and opens it. A refusal rejects with a `LevelError`; nothing was written. */
export interface NewLevelClient {
	create(request: NewLevelRequest): Promise<LevelSnapshot>;
}

/** The real client; revisions come back as `bigint`. */
export const newLevelClient: NewLevelClient = {
	create: async (request) => normaliseSnapshot(await createLevel(request)),
};
