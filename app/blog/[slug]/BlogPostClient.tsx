'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Post, Comment } from '@/types'
import { ParchmentTemplate } from '@/components/templates/ParchmentTemplate'
import { InkTemplate } from '@/components/templates/InkTemplate'
import { MediumTemplate } from '@/components/templates/MediumTemplate'
import { VercelTemplate } from '@/components/templates/VercelTemplate'
import { GitHubTemplate } from '@/components/templates/GitHubTemplate'
import { NotionTemplate } from '@/components/templates/NotionTemplate'
import { AppleTemplate } from '@/components/templates/AppleTemplate'
import type { TemplateProps } from '@/components/templates/ParchmentTemplate'
import { FloatingTemplateSwitch } from '@/components/blog/FloatingTemplateSwitch'
import { CommentsSection } from '@/components/blog/CommentsSection'

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function injectHeadingIds(html: string): string {
  const seen = new Map<string, number>()
  return html.replace(/<(h[23])([^>]*)>([\s\S]*?)<\/h[23]>/gi, (_, tag, attrs, inner) => {
    if (/\bid=/.test(attrs)) return _
    const text = inner.replace(/<[^>]*>/g, '').trim()
    const base = slugify(text)
    if (!base) return _
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count}`
    return `<${tag}${attrs} id="${id}">${inner}</${tag}>`
  })
}

const TEMPLATE_MAP: Record<string, React.ComponentType<TemplateProps>> = {
  parchment: ParchmentTemplate,
  ink: InkTemplate,
  medium: MediumTemplate,
  vercel: VercelTemplate,
  github: GitHubTemplate,
  notion: NotionTemplate,
  apple: AppleTemplate,
}

export default function BlogPostClient({
  post,
  relatedSlot,
  isOwner,
}: {
  post: Post
  relatedSlot: ReactNode
  isOwner: boolean
}) {
  const searchParams = useSearchParams()
  const backHref = searchParams.get('from') === 'health' ? '/notes#health' : '/blog'
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState({ author: '', content: '' })

  // Both derive from post.content alone, which never changes after mount — but
  // every keystroke in the comment form re-renders this component, and without
  // memoizing, that meant re-sanitizing and re-counting the whole post body on
  // every keystroke.
  const processedContent = useMemo(
    () => DOMPurify.sanitize(injectHeadingIds(post.content)),
    [post.content]
  )
  const readingMinutes = useMemo(
    () => Math.max(1, Math.ceil((post.content?.replace(/<[^>]*>/g, '').trim().split(/\s+/).length || 0) / 220)),
    [post.content]
  )

  useEffect(() => {
    // Owner only: the comments RLS policy is owner-scoped, so an anonymous read
    // returns nothing anyway — skip the round trip rather than fetch an empty list.
    if (!isOwner) return
    fetchComments(post.id)
  }, [post.id, isOwner])

  async function fetchComments(postId: string) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.author || !newComment.content) return
    try {
      const { error } = await supabase.from('comments').insert([
        { post_id: post.id, author: newComment.author, content: newComment.content },
      ])
      if (error) throw error
      setNewComment({ author: '', content: '' })
      await fetchComments(post.id)
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  function handleCommentChange(field: 'author' | 'content', value: string) {
    setNewComment((prev) => ({ ...prev, [field]: value }))
  }

  const Template = TEMPLATE_MAP[post.template || 'parchment'] ?? ParchmentTemplate

  // Comments are owner-only end to end — RLS on the `comments` table grants no
  // anon or other-account access at all, so a stranger's list is always empty
  // and their submit always silently fails. Built once here so every template
  // just renders (or skips) the same element instead of re-deriving the gate.
  const commentsSlot = isOwner ? (
    <CommentsSection
      comments={comments}
      newComment={newComment}
      onCommentChange={handleCommentChange}
      onSubmit={handleAddComment}
    />
  ) : null

  return (
    <>
      <Template
        post={post}
        processedContent={processedContent}
        readingMinutes={readingMinutes}
        backHref={backHref}
        comments={comments}
        commentsSlot={commentsSlot}
      />
      {relatedSlot}
      {/* Owner only: the switch writes the post's template to the DB, so it must
          never be offered to a public reader. */}
      {isOwner && (
        <FloatingTemplateSwitch postId={post.id} current={post.template || 'parchment'} />
      )}
    </>
  )
}
