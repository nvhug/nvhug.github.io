'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { supabase } from '@/lib/supabase'
import PostForm, { PostFormValues } from '@/components/PostForm'
import { useLanguage } from '@/lib/i18n/language-context'

function CreatePostContent() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const autotagName = searchParams.get('autotag') ?? undefined
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
            is_public: values.isPublic,
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
      alert(t('admin.posts.createError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PostForm mode="create" autotagName={autotagName} submitting={submitting} onSubmit={handleSubmit} />
    </div>
  )
}

export default function CreatePostPage() {
  // useSearchParams requires a Suspense boundary; without it the page is
  // prerendered with empty params and ?autotag is lost on first render.
  return (
    <Suspense>
      <CreatePostContent />
    </Suspense>
  )
}
