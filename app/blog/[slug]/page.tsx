'use client'

import { useEffect, useState, use } from 'react'
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
import { RelatedPosts } from '@/components/blog/RelatedPosts'

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

export default function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const searchParams = useSearchParams()
  const backHref = searchParams.get('from') === 'health' ? '/notes#health' : '/'
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState({ author: '', content: '' })
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  const processedContent = post ? DOMPurify.sanitize(injectHeadingIds(post.content)) : ''
  const readingMinutes = Math.max(1, Math.ceil((post?.content?.replace(/<[^>]*>/g, '').trim().split(/\s+/).length || 0) / 220))

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('slug', slug)
          .eq('published', true)
          .single()
        if (error) throw error
        setPost(data)

        // Fetch related posts (same tags first, fallback to recent)
        const tagIds = data.tags?.map((t: { id: string }) => t.id) ?? []
        let related: Post[] = []

        if (tagIds.length > 0) {
          const { data: taggedPosts } = await supabase
            .from('post_tags')
            .select('post_id')
            .in('tag_id', tagIds)
            .neq('post_id', data.id)
            .limit(30)

          const ids = [...new Set((taggedPosts ?? []).map((r: { post_id: string }) => r.post_id))]
            .sort(() => Math.random() - 0.5)
            .slice(0, 10)

          if (ids.length > 0) {
            const { data: posts } = await supabase
              .from('posts')
              .select('id, title, slug, excerpt, created_at')
              .in('id', ids)
              .eq('published', true)
            related = (posts as Post[]) ?? []
          }
        }

        if (related.length < 10) {
          const exclude = [data.id, ...related.map((p) => p.id)]
          const { data: recent } = await supabase
            .from('posts')
            .select('id, title, slug, excerpt, created_at')
            .eq('published', true)
            .not('id', 'in', `(${exclude.join(',')})`)
            .limit(50)
          const shuffled = ((recent as Post[]) ?? []).sort(() => Math.random() - 0.5)
          related = [...related, ...shuffled].slice(0, 10)
        }

        setRelatedPosts(related)
      } catch (error) {
        console.error('Error fetching post:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPost()
  }, [slug])

  useEffect(() => {
    if (!post?.id) return
    fetchComments(post.id)
  }, [post?.id])

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
    if (!post || !newComment.author || !newComment.content) return
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

  if (loading) {
    return (
      <main className="min-h-svh bg-[#f7f4ed] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#e5e0d5] bg-white/75 p-16 text-center text-sm text-zinc-500">
          Loading...
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="min-h-svh bg-[#f7f4ed] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#e5e0d5] bg-white/75 p-16 text-center">
          Post not found
        </div>
      </main>
    )
  }

  const Template = TEMPLATE_MAP[post.template || 'parchment'] ?? ParchmentTemplate

  return (
    <>
      <Template
        post={post}
        processedContent={processedContent}
        readingMinutes={readingMinutes}
        backHref={backHref}
        comments={comments}
        newComment={newComment}
        onCommentChange={handleCommentChange}
        onAddComment={handleAddComment}
      />
      <RelatedPosts posts={relatedPosts} />
      <FloatingTemplateSwitch postId={post.id} current={post.template || 'parchment'} />
    </>
  )
}
