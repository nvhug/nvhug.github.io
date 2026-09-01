import type { Metadata } from 'next'
import LandingClient from './LandingClient'

// The public landing page (feature 012). The dashboard that used to render here
// lives at /notes; a visitor who already has a session is redirected there by
// proxy.ts before this renders.
export const metadata: Metadata = {
  title: 'Notez — Lưu lại mọi thứ về bạn, trong một không gian của riêng bạn',
  description:
    'Ghi chú mỗi ngày, thói quen, calo và bữa ăn đọc từ ảnh, buổi tập và cân nặng, lá số tử vi, tài sản và đầu tư — tất cả trong một không gian chỉ mình bạn đọc được. Miễn phí toàn bộ, không có gói nào để bán.',
  openGraph: {
    title: 'Notez — Lưu lại mọi thứ về bạn, trong một không gian của riêng bạn',
    description:
      'Ghi chú, thói quen, calo, sức khoẻ, lá số và tài sản trong một chỗ — chỉ mình bạn đọc được. Miễn phí toàn bộ.',
    type: 'website',
  },
}

export default function Home() {
  return <LandingClient />
}
