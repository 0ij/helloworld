import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const entrySchema = ({ image }: { image: any }) =>
	z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
		heroImage: z.optional(image()),
	});

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: entrySchema,
});

const thoughts = defineCollection({
	loader: glob({ base: './src/content/thoughts', pattern: '**/*.{md,mdx}' }),
	schema: entrySchema,
});

export const collections = { blog, thoughts };
