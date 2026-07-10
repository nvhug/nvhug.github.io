'use client'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AdminSidebar, AdminTopBar } from '@/components/AdminLayout'

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider id="admin-root" className="min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(52,211,153,0.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] text-zinc-900">
      <AdminSidebar />
      <SidebarInset>
        <AdminTopBar />
        <div className="px-3 py-4 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
