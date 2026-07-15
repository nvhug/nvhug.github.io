import Link from 'next/link'
import { marked } from 'marked'
import { Post } from '@/types'
import { formatDate, getTagColor } from '@/lib/utils'

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
            <p
              className="toc-description"
              dangerouslySetInnerHTML={{
                __html: marked.parseInline(post.excerpt) as string,
              }}
            />
          )}

          {/* Meta */}
          <div className="toc-meta">
            <time className="toc-date">
              {formatDate(post.created_at)}
            </time>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => {
                const colors = getTagColor(tag.name)
                return (
                  <span
                    key={tag.id}
                    className={`inline-block rounded-full border ${colors.border} ${colors.bg} px-2.5 py-0.5 text-xs font-medium ${colors.text}`}
                  >
                    {tag.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Divider line */}
        <div className="toc-divider"></div>
      </div>
    </Link>
  )
}
