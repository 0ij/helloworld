import { randomUUID } from 'node:crypto';

import { toPrettyJson } from './utils.mjs';

function createDraftPath(root, date) {
	const [year, month] = date.split('-');
	return `${root}/${year}/${month}/${date}.json`;
}

function normalizeDraftDocument(date, existingDocument) {
	return {
		version: 1,
		date,
		entries: Array.isArray(existingDocument?.entries) ? existingDocument.entries : [],
	};
}

export function createNoteStorage({
	githubClient,
	draftBranch,
	mainBranch,
	draftRoot = 'automation/dingtalk-notes',
}) {
	return {
		async readDailyNotes(date) {
			await githubClient.ensureBranch(draftBranch, mainBranch);
			const file = await githubClient.getFile(createDraftPath(draftRoot, date), draftBranch);

			if (!file?.content) {
				return normalizeDraftDocument(date, null);
			}

			return normalizeDraftDocument(date, JSON.parse(file.content));
		},

		async appendDailyNote({ date, text, senderId, senderName, conversationId, raw }) {
			await githubClient.ensureBranch(draftBranch, mainBranch);
			const path = createDraftPath(draftRoot, date);
			const existing = await this.readDailyNotes(date);

			existing.entries.push({
				id: randomUUID(),
				at: new Date().toISOString(),
				senderId,
				senderName,
				conversationId,
				text,
				raw,
			});

			await githubClient.putFile(path, toPrettyJson(existing), {
				branch: draftBranch,
				message: `chore(notes): append dingtalk note for ${date}`,
			});

			return existing;
		},

		async clearDailyNotes(date) {
			await githubClient.ensureBranch(draftBranch, mainBranch);
			const emptyDocument = normalizeDraftDocument(date, null);
			const path = createDraftPath(draftRoot, date);

			await githubClient.putFile(path, toPrettyJson(emptyDocument), {
				branch: draftBranch,
				message: `chore(notes): reset dingtalk notes for ${date}`,
			});

			return emptyDocument;
		},
	};
}
