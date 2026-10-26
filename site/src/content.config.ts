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
      category: z.enum(['origin', 'vibelog', 'devlog', 'philosophy', 'character', 'insight', 'support', 'cardnews']),
      series: z.string().optional(),
      seriesNumber: z.number().optional(),
      tags: z.array(z.string()).default([]),
      status: z.enum(['draft', 'published']).default('published'),
      // 네이버 블로그로 옮긴 글은 원문 대신 이 주소로 가는 안내만 보여 준다 (2026-10-25)
      naverUrl: z.string().url().optional(),
    }),
});

export const collections = { blog };
