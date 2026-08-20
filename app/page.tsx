import type { Metadata } from 'next'
import NotesPage from './notes/page'

export const metadata: Metadata = {
  title: 'Notes',
  description: 'Không gian ghi chú, công việc, mục tiêu và theo dõi cá nhân.',
}

export default function Home() {
  return <NotesPage />
}
