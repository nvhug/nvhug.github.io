import { describe, expect, it } from 'vitest'
import { PostRow, toPost, toPosts } from './blog-posts'

function row(overrides: Partial<PostRow> = {}): PostRow {
  return {
    id: 'p1',
    title: 'Bài viết',
    slug: 'bai-viet',
    content: '<p>x</p>',
    excerpt: 'x',
    is_public: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    post_tags: [],
    ...overrides,
  }
}

describe('toPost', () => {
  it('flattens the embedded post_tags rows into tags, keeping a Sức Khỏe tag', () => {
    const post = toPost(row({ post_tags: [{ tags: { id: 't1', name: 'Sức Khỏe' } }] }))
    expect(post.tags).toEqual([{ id: 't1', name: 'Sức Khỏe' }])
  })

  it('drops the raw post_tags key from the result', () => {
    const post = toPost(row())
    expect(post).not.toHaveProperty('post_tags')
  })
})

describe('toPosts', () => {
  it('flattens the embedded post_tags rows into tags', () => {
    const [post] = toPosts([
      row({ post_tags: [{ tags: { id: 't1', name: 'Motivation' } }, { tags: { id: 't2', name: 'Life' } }] }),
    ])
    expect(post.tags).toEqual([
      { id: 't1', name: 'Motivation' },
      { id: 't2', name: 'Life' },
    ])
  })

  it('drops a null tag left by a join that matched no row', () => {
    const [post] = toPosts([row({ post_tags: [{ tags: null }, { tags: { id: 't1', name: 'Life' } }] })])
    expect(post.tags).toEqual([{ id: 't1', name: 'Life' }])
  })

  it('excludes a post tagged Sức Khỏe — that content belongs to the health surface', () => {
    const posts = toPosts([
      row({ id: 'keep', post_tags: [{ tags: { id: 't1', name: 'Life' } }] }),
      row({ id: 'drop', post_tags: [{ tags: { id: 't2', name: 'Sức Khỏe' } }] }),
    ])
    expect(posts.map((p) => p.id)).toEqual(['keep'])
  })

  it('keeps a post with no tags at all', () => {
    // The anonymous branch always looks like this: no anon policy on post_tags,
    // so every row arrives with an empty embed and must still be listed.
    const posts = toPosts([row({ id: 'bare' })])
    expect(posts.map((p) => p.id)).toEqual(['bare'])
    expect(posts[0].tags).toEqual([])
  })

  it('drops the raw post_tags key from the result', () => {
    const [post] = toPosts([row()])
    expect(post).not.toHaveProperty('post_tags')
  })
})
