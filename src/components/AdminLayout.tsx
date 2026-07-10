'use client'

import * as React from 'react'
import {
  ArrowUpRight,
  FileText,
  Home,
  LogOut,
  Settings,
  Tag,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuBadge,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const menuItems = [
  {
    title: 'Posts',
    description: 'Manage articles',
    icon: FileText,
    href: '/admin',
  },
  {
    title: 'Tags',
    description: 'Organize topics',
    icon: Tag,
    href: '/admin/tags',
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  const activeHref = [...menuItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))?.href

  return (
    <Sidebar collapsible="none" className="border-r border-emerald-100 bg-white/90 backdrop-blur">
      <SidebarHeader className="border-b border-emerald-100 px-5 py-5">
        <Link href="/" className="group flex items-center justify-between rounded-xl border border-emerald-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] px-3 py-2.5 shadow-[0_10px_25px_-18px_rgba(16,185,129,0.6)] transition-colors hover:bg-emerald-50">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Control Panel</p>
            <p className="font-poppins text-lg font-semibold leading-tight text-zinc-900">nvhug Admin</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-emerald-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <SidebarMenu className="gap-1.5">
          {menuItems.map((item) => {
            const isActive = item.href === activeHref
            return (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={isActive}
                    className={`h-auto min-h-12 rounded-xl px-3 py-2.5 transition-all ${
                      isActive
                        ? 'bg-linear-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_12px_24px_-16px_rgba(16,185,129,0.9)] hover:from-emerald-500 hover:to-emerald-600'
                        : 'text-zinc-700 hover:bg-emerald-50 hover:text-zinc-900'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold leading-tight">{item.title}</span>
                        <span className={`block truncate text-xs ${isActive ? 'text-emerald-100' : 'text-zinc-500'}`}>
                          {item.description}
                        </span>
                      </span>
                    </span>
                    <SidebarMenuBadge
                      className={isActive ? 'text-emerald-100' : 'text-zinc-500'}
                    >
                      {isActive ? 'Now' : ''}
                    </SidebarMenuBadge>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 shadow-[0_10px_25px_-18px_rgba(16,185,129,0.55)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Quick Links</p>
          <div className="mt-2.5 grid gap-1.5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-100 hover:text-zinc-900"
            >
              <Home className="h-4 w-4" />
              Public site
            </Link>
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-100 hover:text-zinc-900"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-emerald-100 px-5 py-4">
        <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_10px_25px_-18px_rgba(16,185,129,0.45)]">
          <p className="text-xs font-medium text-zinc-500">Workspace</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-900">Editorial Console</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export function AdminTopBar() {
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="sticky top-0 z-20 border-b border-emerald-100 bg-white/85 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="rounded-lg border border-emerald-200 bg-white text-zinc-700 hover:bg-emerald-50 hover:text-zinc-900" />
          <div>
            <h1 className="font-poppins text-lg font-semibold leading-tight text-zinc-900 md:text-xl">Admin</h1>
            <p className="text-xs text-zinc-500">Content publishing workspace</p>
          </div>
        </div>

        <div className="hidden rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 md:block">
          Live editing enabled
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50 hover:text-zinc-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-r from-emerald-500 to-emerald-600 text-white">
              <User className="h-4 w-4" />
            </span>
            <span className="hidden md:inline">Account</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border border-emerald-100 bg-white text-zinc-900">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href="/admin/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
