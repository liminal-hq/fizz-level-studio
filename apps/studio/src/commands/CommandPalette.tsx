// The command palette: a dialog with a search field and the matching commands, driven from the keyboard
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	Fragment,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n/messages';
import type { BridgeSnapshot } from './commandBridge';
import styles from './CommandPalette.module.css';
import { paletteEntries, type PaletteEntry } from './paletteModel';
import { rankItems, segments, type Ranked } from './paletteMatch';
import { sessionRecents, type RecentCommands } from './paletteRecents';
import { PALETTE_GROUP_LABELS, PALETTE_GROUPS, runCommand } from './registry';

export interface CommandPaletteProps {
	open: boolean;
	/** Escape, a click outside and running a command all call this. */
	onClose: () => void;
	/** What the screens published: the commands and whether each can run. */
	snapshot: BridgeSnapshot;
	/** The commands run this session; defaults to the app's own list. */
	recents?: RecentCommands;
}

interface Section {
	key: string;
	heading: string | null;
	rows: Ranked<PaletteEntry>[];
}

/** The ranked entries as sections: Recent then each group when no query is typed, else one list. */
function sectionsOf(ranked: Ranked<PaletteEntry>[], query: string): Section[] {
	if (query.trim() !== '') return [{ key: 'found', heading: null, rows: ranked }];
	const sections: Section[] = [];
	const recent = ranked.filter((row) => row.recent);
	if (recent.length > 0) {
		sections.push({ key: 'recent', heading: t('cmdPalette.recent'), rows: recent });
	}
	for (const group of PALETTE_GROUPS) {
		const rows = ranked.filter((row) => !row.recent && row.item.group === group);
		if (rows.length > 0) {
			sections.push({ key: group, heading: t(PALETTE_GROUP_LABELS[group]), rows });
		}
	}
	return sections;
}

export function CommandPalette(props: CommandPaletteProps) {
	if (!props.open) return null;
	return createPortal(<PaletteDialog {...props} />, document.body);
}

function PaletteDialog({ onClose, snapshot, recents = sessionRecents }: CommandPaletteProps) {
	const base = useId();
	const titleId = `${base}-title`;
	const listId = `${base}-list`;
	const optionId = (index: number) => `${base}-option-${index}`;
	const input = useRef<HTMLInputElement>(null);
	const dialog = useRef<HTMLDivElement>(null);
	const list = useRef<HTMLUListElement>(null);
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const [asking, setAsking] = useState<'line' | null>(null);
	const [invalid, setInvalid] = useState(false);

	const entries = useMemo(() => paletteEntries(snapshot), [snapshot]);
	const ranked = useMemo(() => rankItems(entries, query, recents.ids()), [entries, query, recents]);
	const sections = useMemo(() => sectionsOf(ranked, query), [ranked, query]);
	const flat = useMemo(() => sections.flatMap((section) => section.rows), [sections]);
	const current = Math.min(active, Math.max(flat.length - 1, 0));
	const lineCount = snapshot.facts.lineCount;

	// Focus starts in the search field and goes back to where it was; focus cannot leave the dialog.
	useEffect(() => {
		const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		input.current?.focus();
		const keep = (event: FocusEvent) => {
			if (
				dialog.current &&
				event.target instanceof Node &&
				!dialog.current.contains(event.target)
			) {
				input.current?.focus();
			}
		};
		document.addEventListener('focusin', keep);
		return () => {
			document.removeEventListener('focusin', keep);
			const now = document.activeElement;
			if (!now || now === document.body) before?.focus();
		};
	}, []);

	useEffect(() => {
		const row = list.current?.querySelector('[aria-selected="true"]');
		if (row instanceof HTMLElement) row.scrollIntoView?.({ block: 'nearest' });
	}, [current, flat]);

	/** Closes the palette, with focus back where it was before anything else takes it. */
	const finish = (id: string, argument?: string) => {
		recents.note(id);
		onClose();
		runCommand(id, snapshot, argument);
	};

	const choose = (entry: PaletteEntry) => {
		if (!entry.enabled) return;
		if (entry.def.argument === 'line') {
			setAsking('line');
			setQuery('');
			setInvalid(false);
			return;
		}
		finish(entry.id);
	};

	const submitLine = () => {
		const text = query.trim();
		const line = /^\d+$/.test(text) ? Number(text) : 0;
		if (line < 1 || line > lineCount) {
			setInvalid(true);
			return;
		}
		finish('goto.line', String(line));
	};

	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onClose();
			return;
		}
		if (event.key === 'Tab') {
			event.preventDefault();
			input.current?.focus();
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (asking) submitLine();
			else if (flat[current]) choose(flat[current].item);
			return;
		}
		if (asking || flat.length === 0) return;
		const last = flat.length - 1;
		const move = (to: number) => {
			event.preventDefault();
			setActive(to);
		};
		if (event.key === 'ArrowDown') move(current >= last ? 0 : current + 1);
		else if (event.key === 'ArrowUp') move(current <= 0 ? last : current - 1);
		else if (event.key === 'Home') move(0);
		else if (event.key === 'End') move(last);
	};

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		setQuery(event.target.value);
		setActive(0);
		setInvalid(false);
	};

	let index = -1;
	return (
		<div
			className={styles.backdrop}
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				ref={dialog}
				className={styles.panel}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onKeyDown={onKeyDown}
			>
				<h2 id={titleId} className={styles.title}>
					{t('cmdPalette.title')}
				</h2>
				<div className={styles.query}>
					<input
						ref={input}
						className={styles.input}
						type="text"
						value={query}
						onChange={onChange}
						autoComplete="off"
						spellCheck={false}
						{...(asking
							? {
									'aria-label': t('cmdPalette.lineField'),
									'aria-invalid': invalid,
									'aria-describedby': invalid ? `${base}-error` : undefined,
									placeholder: t('cmdPalette.linePlaceholder', { count: lineCount }),
									inputMode: 'numeric' as const,
								}
							: {
									role: 'combobox',
									'aria-label': t('cmdPalette.search'),
									'aria-expanded': true,
									'aria-controls': listId,
									'aria-autocomplete': 'list' as const,
									'aria-activedescendant': flat.length > 0 ? optionId(current) : undefined,
									placeholder: t('cmdPalette.placeholder'),
								})}
					/>
				</div>
				{asking ? (
					<p
						id={`${base}-error`}
						className={styles.message}
						role={invalid ? 'alert' : undefined}
						data-invalid={invalid || undefined}
					>
						{invalid ? t('cmdPalette.lineInvalid', { count: lineCount }) : ' '}
					</p>
				) : (
					<ul
						ref={list}
						id={listId}
						className={styles.list}
						role="listbox"
						aria-label={t('cmdPalette.list')}
					>
						{sections.map((section) => (
							<Fragment key={section.key}>
								{section.heading && (
									<li role="presentation" className={styles.group}>
										{section.heading}
									</li>
								)}
								{section.rows.map(({ item, ranges }) => {
									index += 1;
									const at = index;
									return (
										<li
											key={item.id}
											id={optionId(at)}
											role="option"
											aria-label={item.label}
											aria-keyshortcuts={item.shortcut}
											aria-description={item.reason}
											aria-selected={at === current}
											aria-disabled={!item.enabled || undefined}
											className={styles.option}
											data-active={at === current || undefined}
											data-disabled={!item.enabled || undefined}
											onMouseDown={(event) => event.preventDefault()}
											onMouseMove={() => at !== current && setActive(at)}
											onClick={() => choose(item)}
										>
											<span className={styles.label}>
												{segments(item.label, ranges).map((part, i) =>
													part.hit ? (
														<mark key={i} className={styles.hit}>
															{part.text}
														</mark>
													) : (
														<Fragment key={i}>{part.text}</Fragment>
													),
												)}
											</span>
											{item.reason ? (
												<span className={styles.detail}>{item.reason}</span>
											) : query.trim() !== '' ? (
												<span className={styles.detail}>{t(PALETTE_GROUP_LABELS[item.group])}</span>
											) : null}
											{item.shortcut && <kbd className={styles.key}>{item.shortcut}</kbd>}
										</li>
									);
								})}
							</Fragment>
						))}
						{flat.length === 0 && (
							<li role="presentation" className={styles.empty}>
								{t('cmdPalette.empty')}
							</li>
						)}
					</ul>
				)}
				<div className={styles.footer} aria-hidden="true">
					<span>
						<kbd className={styles.key}>↑↓</kbd> {t('cmdPalette.hintMove')}
					</span>
					<span>
						<kbd className={styles.key}>{t('cmdPalette.keyEnter')}</kbd> {t('cmdPalette.hintRun')}
					</span>
					<span>
						<kbd className={styles.key}>{t('cmdPalette.keyEscape')}</kbd>{' '}
						{t('cmdPalette.hintClose')}
					</span>
				</div>
			</div>
		</div>
	);
}
