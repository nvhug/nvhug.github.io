import { Post, Tag } from '@/types'

// A `posts` row as `select('*, post_tags(tags(id, name))')` returns it.
export type PostRow = Post & { post_tags: { tags: Tag | null }[] }

// Flattens the embedded `post_tags(tags(...))` rows on a single row into `Post.tags`.
export function toPost(row: PostRow): Post {
  const { post_tags, ...post } = row
  return {
    ...post,
    tags: post_tags.map((pt) => pt.tags).filter((tag): tag is Tag => tag !== null),
  }
}

/**
 * Maps every row with `toPost`, then drops the posts that belong to the health
 * surface rather than the blog.
 *
 * Shared by both branches of the /blog list — the signed-in account's own posts
 * and the admin account's public ones — so the two can never hand `HomeClient`
 * differently-shaped rows. On the anonymous branch `post_tags` always comes back
 * empty (there is no anon policy on `post_tags`, sql/28), so the tag exclusion
 * below is inert there: keeping such a post off the public list is the admin's
 * `is_public` toggle, not this filter.
 */
export function toPosts(rows: PostRow[]): Post[] {
  return rows.map(toPost).filter((post) => !post.tags?.some((tag) => tag.name === 'Sức Khỏe'))
}
