// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: image().optional(),
    heroImageAlt: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().default('The Hermetic Flight Team'),
    draft: z.boolean().default(false),
    hideDate: z.boolean().default(false),
  }),
});

const faqCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    questions: z.array(
      z.object({
        q: z.string(),
        a: z.string(),
      })
    ),
  }),
});

export const collections = {
  'blog': blogCollection,
  'faq': faqCollection,
};
