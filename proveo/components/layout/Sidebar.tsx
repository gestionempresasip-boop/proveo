'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ProfileWithOrg } from '@/types/database'
import {
  ShoppingCart, Package, ClipboardList,
  FileText, Settings, LogOut, ChefHat, RefreshCw, BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: string[]
  orgTypes?: string[]
}

const ORG_LOGOS: Record<string, string> = {
  'Nave Obrador Central': '/logos/depot.png',
  'Barranco Playa': '/logos/barranco.png',
  'Va Bene Cala': '/logos/va-bene-cala.png',
  'Va Bene Centro': '/logos/va-bene-centro.png',
  'Aruba': '/logos/aruba.png',
  'Conbrassa': '/logos/conbrassa.png',
  'Season': '/logos/season.png',
}

const navItems: NavItem[] = [
  { href: '/catalogo',        label: 'Pedido',      icon: ShoppingCart,  orgTypes: ['restaurante'] },
  { href: '/pedidos',         label: 'Mis pedidos', icon: ClipboardList, orgTypes: ['restaurante'] },
  { href: '/pedidos',         label: 'Pedidos',     icon: ClipboardList, orgTypes: ['nave'] },
  { href: '/albaranes',       label: 'Albaranes',   icon: FileText },
  { href: '/estadisticas',    label: 'Informes',    icon: BarChart3,     orgTypes: ['nave'] },
  { href: '/admin/productos', label: 'Productos',   icon: Package,       roles: ['admin', 'nave_manager'] },
  { href: '/admin/usuarios',  label: 'Usuarios',    icon: Settings,      roles: ['admin'] },
]

export function Sidebar({ profile }: { profile: ProfileWithOrg }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [refreshing, setRefreshing] = useState(false)

  const visible = navItems.filter(item => {
    if (item.roles && !item.roles.includes(profile.role)) return false
    if (item.orgTypes && !item.orgTypes.includes(profile.organizations.type)) return false
    return true
  })

  const isNave = profile.organizations.type === 'nave'
  const orgLabel = isNave ? 'Nave Obrador' : profile.organizations.name
  const orgLogo = ORG_LOGOS[profile.organizations.name]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  function handleRefresh() {
    setRefreshing(true)
    window.location.reload()
  }

  // ── Desktop sidebar (lg+) ────────────────────────────────────────────────
  return (
    <>
      <aside className="hidden lg:flex w-56 min-h-screen bg-[#1E2B28] flex-col border-r border-white/8 shrink-0 print:hidden">
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden">
            {orgLogo ? (
              <div className="relative w-full h-full p-1">
                <Image src={orgLogo} alt={orgLabel} fill className="object-contain" />
              </div>
            ) : (
              <ChefHat className="h-4 w-4 text-gray-900" />
            )}
          </div>
          <div>
            <span className="text-white font-bold text-base tracking-tight">Proveo</span>
            <p className="text-gray-500 text-xs truncate">{orgLabel}</p>
          </div>
        </div>

        {/* User */}
        <div className="mx-3 mb-2 px-3 py-2.5 rounded-lg bg-white/5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">{profile.full_name ?? 'Usuario'}</p>
            <p className="text-gray-500 text-xs mt-0.5 capitalize">{profile.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar datos"
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {visible.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/8'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-[#A8793A]')} />
                <span>{item.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A8793A]" />}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4 border-t border-white/8 pt-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-white/5 transition-all"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Tablet / Mobile: top header + bottom tab bar ────────────────── */}
      <>
        {/* Top header strip (brand + org) */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#1E2B28] h-12 flex items-center justify-between px-4 border-b border-white/8 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden">
              {orgLogo ? (
                <div className="relative w-full h-full p-0.5">
                  <Image src={orgLogo} alt={orgLabel} fill className="object-contain" />
                </div>
              ) : (
                <ChefHat className="h-3.5 w-3.5 text-gray-900" />
              )}
            </div>
            <span className="text-white font-bold text-sm tracking-tight">Proveo</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{orgLabel}</span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-gray-500 hover:text-white transition-colors p-1 disabled:opacity-50"
              title="Actualizar datos"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 transition-colors p-1"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex print:hidden">
          {visible.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors min-h-[60px]',
                  active ? 'text-[#A8793A]' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </>
    </>
  )
}
