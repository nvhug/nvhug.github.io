'use client'

import * as React from 'react'
import {
  BarChart3,
  ArrowUpRight,
  ChevronDown,
  FileText,
  LayoutTemplate,
  LogOut,
  Settings,
  Shield,
  Tag,
  User,
  Users,
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUserRole } from '@/lib/useUserRole'

export function AdminSidebar() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const { role } = useUserRole()

  const menuItems = [
    {
      title: t('admin.sidebar.postsTitle'),
      description: t('admin.sidebar.postsDesc'),
      icon: FileText,
      href: '/admin',
    },
    {
      title: t('admin.sidebar.tagsTitle'),
      description: t('admin.sidebar.tagsDesc'),
      icon: Tag,
      href: '/admin/tags',
    },
    {
      title: t('admin.sidebar.templatesTitle'),
      description: t('admin.sidebar.templatesDesc'),
      icon: LayoutTemplate,
      href: '/admin/templates',
    },
  ]

  const settingsSubItems = [
    { title: t('admin.settings.usersTab'), href: '/admin/settings', icon: Users },
    { title: t('admin.settings.pagesTab'), href: '/admin/settings/pages', icon: Shield },
    { title: t('admin.settings.nutritionTab'), href: '/admin/settings/nutrition-qa', icon: BarChart3 },
  ]
  const isSettingsActive = pathname.startsWith('/admin/settings')

  const activeHref = [...menuItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))?.href

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-emerald-100 bg-white/90 backdrop-blur">
      <SidebarHeader className="border-b border-emerald-100 px-4 py-3">
        <Link href="/" className="group inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-emerald-600">
          <ArrowUpRight className="h-3.5 w-3.5 rotate-225" />
          {t('header.navHome')}
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <SidebarMenu className="gap-1.5">
          {menuItems.map((item) => {
            const isActive = item.href === activeHref
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
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
              </SidebarMenuItem>
            )
          })}

          {role === 'admin' && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className={`h-auto min-h-12 rounded-xl px-3 py-2.5 transition-colors ${
                  isSettingsActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Settings className={`h-4 w-4 shrink-0 ${isSettingsActive ? 'text-emerald-600' : ''}`} />
                <span className={`text-sm font-semibold leading-tight ${isSettingsActive ? 'text-emerald-800' : ''}`}>
                  {t('admin.sidebar.settingsTitle')}
                </span>
                <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 opacity-40 transition-transform duration-200 ${isSettingsActive ? 'rotate-180' : ''}`} />
              </SidebarMenuButton>
              <SidebarMenuSub className="ml-5 mr-1 mt-1 translate-x-0 gap-0.5 rounded-xl border border-zinc-100 bg-white p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
                {settingsSubItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <SidebarMenuSubItem key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.75 text-[13px] transition-all duration-150 ${
                          isActive
                            ? 'border-l-2 border-emerald-500 bg-emerald-50 pl-2.5 font-semibold text-emerald-700'
                            : 'font-medium text-zinc-500 hover:translate-x-0.5 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-zinc-400'}`} />
                        {item.title}
                      </Link>
                    </SidebarMenuSubItem>
                  )
                })}
              </SidebarMenuSub>
            </SidebarMenuItem>
          )}
        </SidebarMenu>

      </SidebarContent>

    </Sidebar>
  )
}

export function AdminTopBar() {
  const { t } = useLanguage()

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
            <h1 className="font-poppins text-lg font-semibold leading-tight text-zinc-900 md:text-xl">{t('header.admin')}</h1>
            <p className="text-xs text-zinc-500">{t('admin.topbar.subtitle')}</p>
          </div>
        </div>

        <div className="hidden rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 md:block">
          {t('admin.topbar.liveEditing')}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitch />

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50 hover:text-zinc-900">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-r from-emerald-500 to-emerald-600 text-white">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden md:inline">{t('header.accountLabel')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border border-emerald-100 bg-white text-zinc-900">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                {t('header.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
