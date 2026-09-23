import { getCollection, type CollectionEntry } from "astro:content";

export type BlogPostEntry = CollectionEntry<"blogPosts">;

export type BlogPostModel = {
  slug: string;
  href: string;
  entry: BlogPostEntry;
};

export const BLOG_PAGE_SIZE = 24;

function byPostDateThenOrder(left: BlogPostModel, right: BlogPostModel) {
  return (
    right.entry.data.date.getTime() - left.entry.data.date.getTime() ||
    (left.entry.data.order ?? Number.MAX_SAFE_INTEGER) -
      (right.entry.data.order ?? Number.MAX_SAFE_INTEGER) ||
    left.entry.data.title.localeCompare(right.entry.data.title)
  );
}

let blogPostsPromise: Promise<BlogPostModel[]> | undefined;

/** Memoized: the collection is immutable for the lifetime of a build. */
export function getBlogPosts(): Promise<BlogPostModel[]> {
  return (blogPostsPromise ??= getCollection("blogPosts").then((entries) =>
    entries
      .map((entry) => ({
        slug: entry.data.slug,
        href: entry.data.href ?? `/${entry.data.slug}/`,
        entry,
      }))
      .sort(byPostDateThenOrder),
  ));
}

/** Categories of a post, primary first, without duplicates. */
export function postCategories(post: BlogPostModel): string[] {
  const { category, categories } = post.entry.data;
  return Array.from(new Set([category, ...categories].filter(Boolean))) as string[];
}

/** Blog categories are stored as slugs, e.g. "release-announcements". */
export function categoryLabel(slug: string): string {
  const label = slug.replace(/-/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatPostDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function paginate<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE);
}

export function totalPages(items: unknown[]): number {
  return Math.max(1, Math.ceil(items.length / BLOG_PAGE_SIZE));
}
