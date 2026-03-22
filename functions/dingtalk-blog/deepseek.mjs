import { buildBlogMessages } from './prompt.mjs';
import { extractJsonObject, sanitizeTags, slugify } from './utils.mjs';

function extractAssistantContent(responseJson) {
	const choice = responseJson?.choices?.[0];
	const content = choice?.message?.content;

	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((item) => (typeof item?.text === 'string' ? item.text : ''))
			.join('\n')
			.trim();
	}

	return '';
}

export async function generateBlogPost({
	apiKey,
	baseUrl = 'https://api.deepseek.com',
	model = 'deepseek-chat',
	date,
	notes,
	titleHint = '',
	tagsHint = [],
	styleHint = '',
}) {
	if (!apiKey) {
		throw new Error('Missing DEEPSEEK_API_KEY.');
	}

	const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			temperature: 0.7,
			messages: buildBlogMessages({
				date,
				notes,
				titleHint,
				tagsHint,
				styleHint,
			}),
		}),
	});

	const responseJson = await response.json().catch(() => ({}));

	if (!response.ok) {
		const message =
			responseJson?.error?.message ||
			responseJson?.message ||
			`DeepSeek request failed with status ${response.status}.`;
		throw new Error(message);
	}

	const content = extractAssistantContent(responseJson);
	const parsed = extractJsonObject(content);
	const title = String(parsed.title || titleHint || `AI 技术博客 ${date}`).trim();
	const description = String(parsed.description || '').trim() || `${title} 的生成摘要`;
	const bodyMarkdown = String(parsed.bodyMarkdown || '').trim();

	if (!bodyMarkdown) {
		throw new Error('DeepSeek returned empty bodyMarkdown.');
	}

	return {
		title,
		description,
		slug: slugify(parsed.slug || title),
		tags: sanitizeTags(parsed.tags?.length ? parsed.tags : tagsHint),
		bodyMarkdown,
		raw: parsed,
	};
}
