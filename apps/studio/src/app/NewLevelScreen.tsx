// The New level window: name, id, size, target, theme and folder, then Create
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { getCurrentWindow } from '@tauri-apps/api/window';
import { ConfirmDialog } from '@liminal-hq/fizz-studio-chrome/Dialog/ConfirmDialog';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { t } from '../i18n/messages';
import {
	initialForm,
	isEdited,
	THEMES,
	toRequest,
	validateForm,
	withId,
	withName,
	type FormErrors,
	type NewLevelForm,
} from '../new-world/newLevelForm';
import { closeGateClient, type CloseGateClient } from '../services/closeGateClient';
import { pickFolder, type PickFolder } from '../services/folderPicker';
import { requestOpen, type RequestOpen } from '../services/openRequestClient';
import { newLevelClient, type NewLevelClient } from '../worlds/newLevelClient';
import { AppWindow } from './AppWindow';
import styles from './NewLevelScreen.module.css';

export interface NewLevelScreenProps {
	/** Makes the level; defaults to the worlds plugin. */
	client?: NewLevelClient;
	/** Asks for a folder; defaults to the native dialog. */
	pickDirectory?: PickFolder;
	/** Tells the main window to open the new level; defaults to the open-request event. */
	openInMain?: RequestOpen;
	/** Closes this window; defaults to the current window. */
	closeWindow?: () => Promise<void>;
	/** Hears Rust asking whether this window may close; defaults to the app's events. */
	closeGate?: CloseGateClient;
}

/** The message a refusal from Rust carries, or a plain word for anything else. */
function reasonOf(error: unknown): string {
	if (typeof error === 'object' && error !== null && 'message' in error) {
		return String((error as { message: unknown }).message);
	}
	return String(error);
}

export function NewLevelScreen({
	client = newLevelClient,
	pickDirectory = pickFolder,
	openInMain = requestOpen,
	closeWindow = () => getCurrentWindow().close(),
	closeGate = closeGateClient,
}: NewLevelScreenProps) {
	const [form, setForm] = useState<NewLevelForm>(initialForm);
	const [errors, setErrors] = useState<FormErrors>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	/** The close request waiting on the person's answer to the discard question. */
	const [closeToken, setCloseToken] = useState<number | null>(null);
	/** Set by Cancel and a finished Create, which close the window without asking. */
	const closing = useRef(false);
	const formRef = useRef(form);
	formRef.current = form;
	const ids = useId();

	// However the window is asked to close (the title bar, the shell, Cancel, Create), Rust holds
	// the close back until this page answers: close at once when nothing was entered, or ask.
	useEffect(
		() =>
			closeGate.onRequested((token) => {
				if (closing.current || !isEdited(formRef.current)) {
					void closeGate.answer(token, 'close').catch(() => {});
					return;
				}
				setCloseToken(token);
				void closeGate.answer(token, 'asking').catch(() => {});
			}),
		[closeGate],
	);

	const answerClose = (answer: 'close' | 'stay') => {
		const token = closeToken;
		setCloseToken(null);
		if (token !== null) void closeGate.answer(token, answer).catch(() => {});
	};

	const leave = async () => {
		closing.current = true;
		await closeWindow();
	};
	const field = (name: string) => `${ids}-${name}`;

	const choose = async () => {
		const folder = await pickDirectory({ title: t('newLevel.folderDialogTitle') });
		if (folder) {
			setForm((was) => ({ ...was, folder }));
			setErrors((was) => ({ ...was, folder: undefined }));
		}
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const found = validateForm(form);
		setErrors(found);
		setFailure(null);
		if (Object.keys(found).length > 0) return;
		setBusy(true);
		try {
			const snapshot = await client.create(toRequest(form));
			await openInMain(snapshot.path);
			await leave();
		} catch (error) {
			setFailure(reasonOf(error));
			setBusy(false);
		}
	};

	const problem = (name: keyof FormErrors) => {
		const message = errors[name];
		return message ? (
			<p id={field(`${name}-error`)} className={styles.error} role="alert">
				{t(message)}
			</p>
		) : null;
	};
	const invalid = (name: keyof FormErrors) =>
		errors[name] ? { 'aria-invalid': true, 'aria-describedby': field(`${name}-error`) } : undefined;

	return (
		<AppWindow titleId="window.newWorld.title">
			<form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
				{failure !== null && (
					<p className={styles.failure} role="alert">
						{t('newLevel.createFailed', { message: failure })}
					</p>
				)}

				<div className={styles.field}>
					<label htmlFor={field('name')}>{t('newLevel.name')}</label>
					<input
						id={field('name')}
						className={styles.input}
						value={form.name}
						autoFocus
						onChange={(event) => setForm(withName(form, event.target.value))}
						{...invalid('name')}
					/>
					{problem('name')}
				</div>

				<div className={styles.field}>
					<label htmlFor={field('id')}>{t('newLevel.id')}</label>
					<input
						id={field('id')}
						className={styles.input}
						value={form.id}
						spellCheck={false}
						onChange={(event) => setForm(withId(form, event.target.value))}
						{...invalid('id')}
						aria-describedby={`${field('id-hint')}${errors.id ? ` ${field('id-error')}` : ''}`}
					/>
					<p id={field('id-hint')} className={styles.hint}>
						{t('newLevel.idHint')}
					</p>
					{problem('id')}
				</div>

				<div className={styles.sizes}>
					<div className={styles.field}>
						<label htmlFor={field('width')}>{t('newLevel.width')}</label>
						<input
							id={field('width')}
							className={styles.input}
							inputMode="numeric"
							value={form.width}
							onChange={(event) => setForm({ ...form, width: event.target.value })}
							{...invalid('width')}
						/>
						{problem('width')}
					</div>
					<div className={styles.field}>
						<label htmlFor={field('height')}>{t('newLevel.height')}</label>
						<input
							id={field('height')}
							className={styles.input}
							inputMode="numeric"
							value={form.height}
							onChange={(event) => setForm({ ...form, height: event.target.value })}
							{...invalid('height')}
						/>
						{problem('height')}
					</div>
				</div>

				<fieldset className={styles.group}>
					<legend>{t('newLevel.target')}</legend>
					<label className={styles.choice}>
						<input
							type="radio"
							name={field('target')}
							checked={form.target === 'fizz1'}
							onChange={() => setForm({ ...form, target: 'fizz1' })}
						/>
						{t('newLevel.targetFizz1')}
					</label>
					<label className={styles.choice}>
						<input
							type="radio"
							name={field('target')}
							checked={form.target === 'fizz2'}
							onChange={() => setForm({ ...form, target: 'fizz2' })}
						/>
						{t('newLevel.targetFizz2')}
					</label>
					<p className={styles.hint}>{t('newLevel.targetFixed')}</p>
					{form.target === 'fizz1' && (
						<p className={styles.hint} role="note">
							{t('newLevel.fizz1Note')}
						</p>
					)}
				</fieldset>

				{form.target === 'fizz1' && (
					<div className={styles.field}>
						<label htmlFor={field('theme')}>{t('newLevel.theme')}</label>
						<select
							id={field('theme')}
							className={styles.input}
							value={form.theme}
							onChange={(event) => setForm({ ...form, theme: event.target.value })}
						>
							<option value="">{t('newLevel.themeNone')}</option>
							{THEMES.map((theme) => (
								<option key={theme} value={theme}>
									{theme}
								</option>
							))}
						</select>
					</div>
				)}

				<div className={styles.field}>
					<label htmlFor={field('folder')}>{t('newLevel.folder')}</label>
					<div className={styles.row}>
						<input
							id={field('folder')}
							className={styles.input}
							value={form.folder}
							placeholder={t('newLevel.folderNone')}
							readOnly
							{...invalid('folder')}
						/>
						<button type="button" className={styles.button} onClick={() => void choose()}>
							{t('newLevel.chooseFolder')}
						</button>
					</div>
					{problem('folder')}
				</div>

				<div className={styles.actions}>
					<button
						type="button"
						className={styles.button}
						disabled={busy}
						onClick={() => void leave()}
					>
						{t('newLevel.cancel')}
					</button>
					<button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>
						{t('newLevel.create')}
					</button>
				</div>
			</form>
			<ConfirmDialog
				open={closeToken !== null}
				title={t('newLevel.discardTitle')}
				message={t('newLevel.discardMessage')}
				confirmLabel={t('newLevel.discard')}
				cancelLabel={t('newLevel.keepEditing')}
				danger
				onConfirm={() => answerClose('close')}
				onCancel={() => answerClose('stay')}
			/>
		</AppWindow>
	);
}
