function encodeContentPath(contentPath) {
	return contentPath
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

export function createGitHubClient({ token, owner, repo, apiBaseUrl = 'https://api.github.com' }) {
	if (!token) {
		throw new Error('Missing GITHUB_TOKEN.');
	}

	if (!owner || !repo) {
		throw new Error('Missing GITHUB_OWNER or GITHUB_REPO.');
	}

	const baseUrl = apiBaseUrl.replace(/\/$/, '');

	async function request(path, { method = 'GET', body } = {}) {
		const response = await fetch(`${baseUrl}${path}`, {
			method,
			headers: {
				accept: 'application/vnd.github+json',
				authorization: `Bearer ${token}`,
				'user-agent': 'dingtalk-blog-bot',
				'x-github-api-version': '2022-11-28',
				...(body ? { 'content-type': 'application/json' } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		if (response.status === 204) {
			return null;
		}

		const json = await response.json().catch(() => ({}));

		if (!response.ok) {
			const error = new Error(json?.message || `GitHub API request failed with status ${response.status}.`);
			error.statusCode = response.status;
			throw error;
		}

		return json;
	}

	async function getBranchSha(branch) {
		try {
			const data = await request(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
			return data?.commit?.sha || null;
		} catch (error) {
			if (error.statusCode === 404) {
				return null;
			}

			throw error;
		}
	}

	return {
		async ensureBranch(branch, fromBranch) {
			const existing = await getBranchSha(branch);

			if (existing) {
				return existing;
			}

			const baseSha = await getBranchSha(fromBranch);

			if (!baseSha) {
				throw new Error(`Cannot create branch "${branch}" from missing base branch "${fromBranch}".`);
			}

			await request(`/repos/${owner}/${repo}/git/refs`, {
				method: 'POST',
				body: {
					ref: `refs/heads/${branch}`,
					sha: baseSha,
				},
			});

			return baseSha;
		},

		async getFile(contentPath, branch) {
			try {
				const data = await request(
					`/repos/${owner}/${repo}/contents/${encodeContentPath(contentPath)}?ref=${encodeURIComponent(branch)}`,
				);

				const content = data?.content
					? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8')
					: '';

				return {
					path: data.path,
					sha: data.sha,
					content,
				};
			} catch (error) {
				if (error.statusCode === 404) {
					return null;
				}

				throw error;
			}
		},

		async putFile(contentPath, content, { branch, message }) {
			const existing = await this.getFile(contentPath, branch);

			const data = await request(`/repos/${owner}/${repo}/contents/${encodeContentPath(contentPath)}`, {
				method: 'PUT',
				body: {
					message,
					branch,
					content: Buffer.from(content, 'utf8').toString('base64'),
					sha: existing?.sha,
				},
			});

			return {
				commitSha: data?.commit?.sha || null,
				fileSha: data?.content?.sha || null,
				existing: !!existing,
			};
		},
	};
}
