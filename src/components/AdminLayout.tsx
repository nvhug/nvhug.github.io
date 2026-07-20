'use client'

import * as React from 'react'
import {
  ArrowUpRight,
  FileText,
  LayoutTemplate,
  LogOut,
  Tag,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  {
    title: 'Templates',
    description: 'Appearance & layout',
    icon: LayoutTemplate,
    href: '/admin/templates',
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  const activeHref = [...menuItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))?.href

  return (
    <Sidebar collapsible="none" className="border-r border-emerald-100 bg-white/90 backdrop-blur">
      <SidebarHeader className="border-b border-emerald-100 px-4 py-3">
        <Link href="/" className="group inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-emerald-600">
          <ArrowUpRight className="h-3.5 w-3.5 rotate-225" />
          Home
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
                    className={`h-auto min-h-12 rounded-xl px-3 py-2.5 transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : ''}`} />
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-semibold leading-tight ${isActive ? 'text-emerald-800' : ''}`}>{item.title}</span>
                      <span className={`block truncate text-xs ${isActive ? 'text-emerald-500' : 'text-zinc-400'}`}>
                        {item.description}
                      </span>
                    </span>
                    {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

      </SidebarContent>

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
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
