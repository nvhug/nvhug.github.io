// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { BookOpen, Gamepad2, NotebookPen, Quote } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { AccountMenu } from './RootLayoutClient'

vi.mock('@/lib/i18n/language-context', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/components/LanguageSwitch', () => ({
  LanguageSwitch: () => <div data-testid="language-switch">language-switch</div>,
}))

describe('AccountMenu', () => {
  it('keeps a language switch accessible from the account menu', () => {
    render(
      <AccountMenu
        user={{
          id: 'user-1',
          app_metadata: {},
          user_metadata: { full_name: 'Test User' },
          aud: 'authenticated',
          created_at: '2026-08-15T00:00:00.000Z',
          email: 'test@example.com',
        } as never}
        onLogout={() => undefined}
        navItems={[
          { href: '/notes', label: 'Notes', icon: NotebookPen },
          { href: '/blog', label: 'Blog', icon: BookOpen },
          { href: '/quotes', label: 'Quotes', icon: Quote },
          { href: '/games', label: 'Games', icon: Gamepad2 },
        ]}
        pathname="/notes"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'header.accountLabel' }))

    expect(screen.getByTestId('language-switch')).toBeTruthy()
  })
})