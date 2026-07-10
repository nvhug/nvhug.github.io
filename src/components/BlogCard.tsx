import Link from 'next/link'
import { Post } from '@/types'
import { formatDate } from '@/lib/utils'

interface BlogCardProps {
  post: Post
}

export default function BlogCard({ post }: BlogCardProps) {
  return (
    <article className="card">
      <div className="flex justify-between items-start mb-3">
        <h3>
          <Link href={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
      </div>

      <time className="label">
        {formatDate(post.created_at)}
      </time>

      <p className="text mt-4">{post.excerpt}</p>

      {post.tags && post.tags.length > 0 && (
        <div className="mt-6 flex gap-2 flex-wrap">
          {post.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-block text-xs px-3 py-1 border border-current opacity-60"
            >
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/blog/${post.slug}`}
        className="inline-block mt-6 text-sm font-medium"
      >
        Read More →
      </Link>
    </article>
  )
}
