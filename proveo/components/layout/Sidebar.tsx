'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ProfileWithOrg } from '@/types/database'
import {
  ShoppingCart, Package, ClipboardList, BookOpen,
  FileText, BarChart3, Settings, LogOut, Warehouse,
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
  { href: '/dashboard', label: 'Inicio', icon: <BarChart3 className="h-5 w-5" /> },
  { href: '/catalogo', label: 'Hacer Pedido', icon: <ShoppingCart className="h-5 w-5" />, orgTypes: ['restaurante'] },
  { href: '/pedidos', label: 'Mis Pedidos', icon: <ClipboardList className="h-5 w-5" />, orgTypes: ['restaurante'] },
  { href: '/pedidos', label: 'Pedidos Entrantes', icon: <ClipboardList className="h-5 w-5" />, orgTypes: ['nave'] },
  { href: '/inventario', label: 'Inventario', icon: <Warehouse className="h-5 w-5" /> },
  { href: '/escandallos', label: 'Escandallos', icon: <BookOpen className="h-5 w-5" /> },
  { href: '/albaranes', label: 'Albaranes', icon: <FileText className="h-5 w-5" /> },
  { href: '/estadisticas', label: 'Estadísticas', icon: <BarChart3 className="h-5 w-5" />, roles: ['admin', 'nave_manager'] },
  { href: '/admin/productos', label: 'Gestión Productos', icon: <Package className="h-5 w-5" />, roles: ['admin', 'nave_manager'] },
  { href: '/admin/usuarios', label: 'Usuarios', icon: <Settings className="h-5 w-5" />, roles: ['admin'] },
]

interface SidebarProps {
  profile: ProfileWithOrg
}

function NavLinks({
  items,
  pathname,
  onNavigate,
  collapsed = false,
}: {
  items: NavItem[]
  pathname: string
  onNavigate?: () => void
  collapsed?: boolean
}) {
  return (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              collapsed ? 'justify-center' : '',
              isActive
                ? 'bg-[#F59E0B] text-white'
                : 'text-[#95d5b2] hover:bg-[#2d6a4f] hover:text-white'
            )}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar({ profile }: SidebarProps) {
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const orgLabel = isNave ? 'Nave Obrador' : profile.organizations.name

  // ── Shared header block ─────────────────────────────────────────────────
  const logoBlock = (
    <div className="p-4 border-b border-[#2d6a4f] flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#F59E0B] flex items-center justify-center shrink-0">
        <ChefHat className="h-5 w-5 text-white" />
      </div>
      <div className="overflow-hidden">
        <h1 className="text-white font-bold text-lg leading-none">Proveo</h1>
        <p className="text-[#74c69d] text-xs mt-0.5 truncate">{orgLabel}</p>
      </div>
    </div>
  )

  const userBlock = (
    <div className="px-4 py-3 border-b border-[#2d6a4f]">
      <p className="text-[#95d5b2] text-xs uppercase tracking-wider font-medium mb-1">Usuario</p>
      <p className="text-white text-sm font-medium truncate">{profile.full_name ?? 'Sin nombre'}</p>
      <span className="inline-block text-xs bg-[#2d6a4f] text-[#95d5b2] px-2 py-0.5 rounded-full mt-1 capitalize">
        {profile.role.replace('_', ' ')}
      </span>
    </div>
  )

  const logoutBtn = (label = true) => (
    <div className="p-3 border-t border-[#2d6a4f]">
      <button
        onClick={handleLogout}
        title={!label ? 'Cerrar sesión' : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#95d5b2] hover:bg-red-900/30 hover:text-red-300 transition-all w-full',
          !label && 'justify-center'
        )}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        {label && <span>Cerrar sesión</span>}
      </button>
    </div>
  )

  return (
    <>
      {/* ── MOBILE + TABLET: top bar (<lg) ──────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#1B4332] h-14 flex items-center px-4 gap-3 border-b border-[#2d6a4f]">
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-[#95d5b2] hover:text-white p-1 -ml-1"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#F59E0B] flex items-center justify-center">
            <ChefHat className="h-4 w-4 text-white" />
          </div>
          <span className="text-white font-bold text-base">Proveo</span>
        </div>
        <span className="text-[#74c69d] text-xs truncate flex-1 text-right">{orgLabel}</span>
      </header>

      {/* ── MOBILE: drawer overlay ───────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={() => setDrawerOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />
          {/* Drawer */}
          <aside
            className="relative w-72 max-w-[85vw] bg-[#1B4332] flex flex-col h-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#2d6a4f]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F59E0B] flex items-center justify-center">
                  <ChefHat className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg leading-none">Proveo</h1>
                  <p className="text-[#74c69d] text-xs mt-0.5">{orgLabel}</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-[#95d5b2] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {userBlock}
            <NavLinks items={visibleItems} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            {logoutBtn(true)}
          </aside>
        </div>
      )}

      {/* ── DESKTOP only: full sidebar (lg+) ────────────────────────── */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-[#1B4332] flex-col shrink-0">
        {logoBlock}
        {userBlock}
        <NavLinks items={visibleItems} pathname={pathname} />
        {logoutBtn(true)}
      </aside>
    </>
  )
}
