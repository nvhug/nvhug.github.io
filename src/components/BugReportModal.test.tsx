// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BugReportModal } from './BugReportModal'

vi.mock('@/lib/i18n/language-context', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowserClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  }),
}))

vi.mock('@/components/JigsawSliderCaptcha', () => ({
  JigsawSliderCaptcha: () => <div data-testid="captcha" />,
}))

describe('BugReportModal', () => {
  it('renders nothing until the footer menu opens it', () => {
    const { container } = render(<BugReportModal open={false} onClose={() => undefined} />)

    expect(container.innerHTML).toBe('')
  })

  it('renders the report form when open', () => {
    render(<BugReportModal open onClose={() => undefined} />)

    expect(screen.getByText('bugReport.modalTitle')).toBeTruthy()
    expect(screen.getByTestId('captcha')).toBeTruthy()
  })
})
