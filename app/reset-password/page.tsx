'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await getSupabaseBrowserClient().auth.getSession()
      if (data.session) {
        setReady(true)
      } else {
        setError(t('resetPassword.invalidLink'))
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError(t('signup.errorPassword'))
      return
    }
    if (password !== confirm) {
      setError(t('signup.errorConfirm'))
      return
    }
    setLoading(true)
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(t('resetPassword.error'))
      return
    }
    setSuccess(true)
    setTimeout(() => router.replace('/login'), 2000)
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_12%_16%,rgba(16,185,129,0.18),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(52,211,153,0.2),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] px-4 py-14 sm:px-6">
      <div className="relative mx-auto flex min-h-[calc(100svh-7rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_35px_70px_-50px_rgba(16,185,129,0.7)] backdrop-blur sm:p-8">

          {success ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-medium text-zinc-900">{t('resetPassword.success')}</p>
              <p className="text-sm text-zinc-500">{t('resetPassword.redirecting')}</p>
            </div>
          ) : !ready && !error ? (
            <p className="text-center text-sm text-zinc-500">{t('common.loading')}</p>
          ) : error && !ready ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-rose-600">{error}</p>
              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="text-sm font-medium text-emerald-600 hover:underline"
              >
                ← {t('resetPassword.backToLogin')}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('resetPassword.heading')}</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="password"
                  autoFocus
                  autoComplete="new-password"
                  placeholder={t('resetPassword.newPassword')}
                  value={password}
                  onChange={(e) => { setError(''); setPassword(e.target.value) }}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('resetPassword.confirmPassword')}
                  value={confirm}
                  onChange={(e) => { setError(''); setConfirm(e.target.value) }}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
                />

                {error && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loading ? t('resetPassword.loading') : t('resetPassword.submit')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
