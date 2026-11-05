// An in-memory NewLevelClient for tests
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { NewLevelRequest } from '@liminal-hq/fizz-studio-protocol/generated/NewLevelRequest';
import { levelSnapshot } from '../test/levelFixtures';
import type { NewLevelClient } from './newLevelClient';

/** Records each request; `refuse` makes calls reject the way Rust does for an existing file. */
export class FakeNewLevelClient implements NewLevelClient {
	requests: NewLevelRequest[] = [];
	refuse: string | null = null;

	async create(request: NewLevelRequest): Promise<LevelSnapshot> {
		this.requests.push(request);
		if (this.refuse !== null) throw { kind: 'invalid', message: this.refuse };
		const file =
			request.target === 'fizz1'
				? `${request.folder}/${request.id}.fizz`
				: `${request.folder}/${request.id}/levels/${request.id}.fizz`;
		return { ...levelSnapshot({ id: request.id, path: file }), target: request.target };
	}
}
