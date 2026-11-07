// The Ghosts lens control: a switch for showing Claude's pending proposals, and the list of them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import { t, tn } from '../i18n/messages';
import { layerList } from './layers/lockedNote';
import styles from './GhostsPanel.module.css';

export interface GhostsPanelProps {
	proposals: readonly GhostProposal[];
	shown: boolean;
	onToggle: (shown: boolean) => void;
	/** Reads the sidecar again; Claude's MCP server writes it without the studio hearing. */
	onRefresh: () => void;
	/** The locked layers; a proposal that touches one cannot be accepted until it is unlocked. */
	locked?: readonly string[];
}

/** The locked layers a proposal would touch. */
function blockers(proposal: GhostProposal, locked: readonly string[]): string[] {
	return proposal.layers.filter((id) => locked.includes(id));
}

/** Read-only: it shows what Claude proposed. Accepting and rejecting are not here yet. */
export function GhostsPanel({
	proposals,
	shown,
	onToggle,
	onRefresh,
	locked = [],
}: GhostsPanelProps) {
	return (
		<div className={styles.panel}>
			<div className={styles.bar}>
				<label className={styles.toggle}>
					<input
						type="checkbox"
						role="switch"
						checked={shown}
						onChange={(event) => onToggle(event.target.checked)}
					/>
					<span>{t('ghosts.show')}</span>
				</label>
				<button type="button" className={styles.button} onClick={onRefresh}>
					{t('ghosts.refresh')}
				</button>
			</div>
			{proposals.length === 0 ? (
				<p className={styles.note}>{t('ghosts.none')}</p>
			) : (
				<ul className={styles.list} role="list">
					{proposals.map((proposal) => (
						<li key={proposal.id} className={styles.entry}>
							<span className={styles.name}>{proposal.title}</span>
							<span className={styles.count}>{tn('ghosts.cells', proposal.cells.length)}</span>
							{proposal.why && <span className={styles.why}>{proposal.why}</span>}
							{blockers(proposal, locked).length > 0 && (
								<span className={styles.blocked} role="note">
									{t('layers.blocked', { layers: layerList(blockers(proposal, locked), []) })}
								</span>
							)}
						</li>
					))}
				</ul>
			)}
			<p className={styles.note}>{t('ghosts.readOnly')}</p>
		</div>
	);
}
