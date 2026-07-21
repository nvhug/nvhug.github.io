'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

type ProfileData = {
  tagline: string
  bio: string
  skills: string
  interests: string
  contact_email: string
}

const DEFAULT_PROFILE: ProfileData = {
  tagline: 'Software Engineer',
  bio: 'Giới thiệu ngắn về bản thân, kinh nghiệm và định hướng công việc.',
  skills: 'Kỹ năng chuyên môn của bạn...',
  interests: 'Hoạt động và sở thích ngoài công việc...',
  contact_email: '',
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [drafts, setDrafts] = useState<ProfileData>(DEFAULT_PROFILE)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUser(user)

      const { data } = await getSupabaseBrowserClient()
        .from('user_profiles')
        .select('profile_data')
        .eq('id', user.id)
        .single()

      if (data?.profile_data && Object.keys(data.profile_data).length > 0) {
        setProfile({ ...DEFAULT_PROFILE, ...data.profile_data })
      }
      setLoading(false)
    }
    void load()
  }, [router])

  function enterEdit() {
    setDrafts({ ...profile })
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
  }

  async function saveAll() {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await getSupabaseBrowserClient()
        .from('user_profiles')
        .update({ profile_data: drafts })
        .eq('id', user.id)
      if (error) throw error
      setProfile({ ...drafts })
      setEditMode(false)
      toast.success('Đã lưu profile.')
    } catch {
      toast.error('Không thể lưu.')
    } finally {
      setSaving(false)
    }
  }

  function set(field: keyof ProfileData, value: string) {
    setDrafts((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <main className="min-h-svh bg-[#f7fef9] pt-24">
        <p className="text-center text-sm text-zinc-500">Đang tải...</p>
      </main>
    )
  }

  const displayName = user?.user_metadata?.full_name as string | undefined
  const avatarLetter = (displayName?.trim()[0] ?? user?.email?.[0] ?? '?').toUpperCase()
  const email = user?.email ?? ''

  const inputCls = 'w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-1 focus:ring-emerald-400 resize-none'
  const textCls = (base: string) =>
    `block w-full rounded-lg px-1 py-0.5 ${base} ${!editMode ? 'cursor-text hover:bg-emerald-50 transition-colors' : ''}`

  return (
    <main className="min-h-svh bg-[#f7fef9] pb-16 pt-24">
      {/* Hero */}
      <section className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="relative rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)] sm:p-8">

          {/* Edit toggle */}
          <div className="absolute right-4 top-4 flex items-center gap-1.5">
            {editMode ? (
              <>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Hủy
                </button>
                <button
                  onClick={() => void saveAll()}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </>
            ) : (
              <button
                onClick={enterEdit}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                title="Chỉnh sửa profile"
              >
                <Pencil className="h-3.5 w-3.5" />
                Sửa
              </button>
            )}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Profile</p>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white">
              {avatarLetter}
            </div>
            <div className="min-w-0">
              <h1 className="font-poppins text-2xl font-semibold text-zinc-900">{displayName ?? email}</h1>
              <p className="text-sm text-zinc-500">{email}</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Tagline</p>
              {editMode ? (
                <input
                  type="text"
                  value={drafts.tagline}
                  onChange={(e) => set('tagline', e.target.value)}
                  className={inputCls}
                  placeholder="Tagline ngắn gọn..."
                />
              ) : (
                <span
                  onDoubleClick={enterEdit}
                  className={textCls('text-lg font-medium text-zinc-700')}
                >
                  {profile.tagline || <span className="italic text-zinc-400">Nhấp Sửa để thêm...</span>}
                </span>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Bio</p>
              {editMode ? (
                <textarea
                  value={drafts.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  rows={3}
                  className={inputCls}
                  placeholder="Giới thiệu ngắn..."
                />
              ) : (
                <span
                  onDoubleClick={enterEdit}
                  className={textCls('text-sm leading-relaxed text-zinc-600')}
                >
                  {profile.bio || <span className="italic text-zinc-400">Nhấp Sửa để thêm...</span>}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Skills & Interests */}
      <section className="mx-auto mt-6 w-full max-w-3xl px-4 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-white p-6">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Kỹ năng</h2>
            {editMode ? (
              <textarea
                value={drafts.skills}
                onChange={(e) => set('skills', e.target.value)}
                rows={4}
                className={inputCls}
                placeholder="Kỹ năng chuyên môn..."
              />
            ) : (
              <span
                onDoubleClick={enterEdit}
                className={textCls('text-sm leading-relaxed text-zinc-600')}
              >
                {profile.skills || <span className="italic text-zinc-400">Nhấp Sửa để thêm...</span>}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Sở thích</h2>
            {editMode ? (
              <textarea
                value={drafts.interests}
                onChange={(e) => set('interests', e.target.value)}
                rows={4}
                className={inputCls}
                placeholder="Sở thích ngoài công việc..."
              />
            ) : (
              <span
                onDoubleClick={enterEdit}
                className={textCls('text-sm leading-relaxed text-zinc-600')}
              >
                {profile.interests || <span className="italic text-zinc-400">Nhấp Sửa để thêm...</span>}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="mx-auto mt-6 w-full max-w-3xl px-4 sm:px-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h3 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Liên hệ</h3>
          <p className="mb-1 text-xs font-medium text-zinc-500">Email liên hệ</p>
          {editMode ? (
            <input
              type="email"
              value={drafts.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              className={inputCls}
              placeholder="email@example.com"
            />
          ) : (
            <span
              onDoubleClick={enterEdit}
              className={textCls('text-sm text-zinc-700')}
            >
              {profile.contact_email || <span className="italic text-zinc-400">Nhấp Sửa để thêm...</span>}
            </span>
          )}
          {!editMode && profile.contact_email && (
            <a
              href={`mailto:${profile.contact_email}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:from-emerald-400 hover:to-emerald-500"
            >
              Gửi Email
            </a>
          )}
        </div>
      </section>

      {/* Save bar when editing */}
      {editMode && (
        <div className="mx-auto mt-6 flex w-full max-w-3xl justify-end gap-2 px-4 sm:px-6">
          <button
            onClick={cancelEdit}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => void saveAll()}
            disabled={saving}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu tất cả'}
          </button>
        </div>
      )}
    </main>
  )
}
