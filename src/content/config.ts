// src/content/config.ts
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

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
    pinned: z.boolean().default(false),
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

const archetypeJourneysCollection = defineCollection({
  loader: file('src/data/archetype-journeys.json'),
  schema: z.object({
    id: z.string(),
    description_extended: z.string(),
    affiliated_cards: z.array(
      z.object({
        name: z.string(),
        position: z.string(),
        relevance: z.string(),
      })
    ),
    recommended_spreads: z.array(
      z.object({
        name: z.string(),
        positions: z.array(z.string()).min(2),
        description: z.string(),
      })
    ),
    journaling_prompts: z.array(z.string()).min(3),
    blog_links: z.array(
      z.object({
        title: z.string(),
        slug: z.string(),
        relevance: z.string(),
      })
    ),
  }),
});

export const collections = {
  'blog': blogCollection,
  'faq': faqCollection,
  'archetypeJourneys': archetypeJourneysCollection,
};
