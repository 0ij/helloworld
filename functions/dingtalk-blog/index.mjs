import { createGitHubClient } from './github.mjs';
import { generateBlogPost } from './deepseek.mjs';
import { createNoteStorage } from './storage.mjs';
import {
	createJsonResponse,
	extractIncomingMessage,
	formatMarkdownPost,
	getTodayInTimeZone,
	isValidDateString,
	normalizeHeaders,
	parseBody,
	parseCommandText,
	sanitizeTags,
	slugify,
	toIsoTimestamp,
} from './utils.mjs';

function getConfig(env = process.env) {
	return {
		timeZone: env.BLOG_TIMEZONE || 'Asia/Shanghai',
		deepseekApiKey: env.DEEPSEEK_API_KEY || '',
		deepseekBaseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
		deepseekModel: env.DEEPSEEK_MODEL || 'deepseek-chat',
		githubToken: env.GITHUB_TOKEN || '',
		githubOwner: env.GITHUB_OWNER || '',
		githubRepo: env.GITHUB_REPO || '',
		githubMainBranch: env.GITHUB_MAIN_BRANCH || 'main',
		githubDraftBranch: env.GITHUB_DRAFT_BRANCH || 'ai-notes',
		githubDraftRoot: env.GITHUB_DRAFT_ROOT || 'automation/dingtalk-notes',
		postDirectory: env.BLOG_POST_DIRECTORY || 'src/content/blog',
		autoClearNotesOnPublish: String(env.AUTO_CLEAR_NOTES_ON_PUBLISH || 'true') === 'true',
	};
}

function requireGitHubConfig(config) {
	if (!config.githubToken || !config.githubOwner || !config.githubRepo) {
		throw new Error('Missing GitHub configuration. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO.');
	}
}

function requireDeepSeekConfig(config) {
	if (!config.deepseekApiKey) {
		throw new Error('Missing DEEPSEEK_API_KEY.');
	}
}

function resolveDate(optionDate, timeZone) {
	if (!optionDate) {
		return getTodayInTimeZone(timeZone);
	}

	if (!isValidDateString(optionDate)) {
		throw new Error('Invalid --date value. Use YYYY-MM-DD.');
	}

	return optionDate;
}

function normalizeEvent(event = {}) {
	const method =
		event.method ||
		event.httpMethod ||
		event.requestContext?.http?.method ||
		'GET';
	const path =
		event.path ||
		event.rawPath ||
		event.requestContext?.http?.path ||
		'/';

	return {
		method: String(method).toUpperCase(),
		path,
		headers: normalizeHeaders(event.headers || {}),
		body: parseBody(event.body, event.isBase64Encoded),
	};
}

function createServices(config) {
	const githubClient = createGitHubClient({
		token: config.githubToken,
		owner: config.githubOwner,
		repo: config.githubRepo,
	});

	return {
		githubClient,
		noteStorage: createNoteStorage({
			githubClient,
			draftBranch: config.githubDraftBranch,
			mainBranch: config.githubMainBranch,
			draftRoot: config.githubDraftRoot,
		}),
	};
}

function buildHelpPayload() {
	return {
		ok: true,
		message: 'Commands: 普通文本=记录素材, /publish 发布, /preview 预览, /reset 清空, /help 帮助。',
		examples: [
			'今天研究了 Astro 的部署路径和 GitHub Pages 配置',
			'/publish --title=Astro 部署实践 --tags=Astro,GitHub Pages',
			'/preview --style=偏实战，带踩坑',
			'/reset --date=2026-03-22',
		],
	};
}

async function handlePublish({ config, services, command, incomingMessage, previewOnly }) {
	requireGitHubConfig(config);
	requireDeepSeekConfig(config);

	const date = resolveDate(command.options.date, config.timeZone);
	const titleHint = command.options.title || command.freeText || '';
	const tagsHint = sanitizeTags(command.options.tags || '');
	const styleHint = command.options.style || '';
	const storedNotes = await services.noteStorage.readDailyNotes(date);
	const notes = [...storedNotes.entries];

	if (command.options.note) {
		notes.push({
			at: new Date().toISOString(),
			senderId: incomingMessage.senderId,
			senderName: incomingMessage.senderName,
			text: command.options.note,
		});
	}

	if (notes.length === 0) {
		return createJsonResponse(400, {
			ok: false,
			message: `没有找到 ${date} 的素材，先发几条普通消息，或用 /publish --note=... 直接附带素材。`,
		});
	}

	const generated = await generateBlogPost({
		apiKey: config.deepseekApiKey,
		baseUrl: config.deepseekBaseUrl,
		model: config.deepseekModel,
		date,
		notes,
		titleHint,
		tagsHint,
		styleHint,
	});

	const filename = `${date}-${slugify(generated.slug)}.md`;
	const contentPath = `${config.postDirectory}/${filename}`;
	const markdown = formatMarkdownPost({
		title: generated.title,
		description: generated.description,
		pubDate: toIsoTimestamp(date, config.timeZone),
		tags: generated.tags,
		bodyMarkdown: generated.bodyMarkdown,
	});

	if (previewOnly) {
		return createJsonResponse(200, {
			ok: true,
			message: `已生成预览，目标文件是 ${contentPath}。`,
			date,
			path: contentPath,
			markdown,
			post: generated,
		});
	}

	const result = await services.githubClient.putFile(contentPath, markdown, {
		branch: config.githubMainBranch,
		message: `feat(blog): publish AI post for ${date}`,
	});

	if (config.autoClearNotesOnPublish) {
		await services.noteStorage.clearDailyNotes(date);
	}

	return createJsonResponse(200, {
		ok: true,
		message: `博客已发布到 ${contentPath}，Git commit: ${result.commitSha || 'created'}`,
		date,
		path: contentPath,
		post: generated,
		commitSha: result.commitSha,
		clearedNotes: config.autoClearNotesOnPublish,
	});
}

async function handleDingTalkRequest(request, config) {
	const incomingMessage = extractIncomingMessage(request.body);
	const command = parseCommandText(incomingMessage.text);

	if (command.type === 'empty') {
		return createJsonResponse(400, {
			ok: false,
			message: '消息内容为空。',
		});
	}

	if (command.type === 'help') {
		return createJsonResponse(200, buildHelpPayload());
	}

	requireGitHubConfig(config);
	const services = createServices(config);

	if (command.type === 'publish') {
		return handlePublish({ config, services, command, incomingMessage, previewOnly: false });
	}

	if (command.type === 'preview') {
		return handlePublish({ config, services, command, incomingMessage, previewOnly: true });
	}

	if (command.type === 'reset') {
		const date = resolveDate(command.options.date, config.timeZone);
		await services.noteStorage.clearDailyNotes(date);

		return createJsonResponse(200, {
			ok: true,
			message: `已清空 ${date} 的草稿素材。`,
			date,
		});
	}

	const date = resolveDate(command.options.date, config.timeZone);
	const draft = await services.noteStorage.appendDailyNote({
		date,
		text: incomingMessage.text,
		senderId: incomingMessage.senderId,
		senderName: incomingMessage.senderName,
		conversationId: incomingMessage.conversationId,
		raw: incomingMessage.raw,
	});

	return createJsonResponse(200, {
		ok: true,
		message: `已记录素材，${date} 当前共有 ${draft.entries.length} 条。`,
		date,
		count: draft.entries.length,
	});
}

export async function handleRequest(event) {
	const config = getConfig();
	const request = normalizeEvent(event);

	if (request.method === 'OPTIONS') {
		return createJsonResponse(204, {});
	}

	if (request.method === 'GET' && (request.path === '/' || request.path === '/health')) {
		return createJsonResponse(200, {
			ok: true,
			service: 'dingtalk-blog',
			timeZone: config.timeZone,
			mainBranch: config.githubMainBranch,
			draftBranch: config.githubDraftBranch,
		});
	}

	if (request.method === 'POST' && request.path === '/dingtalk') {
		return handleDingTalkRequest(request, config);
	}

	return createJsonResponse(404, {
		ok: false,
		message: `Route not found: ${request.method} ${request.path}`,
	});
}

export async function handler(event, context) {
	try {
		return await handleRequest(event, context);
	} catch (error) {
		return createJsonResponse(500, {
			ok: false,
			message: error instanceof Error ? error.message : 'Unexpected error.',
		});
	}
}
