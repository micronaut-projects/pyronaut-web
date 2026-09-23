import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * Blog posts live under `src/content/blog/YYYY/MM/DD/<name>.md`, mirroring
 * the micronaut-web layout. `slug` is the public route (`2026/09/23/<name>`).
 */
const blogPosts = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: "**/*.md",
  }),
  schema: z.object({
    order: z.number().optional(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    modified: z.coerce.date().optional(),
    author: z.string().optional(),
    category: z.string().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    href: z.string().optional(),
  }),
});

export const collections = {
  blogPosts,
};
