'use client'

import { useCallback, useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'
import { Post, Tag } from '@/types'
import PostForm, { PostFormValues } from '@/components/PostForm'
import { useLanguage } from '@/lib/i18n/language-context'

type PostRow = Post & { post_tags: { tags: Tag | null }[] }

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLanguage()
  const { id } = use(params)
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetchPost = useCallback(async (withLoading = true) => {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_tags(tags(id, name))')
        .eq('id', id)
        .single()

      if (error) throw error

      const { post_tags, ...rest } = data as PostRow
      setPost({
        ...rest,
        tags: post_tags.map((pt) => pt.tags).filter((tag): tag is Tag => tag !== null),
      })
    } catch (error) {
      console.error('Error fetching post:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPost(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchPost])

  async function handleSubmit(values: PostFormValues) {
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          title: values.title,
          slug: values.slug,
          excerpt: values.excerpt,
          content: values.content,
          published: values.published,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      const { error: deleteError } = await supabase.from('post_tags').delete().eq('post_id', id)
      if (deleteError) throw deleteError

      if (values.tagIds.length > 0) {
        const { error: tagError } = await supabase
          .from('post_tags')
          .insert(values.tagIds.map((tagId) => ({ post_id: id, tag_id: tagId })))
        if (tagError) throw tagError
      }

      // Revalidate home page cache
      await fetch('/api/revalidate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_REVALIDATE_SECRET}`,
        },
      }).catch(() => {
        // Silently fail if revalidation doesn't work
      })

      router.refresh()
      router.push('/admin')
    } catch (error) {
      console.error('Error updating post:', error)
      alert(t('admin.posts.updateError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id)
      if (error) throw error
      router.push('/admin')
    } catch (error) {
      console.error('Error deleting post:', error)
      alert(t('admin.posts.deleteError'))
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
  }

  if (!post) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('admin.posts.notFound')}</div>
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PostForm
        mode="edit"
        initialPost={post}
        submitting={submitting}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </div>
  )
}
