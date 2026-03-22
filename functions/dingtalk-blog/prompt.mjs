export function buildBlogMessages({ date, notes, titleHint, tagsHint, styleHint }) {
	const noteLines = notes.map((entry, index) => {
		const sender = entry.senderName || entry.senderId || 'user';
		return `[${index + 1}] ${entry.at} ${sender}: ${entry.text}`;
	});

	const hints = [
		titleHint ? `- 标题偏好：${titleHint}` : null,
		tagsHint?.length ? `- 标签偏好：${tagsHint.join('、')}` : null,
		styleHint ? `- 风格要求：${styleHint}` : null,
	]
		.filter(Boolean)
		.join('\n');

	return [
		{
			role: 'system',
			content: `你是一个技术博客写作助手。

你的任务是把聊天素材整理成一篇中文技术博客。
必须输出严格 JSON，不要输出 Markdown 代码块，不要输出解释性文字。

JSON 格式必须是：
{
  "title": "文章标题",
  "description": "一句话摘要，建议 40 到 80 个中文字符",
  "slug": "lowercase-ascii-hyphen-slug",
  "tags": ["标签1", "标签2"],
  "bodyMarkdown": "正文 Markdown，不要包含 frontmatter"
}

要求：
1. 文章语言使用中文。
2. 主题必须围绕素材中的技术内容，不要编造与素材无关的事实。
3. 正文必须是完整博客，不是提纲，至少包含 4 个二级标题。
4. 正文第一段需要先交代背景或问题。
5. slug 必须只包含小写字母、数字和连字符。
6. tags 保持 2 到 5 个。
7. 如果素材信息不足，可以做工程上合理的补全，但不要捏造具体版本号、链接或公司内部细节。`,
		},
		{
			role: 'user',
			content: `请根据以下素材生成博客。

发布日期：${date}
附加要求：
${hints || '- 无'}

素材：
${noteLines.join('\n')}`,
		},
	];
}
