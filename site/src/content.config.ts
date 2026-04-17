import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(z.string()),
      author: z.string().default('필로 (Philo)'),
      category: z.enum(['origin', 'vibelog', 'devlog', 'philosophy', 'character', 'insight', 'support']),
      series: z.string().optional(),
      seriesNumber: z.number().optional(),
      tags: z.array(z.string()).default([]),
      status: z.enum(['draft', 'published']).default('published'),
    }),
});

export const collections = { blog };
