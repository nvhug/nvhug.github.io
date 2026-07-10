import Link from 'next/link'
import { Post } from '@/types'
import { formatDate } from '@/lib/utils'

interface TableOfContentsCardProps {
  post: Post
  index: number
}

export default function TableOfContentsCard({ post, index }: TableOfContentsCardProps) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <div className="toc-item group">
        {/* Number */}
        <div className="toc-number">
          {String(index + 1).padStart(2, '0')}
        </div>

        {/* Content */}
        <div className="toc-content">
          {/* Title */}
          <h3 className="toc-title">
            {post.title}
          </h3>

          {/* Description */}
          {post.excerpt && (
            <p className="toc-description">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="toc-meta">
            <time className="toc-date">
              {formatDate(post.created_at)}
            </time>
          </div>
        </div>

        {/* Divider line */}
        <div className="toc-divider"></div>
      </div>
    </Link>
  )
}
