'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'
import PostForm, { PostFormValues } from '@/components/PostForm'

export default function CreatePostPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(values: PostFormValues) {
    setSubmitting(true)
    try {
      const { data: post, error } = await supabase
        .from('posts')
        .insert([
          {
            title: values.title,
            slug: values.slug,
            excerpt: values.excerpt,
            content: values.content,
            published: values.published,
          },
        ])
        .select()
        .single()

      if (error) throw error

      if (values.tagIds.length > 0) {
        const { error: tagError } = await supabase
          .from('post_tags')
          .insert(values.tagIds.map((tagId) => ({ post_id: post.id, tag_id: tagId })))
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

      router.push('/admin')
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Failed to create post. Please check the console for details.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PostForm mode="create" submitting={submitting} onSubmit={handleSubmit} />
    </div>
  )
}
