// src/content/config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 1. Define the schema for Blog posts
// This standard schema is highly compatible with external SEO tools like seobotai.
const blogCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // Optional main image for the post card and hero area
    heroImage: image().optional(),
    heroImageAlt: z.string().optional(),
    // Tags for future categorization
    tags: z.array(z.string()).optional(),
    // Author attribution
    author: z.string().default('The Hermetic Flight Team'),
    // Draft status to hide posts from build
    draft: z.boolean().default(false),
  }),
});

// 2. Define schema for FAQ
// We'll use a structured JSON file for easier management of the large text block.
const faqCollection = defineCollection({
  type: 'data', // 'data' type for JSON files
  schema: z.object({
    title: z.string(),
    // An array of Q&A pairs within this category
    questions: z.array(
      z.object({
        q: z.string(),
        a: z.string(), // We will allow HTML string here for paragraph breaks
      })
    ),
  }),
});

// 3. Export the collections
export const collections = {
  'blog': blogCollection,
  'faq': faqCollection,
};