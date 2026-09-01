'use client'

import { useLanguage } from '@/lib/i18n/language-context'
import { DASHBOARD_PATH } from '@/lib/permissions'
import { useOAuthSignIn } from '@/hooks/useOAuthSignIn'
import { GoogleIcon, FacebookIcon } from '@/components/icons/OAuthIcons'

/**
 * The landing page's only interactive controls.
 *
 * Same providers, same handler shape and same labels as `app/login/LoginForm.tsx`
 * — one action keeps one name through the whole flow. `next` is passed
 * explicitly rather than relying on the callback's default, so this CTA cannot be
 * broken by a change to that default.
 */
export function SignInButtons({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const { t } = useLanguage()
  // Rendered next to the buttons, not as a toast: someone who bounced off the
  // provider may not have this tab focused, and a faded toast explains nothing —
  // the same reasoning app/login/LoginForm.tsx's OAuthStep already applies.
  const { loading, error, signInWith } = useOAuthSignIn(DASHBOARD_PATH)

  // Both sizes clear a 44px tap target on the small end (FR-017 / DESIGN.md mobile).
  const pad = size === 'lg' ? 'px-5 py-3.5 text-[15px]' : 'px-4 py-3 text-sm'

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 font-tuvi-sans text-sm text-[#EAF2EC]">
          {t('login.oauthError')}
        </p>
      )}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {(['google', 'facebook'] as const).map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => signInWith(provider)}
            disabled={loading !== null}
            className={
              // Emerald fill with near-black text: 6.7:1, which only works because the
              // ground is dark (DESIGN.md rev 2 Tokens). Facebook takes the same shape
              // in Raise so there is one primary action, not two competing ones.
              `inline-flex items-center justify-center gap-2.5 rounded-xl font-tuvi-sans font-medium transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34D399] disabled:opacity-60 ${pad} ${
                provider === 'google'
                  ? 'bg-[#10B981] text-[#062015]'
                  : 'border border-[#2A382E] bg-[#0F1712] text-[#EAF2EC]'
              }`
            }
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white">
              {provider === 'google' ? <GoogleIcon className="h-4 w-4" /> : <FacebookIcon className="h-4 w-4" />}
            </span>
            {loading === provider
              ? t('login.redirecting')
              : t(provider === 'google' ? 'login.continueWithGoogle' : 'login.continueWithFacebook')}
          </button>
        ))}
      </div>
    </div>
  )
}
