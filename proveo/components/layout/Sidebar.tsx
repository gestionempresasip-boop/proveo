'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ProfileWithOrg } from '@/types/database'
import {
  ShoppingCart, Package, ClipboardList,
  FileText, Settings, LogOut,
  ChefHat, Menu, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: string[]
  orgTypes?: string[]
}

const navItems: NavItem[] = [
  { href: '/catalogo',        label: 'Hacer Pedido',      icon: <ShoppingCart className="h-4.5 w-4.5" />, orgTypes: ['restaurante'] },
  { href: '/pedidos',         label: 'Mis Pedidos',       icon: <ClipboardList className="h-4.5 w-4.5" />, orgTypes: ['restaurante'] },
  { href: '/pedidos',         label: 'Pedidos',           icon: <ClipboardList className="h-4.5 w-4.5" />, orgTypes: ['nave'] },
  { href: '/albaranes',       label: 'Albaranes',         icon: <FileText className="h-4.5 w-4.5" /> },
  { href: '/admin/productos', label: 'Productos',         icon: <Package className="h-4.5 w-4.5" />, roles: ['admin', 'nave_manager'] },
  { href: '/admin/usuarios',  label: 'Usuarios',          icon: <Settings className="h-4.5 w-4.5" />, roles: ['admin'] },
]

export function Sidebar({ profile }: { profile: ProfileWithOrg }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const visibleItems = navItems.filter(item => {
    if (item.roles && !item.roles.includes(profile.role)) return false
    if (item.orgTypes && !item.orgTypes.includes(profile.organizations.type)) return false
    return true
  })

  const isNave = profile.organizations.type === 'nave'
  const orgLabel = isNave ? 'Nave Obrador' : profile.organizations.name

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {visibleItems.map(item => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/8'
            )}
          >
            <span className={cn('shrink-0', isActive ? 'text-amber-500' : '')}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {isActive && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </Link>
        )
      })}
    </nav>
  )

  const logoBlock = (
    <div className="px-4 py-5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center shrink-0">
        <ChefHat className="h-4 w-4 text-white" />
      </div>
      <div>
        <span className="text-white font-bold text-base tracking-tight">Proveo</span>
        <p className="text-gray-500 text-xs truncate">{orgLabel}</p>
      </div>
    </div>
  )

  const userBlock = (
    <div className="px-4 py-3 mx-3 mb-2 rounded-lg bg-white/5">
      <p className="text-white text-sm font-medium truncate leading-tight">
        {profile.full_name ?? 'Usuario'}
      </p>
      <p className="text-gray-500 text-xs mt-0.5 capitalize">
        {profile.role.replace('_', ' ')}
      </p>
    </div>
  )

  const logoutBtn = (onNavigate?: () => void) => (
    <div className="px-3 pb-4">
      <button
        onClick={() => { onNavigate?.(); handleLogout() }}
        className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-white/5 transition-all"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>Cerrar sesión</span>
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 h-13 flex items-center px-4 gap-3 border-b border-white/8">
        <button onClick={() => setDrawerOpen(true)} className="text-gray-400 hover:text-white p-1 -ml-1">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-400 flex items-center justify-center">
            <ChefHat className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Proveo</span>
        </div>
        <span className="text-gray-500 text-xs truncate flex-1 text-right">{orgLabel}</span>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="relative w-64 bg-gray-900 flex flex-col h-full shadow-2xl border-r border-white/8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pr-3">
              {logoBlock}
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-t border-white/8 pt-3">{userBlock}</div>
            {navLinks(() => setDrawerOpen(false))}
            <div className="border-t border-white/8">{logoutBtn(() => setDrawerOpen(false))}</div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 min-h-screen bg-gray-900 flex-col border-r border-white/8 shrink-0">
        {logoBlock}
        <div className="border-t border-white/8 pt-3">{userBlock}</div>
        {navLinks()}
        <div className="border-t border-white/8">{logoutBtn()}</div>
      </aside>
    </>
  )
}
