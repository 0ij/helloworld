// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const repository = process.env.GITHUB_REPOSITORY;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = repository?.split('/')[1];
const envBase = process.env.BASE_PATH?.trim();
const envSite = process.env.SITE_URL?.trim();
const isUserOrOrgSite =
	!!owner && !!repo && repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;

/** @param {string} value */
const normalizeBase = (value) => {
	if (!value || value === '/') {
		return '/';
	}

	return `/${value.replace(/^\/+|\/+$/g, '')}`;
};

const base = envBase ? normalizeBase(envBase) : repo && !isUserOrOrgSite ? `/${repo}` : '/';
const site =
	envSite ||
	(owner && repo ? `https://${owner}.github.io${isUserOrOrgSite ? '' : base}` : 'https://example.github.io');

export default defineConfig({
	site,
	base,
	integrations: [mdx(), sitemap()],
});
