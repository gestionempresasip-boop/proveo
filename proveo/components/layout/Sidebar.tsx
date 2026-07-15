'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ProfileWithOrg } from '@/types/database'
import {
  ShoppingCart, Package, ClipboardList,
  FileText, Settings, LogOut, ChefHat, RefreshCw, BarChart3, Boxes, Tag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ORG_LOGOS } from '@/lib/orgLogos'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: string[]
  orgTypes?: string[]
}

const navItems: NavItem[] = [
  { href: '/catalogo',        label: 'Pedido',      icon: ShoppingCart,  orgTypes: ['restaurante'] },
  { href: '/pedidos',         label: 'Mis pedidos', icon: ClipboardList, orgTypes: ['restaurante'] },
  { href: '/pedidos',         label: 'Pedidos',     icon: ClipboardList, orgTypes: ['nave'] },
  { href: '/promociones',     label: 'Promociones', icon: Tag,           orgTypes: ['nave'] },
  { href: '/inventario',      label: 'Stock',       icon: Boxes,         orgTypes: ['nave'] },
  { href: '/albaranes',       label: 'Albaranes',   icon: FileText },
  { href: '/estadisticas',    label: 'Informes',    icon: BarChart3,     orgTypes: ['nave'] },
  { href: '/admin/productos', label: 'Productos',   icon: Package,       roles: ['admin', 'nave_manager'] },
  { href: '/admin/usuarios',  label: 'Usuarios',    icon: Settings,      roles: ['admin', 'nave_manager'] },
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

  // ── Desktop/tablet sidebar (md+) ────────────────────────────────────────────────
  return (
    <>
      <aside className="hidden md:flex w-56 self-start sticky top-0 h-dvh overflow-y-auto bg-[#1E2B28] flex-col border-r border-white/8 shrink-0 print:hidden">
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
          <div className="flex-1 min-w-0">
            <span className="text-white font-bold text-base tracking-tight">Proveo</span>
            <p className="text-gray-700 text-xs truncate">{orgLabel}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-white/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* User */}
        <div className="mx-3 mb-2 px-3 py-2.5 rounded-lg bg-white/5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">{profile.full_name ?? 'Usuario'}</p>
            <p className="text-gray-700 text-xs mt-0.5 capitalize">{profile.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar datos"
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
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
                  active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-white hover:bg-white/8'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-[#A8793A]')} />
                <span>{item.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A8793A]" />}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* ── Mobile: bottom tab bar (la barra superior vive en MobileTopBar,
           dentro del scroll, para que se desplace al deslizar) ─────────── */}
      <>
        {/* Bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex print:hidden">
          {visible.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors min-h-[60px]',
                  active ? 'text-[#A8793A]' : 'text-gray-600 hover:text-gray-600'
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
