const COMMAND_OPTION_PATTERN = /--([a-zA-Z][\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

export function getTodayInTimeZone(timeZone = 'Asia/Shanghai') {
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	return formatter.format(new Date());
}

export function isValidDateString(value) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function createJsonResponse(statusCode, payload) {
	return {
		statusCode,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'access-control-allow-origin': '*',
			'access-control-allow-methods': 'GET,POST,OPTIONS',
			'access-control-allow-headers': 'content-type,authorization,x-dingtalk-signature',
		},
		body: JSON.stringify(payload, null, 2),
	};
}

export function parseBody(rawBody, isBase64Encoded = false) {
	if (rawBody == null || rawBody === '') {
		return null;
	}

	const text = isBase64Encoded
		? Buffer.from(rawBody, 'base64').toString('utf8')
		: String(rawBody);

	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

export function normalizeHeaders(headers = {}) {
	const normalized = {};

	for (const [key, value] of Object.entries(headers)) {
		normalized[String(key).toLowerCase()] = value;
	}

	return normalized;
}

export function parseCommandText(rawText) {
	const text = String(rawText || '').trim();

	if (!text) {
		return {
			type: 'empty',
			text: '',
			freeText: '',
			options: {},
		};
	}

	if (!text.startsWith('/')) {
		return {
			type: 'note',
			text,
			freeText: text,
			options: {},
		};
	}

	const firstWhitespace = text.indexOf(' ');
	const commandToken = (firstWhitespace === -1 ? text.slice(1) : text.slice(1, firstWhitespace))
		.trim()
		.toLowerCase();
	const remainder = firstWhitespace === -1 ? '' : text.slice(firstWhitespace + 1);
	const options = {};

	for (const match of remainder.matchAll(COMMAND_OPTION_PATTERN)) {
		const [, key, doubleQuoted, singleQuoted, bare] = match;
		options[key] = (doubleQuoted ?? singleQuoted ?? bare ?? '').trim();
	}

	const freeText = remainder.replace(COMMAND_OPTION_PATTERN, '').trim();

	return {
		type: commandToken || 'note',
		text,
		freeText,
		options,
	};
}

export function extractIncomingMessage(payload) {
	if (typeof payload === 'string') {
		return {
			text: payload,
			senderName: 'anonymous',
			senderId: 'anonymous',
			raw: payload,
		};
	}

	if (!payload || typeof payload !== 'object') {
		return {
			text: '',
			senderName: 'anonymous',
			senderId: 'anonymous',
			raw: payload,
		};
	}

	const text =
		payload.text?.content ||
		payload.text?.text ||
		payload.content ||
		payload.message?.text ||
		payload.message ||
		payload.prompt ||
		'';

	return {
		text: String(text || '').trim(),
		senderName:
			payload.senderNick ||
			payload.senderName ||
			payload.senderStaffId ||
			payload.senderId ||
			'anonymous',
		senderId:
			payload.senderId ||
			payload.senderStaffId ||
			payload.staffId ||
			payload.chatbotUserId ||
			'anonymous',
		conversationId: payload.conversationId || payload.sessionWebhook || payload.chatId || '',
		raw: payload,
	};
}

export function sanitizeTags(tags) {
	const values = Array.isArray(tags) ? tags : String(tags || '').split(',');
	const deduped = new Set();

	for (const item of values) {
		const value = String(item || '').trim();

		if (value) {
			deduped.add(value);
		}
	}

	return [...deduped].slice(0, 5);
}

export function slugify(value) {
	const slug = String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');

	return slug || 'ai-generated-post';
}

export function toIsoTimestamp(dateString, timeZone = 'Asia/Shanghai') {
	if (!isValidDateString(dateString)) {
		throw new Error(`Invalid date string: ${dateString}`);
	}

	const offset = timeZone === 'Asia/Shanghai' ? '+08:00' : 'Z';
	return `${dateString}T09:00:00${offset}`;
}

function quoteYamlString(value) {
	return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

export function formatMarkdownPost({
	title,
	description,
	pubDate,
	updatedDate,
	tags = [],
	draft = false,
	bodyMarkdown,
}) {
	const lines = [
		'---',
		`title: ${quoteYamlString(title)}`,
		`description: ${quoteYamlString(description)}`,
		`pubDate: ${pubDate}`,
	];

	if (updatedDate) {
		lines.push(`updatedDate: ${updatedDate}`);
	}

	if (tags.length > 0) {
		lines.push('tags:');
		for (const tag of tags) {
			lines.push(`  - ${quoteYamlString(tag)}`);
		}
	}

	if (draft) {
		lines.push('draft: true');
	}

	lines.push('---', '', String(bodyMarkdown || '').trim(), '');

	return lines.join('\n');
}

export function extractJsonObject(text) {
	const source = String(text || '').trim();

	if (!source) {
		throw new Error('Model returned empty content.');
	}

	try {
		return JSON.parse(source);
	} catch {
	}

	const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);

	if (fenced?.[1]) {
		return JSON.parse(fenced[1].trim());
	}

	const firstBrace = source.indexOf('{');
	const lastBrace = source.lastIndexOf('}');

	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		return JSON.parse(source.slice(firstBrace, lastBrace + 1));
	}

	throw new Error('Unable to parse JSON object from model output.');
}

export function toPrettyJson(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}
