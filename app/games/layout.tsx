import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Games',
  description: 'Small logic games to play in a spare minute — starting with the wooden block puzzle.',
}

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children
}
