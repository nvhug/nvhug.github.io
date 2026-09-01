'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { JigsawSliderCaptcha } from '@/components/JigsawSliderCaptcha'
import { useOAuthSignIn } from '@/hooks/useOAuthSignIn'
import { safeNextPath } from '@/lib/permissions'
import { GoogleIcon, FacebookIcon } from '@/components/icons/OAuthIcons'

// ── OAuth buttons ─────────────────────────────────────────────

function OAuthStep({ redirect, onSignup, onEmailLogin, onForgot }: { redirect: string; onSignup: () => void; onEmailLogin: () => void; onForgot: () => void }) {
  const { t } = useLanguage()
  const { loading, error, signInWith } = useOAuthSignIn(redirect)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('login.oauthHeading')}</h2>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => signInWith('google')}
          disabled={loading !== null}
          className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          {loading === 'google' ? t('login.redirecting') : t('login.continueWithGoogle')}
        </button>

        <button
          type="button"
          onClick={() => signInWith('facebook')}
          disabled={loading !== null}
          className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FacebookIcon />
          {loading === 'facebook' ? t('login.redirecting') : t('login.continueWithFacebook')}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {t('login.oauthError')}
        </p>
      )}

      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-400">{t('login.or')}</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <button
        type="button"
        onClick={onEmailLogin}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        {t('login.continueWithEmail')}
      </button>

      <div className="border-t border-zinc-100 pt-2 space-y-1.5 text-center text-sm text-zinc-500">
        <div>
          Chưa có tài khoản?{' '}
          <button
            type="button"
            onClick={onSignup}
            className="font-medium text-emerald-600 hover:underline"
          >
            {t('signup.registerLink')}
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={onForgot}
            className="text-sm text-emerald-600 hover:underline"
          >
            {t('forgotPassword.link')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Email/password login ─────────────────────────────────────

function EmailLoginStep({ redirect, onBack, onSignup, onForgot }: { redirect: string; onBack: () => void; onSignup: () => void; onForgot: () => void }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (loginError) {
      setError(t('emailLogin.error'))
      return
    }
    window.location.href = redirect
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('emailLogin.heading')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => { setError(''); setEmail(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder={t('emailLogin.passwordPlaceholder')}
          value={password}
          onChange={(e) => { setError(''); setPassword(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />

        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="text-sm text-emerald-600 hover:underline">
            {t('forgotPassword.link')}
          </button>
        </div>

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
          {loading ? t('emailLogin.loading') : t('emailLogin.submit')}
        </button>
      </form>

      <div className="border-t border-zinc-100 pt-4 space-y-2 text-center text-sm text-zinc-500">
        <div>
          <button type="button" onClick={onBack} className="font-medium text-zinc-600 hover:underline">
            ← {t('emailLogin.backToOAuth')}
          </button>
        </div>
        <div>
          Chưa có tài khoản?{' '}
          <button type="button" onClick={onSignup} className="font-medium text-emerald-600 hover:underline">
            {t('signup.registerLink')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Email/password signup ────────────────────────────────────

function SignupStep({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [captchaKey, setCaptchaKey] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('signup.errorEmail'))
      return
    }
    if (password.length < 6) {
      setError(t('signup.errorPassword'))
      return
    }
    if (password !== confirm) {
      setError(t('signup.errorConfirm'))
      return
    }
    if (!captchaVerified) {
      setError(t('signup.errorCaptcha'))
      return
    }

    setLoading(true)
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })
    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      if (body.error === 'email_exists') {
        setError(t('signup.errorExists'))
      } else {
        setError(t('signup.errorGeneral'))
      }
      setCaptchaVerified(false)
      setCaptchaKey(k => k + 1)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-zinc-700">{t('signup.success')}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500"
        >
          {t('signup.backToLogin')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('signup.heading')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => { setError(''); setEmail(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Mật khẩu (tối thiểu 6 ký tự)"
          value={password}
          onChange={(e) => { setError(''); setPassword(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          value={confirm}
          onChange={(e) => { setError(''); setConfirm(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />

        <div className="flex justify-center pt-1">
          <JigsawSliderCaptcha
            key={captchaKey}
            onVerify={() => setCaptchaVerified(true)}
            label={t('bugReport.captchaLabel')}
            verifiedLabel={t('bugReport.captchaVerifiedLabel')}
            refreshLabel={t('bugReport.captchaRefreshLabel')}
          />
        </div>

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
          {loading ? t('signup.loading') : t('signup.submit')}
        </button>
      </form>

      <div className="border-t border-zinc-100 pt-4 text-center text-sm text-zinc-500">
        Đã có tài khoản?{' '}
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-emerald-600 hover:underline"
        >
          {t('signup.backToLogin')}
        </button>
      </div>
    </div>
  )
}

// ── Forgot password ───────────────────────────────────────────

function ForgotPasswordStep({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('signup.errorEmail'))
      return
    }
    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (resetError) {
      setError(t('forgotPassword.error'))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-zinc-900">{t('forgotPassword.success')}</p>
          <p className="mt-1 text-sm text-zinc-500">{email}</p>
        </div>
        <button type="button" onClick={onBack} className="text-sm font-medium text-emerald-600 hover:underline">
          ← {t('forgotPassword.backToLogin')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('forgotPassword.heading')}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t('forgotPassword.description')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => { setError(''); setEmail(e.target.value) }}
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
          {loading ? t('forgotPassword.loading') : t('forgotPassword.submit')}
        </button>
      </form>

      <div className="text-center">
        <button type="button" onClick={onBack} className="text-sm font-medium text-zinc-500 hover:underline">
          ← {t('forgotPassword.backToLogin')}
        </button>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────

export default function LoginForm() {
  const searchParams = useSearchParams()
  const redirect = safeNextPath(searchParams.get('redirect'))
  const [step, setStep] = useState<'oauth' | 'email' | 'signup' | 'forgot'>('oauth')
  const [signupKey, setSignupKey] = useState(0)

  const goSignup = () => { setSignupKey(k => k + 1); setStep('signup') }
  const goOAuth = () => setStep('oauth')
  const goEmail = () => setStep('email')

  if (step === 'email') {
    return <EmailLoginStep redirect={redirect} onBack={goOAuth} onSignup={goSignup} onForgot={() => setStep('forgot')} />
  }
  if (step === 'signup') {
    return <SignupStep key={signupKey} onBack={goOAuth} />
  }
  if (step === 'forgot') {
    return <ForgotPasswordStep onBack={goEmail} />
  }

  return <OAuthStep redirect={redirect} onSignup={goSignup} onEmailLogin={goEmail} onForgot={() => setStep('forgot')} />
}
