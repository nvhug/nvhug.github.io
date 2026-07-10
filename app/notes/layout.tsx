import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notes',
  description: 'Track your good and bad habits with daily personal notes.',
}

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return children
}
