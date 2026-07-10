'use client'

import { useEffect, useRef } from 'react'
import type Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { uploadPostImage } from '@/lib/storage'

interface RichEditorProps {
  value: string
  onChange: (content: string) => void
  placeholder?: string
}

function imageHandler(quill: Quill) {
  const input = document.createElement('input')
  input.setAttribute('type', 'file')
  input.setAttribute('accept', 'image/*')
  input.click()

  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return

    const range = quill.getSelection(true)
    quill.insertText(range.index, 'Uploading image...', 'italic', true)

    try {
      const url = await uploadPostImage(file)
      quill.deleteText(range.index, 'Uploading image...'.length)
      quill.insertEmbed(range.index, 'image', url, 'user')
      quill.setSelection(range.index + 1, 0)
    } catch (error) {
      console.error('Image upload failed:', error)
      quill.deleteText(range.index, 'Uploading image...'.length)
      alert('Tải ảnh lên thất bại. Vui lòng thử lại.')
    }
  }
}

export default function RichEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
}: RichEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false

    import('quill').then(({ default: Quill }) => {
      if (cancelled || !containerRef.current) return

      const quill = new Quill(containerRef.current, {
        theme: 'snow',
        placeholder,
        modules: {
          toolbar: {
            container: [
              [{ header: [2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike', 'code'],
              [{ color: [] }, { background: [] }],
              [{ list: 'bullet' }, { list: 'ordered' }],
              [{ indent: '-1' }, { indent: '+1' }],
              [{ align: [] }],
              ['blockquote', 'link', 'image'],
              ['clean'],
            ],
            handlers: {
              image: () => imageHandler(quill),
            },
          },
          clipboard: {
            matchVisual: false,
          },
        },
      })

      quill.root.innerHTML = value

      quill.on('text-change', () => {
        onChangeRef.current(quill.root.innerHTML)
      })

      // Intentionally no custom paste handling here: pasted markdown is
      // inserted as plain text via Quill's default clipboard behavior
      // (each line becomes its own paragraph). Markdown -> HTML conversion
      // happens once, at save time, in PostForm's submit handler — not here.
      quillRef.current = quill
    })

    return () => {
      cancelled = true
      quillRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-700">
      <div ref={containerRef} />
    </div>
  )
}
