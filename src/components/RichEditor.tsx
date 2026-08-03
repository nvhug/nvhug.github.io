'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { uploadPostImage } from '@/lib/storage'
import { useLanguage } from '@/lib/i18n/language-context'

const TABLE_ROWS = 6
const TABLE_COLS = 8

interface RichEditorProps {
  value: string
  onChange: (content: string) => void
  placeholder?: string
}

function imageHandler(quill: Quill, uploadingLabel: string, uploadFailedMessage: string) {
  const input = document.createElement('input')
  input.setAttribute('type', 'file')
  input.setAttribute('accept', 'image/*')
  input.click()

  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return

    const range = quill.getSelection(true)
    quill.insertText(range.index, uploadingLabel, 'italic', true)

    try {
      const url = await uploadPostImage(file)
      quill.deleteText(range.index, uploadingLabel.length)
      quill.insertEmbed(range.index, 'image', url, 'user')
      quill.setSelection(range.index + 1, 0)
    } catch (error) {
      console.error('Image upload failed:', error)
      quill.deleteText(range.index, uploadingLabel.length)
      alert(uploadFailedMessage)
    }
  }
}

function buildTableHtml(rows: number, cols: number): string {
  let html = '<table style="border-collapse:collapse;width:100%"><tbody>'
  for (let r = 0; r < rows; r++) {
    html += '<tr>'
    for (let c = 0; c < cols; c++) {
      html += '<td style="border:1px solid #ccc;padding:6px 10px;min-width:80px">&nbsp;</td>'
    }
    html += '</tr>'
  }
  html += '</tbody></table><p><br></p>'
  return html
}

export default function RichEditor({
  value,
  onChange,
  placeholder: placeholderProp,
}: RichEditorProps) {
  const { t } = useLanguage()
  const placeholder = placeholderProp ?? t('richEditor.defaultPlaceholder')
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)

  const [tablePicker, setTablePicker] = useState(false)
  const [hovered, setHovered] = useState({ rows: 1, cols: 1 })
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })

  const insertTable = useCallback((rows: number, cols: number) => {
    const quill = quillRef.current
    if (!quill) return
    const range = quill.getSelection()
    const index = range ? range.index : quill.getLength() - 1
    quill.clipboard.dangerouslyPasteHTML(index, buildTableHtml(rows, cols))
    setTablePicker(false)
  }, [])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

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
              image: () => imageHandler(quill, t('richEditor.uploadingImage'), t('richEditor.uploadFailed')),
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

      // Inject table button into Quill's existing toolbar
      const toolbar = quill.getModule('toolbar') as { container: HTMLElement }
      const span = document.createElement('span')
      span.className = 'ql-formats'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'ql-table-insert'
      btn.title = t('richEditor.insertTable')
      btn.innerHTML = `<svg viewBox="0 0 18 18" width="16" height="16">
        <rect class="ql-stroke" x="2" y="3" width="14" height="12"/>
        <line class="ql-stroke" x1="6" x2="6" y1="3" y2="15"/>
        <line class="ql-stroke" x1="11" x2="11" y1="3" y2="15"/>
        <line class="ql-stroke" x1="2" x2="16" y1="7" y2="7"/>
        <line class="ql-stroke" x1="2" x2="16" y1="11" y2="11"/>
      </svg>`
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const wrapper = wrapperRef.current
        const tableBtn = wrapper?.querySelector<HTMLElement>('.ql-table-insert')
        if (tableBtn && wrapper) {
          const btnRect = tableBtn.getBoundingClientRect()
          const wrapRect = wrapper.getBoundingClientRect()
          setPickerPos({
            top: btnRect.bottom - wrapRect.top + 4,
            left: btnRect.left - wrapRect.left,
          })
        }
        setTablePicker((prev) => !prev)
      })
      span.appendChild(btn)
      toolbar.container.appendChild(span)

      quillRef.current = quill
    })

    return () => {
      cancelled = true
      quillRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close picker when clicking outside
  useEffect(() => {
    if (!tablePicker) return
    function handleOutsideClick(e: MouseEvent) {
      const picker = wrapperRef.current?.querySelector<HTMLElement>('.table-picker-popup')
      const btn = wrapperRef.current?.querySelector<HTMLElement>('.ql-table-insert')
      if (
        picker && !picker.contains(e.target as Node) &&
        btn && !btn.contains(e.target as Node)
      ) {
        setTablePicker(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [tablePicker])

  return (
    <div ref={wrapperRef} className="relative w-full rounded-lg border border-slate-700">
      <div ref={containerRef} className="overflow-hidden rounded-lg [&_.ql-editor]:min-h-150" />

      {tablePicker && (
        <div
          className="table-picker-popup absolute z-50 rounded-lg border border-slate-600 bg-slate-800 p-2 shadow-xl"
          style={{ top: pickerPos.top, left: pickerPos.left }}
        >
          <p className="mb-1.5 text-center text-xs text-slate-400">
            {t('richEditor.tableSizeLabel', { rows: hovered.rows, cols: hovered.cols })}
          </p>
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${TABLE_COLS}, 1fr)` }}
            onMouseLeave={() => setHovered({ rows: 1, cols: 1 })}
          >
            {Array.from({ length: TABLE_ROWS }, (_, r) =>
              Array.from({ length: TABLE_COLS }, (_, c) => (
                <div
                  key={`${r}-${c}`}
                  className={`h-4 w-4 cursor-pointer rounded-sm border transition-colors ${
                    r < hovered.rows && c < hovered.cols
                      ? 'border-emerald-400 bg-emerald-500/40'
                      : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                  }`}
                  onMouseEnter={() => setHovered({ rows: r + 1, cols: c + 1 })}
                  onClick={() => insertTable(r + 1, c + 1)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
