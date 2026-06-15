'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ProfileWithOrg } from '@/types/database'
import {
  ShoppingCart, Package, ClipboardList, BookOpen,
  FileText, BarChart3, Settings, LogOut, Warehouse, ChefHat
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
  {
    href: '/dashboard',
    label: 'Inicio',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    href: '/catalogo',
    label: 'Hacer Pedido',
    icon: <ShoppingCart className="h-5 w-5" />,
    orgTypes: ['restaurante'],
  },
  {
    href: '/pedidos',
    label: 'Mis Pedidos',
    icon: <ClipboardList className="h-5 w-5" />,
    orgTypes: ['restaurante'],
  },
  {
    href: '/pedidos',
    label: 'Pedidos Entrantes',
    icon: <ClipboardList className="h-5 w-5" />,
    orgTypes: ['nave'],
  },
  {
    href: '/inventario',
    label: 'Inventario',
    icon: <Warehouse className="h-5 w-5" />,
  },
  {
    href: '/escandallos',
    label: 'Escandallos',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    href: '/albaranes',
    label: 'Albaranes',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    href: '/estadisticas',
    label: 'Estadísticas',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['admin', 'nave_manager'],
  },
  {
    href: '/admin/productos',
    label: 'Gestión Productos',
    icon: <Package className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    href: '/admin/usuarios',
    label: 'Usuarios',
    icon: <Settings className="h-5 w-5" />,
    roles: ['admin'],
  },
]

interface SidebarProps {
  profile: ProfileWithOrg
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const visibleItems = navItems.filter(item => {
    if (item.roles && !item.roles.includes(profile.role)) return false
    if (item.orgTypes && !item.orgTypes.includes(profile.organizations.type)) return false
    return true
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isNave = profile.organizations.type === 'nave'

  return (
    <aside className="w-64 min-h-screen bg-[#1B4332] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[#2d6a4f]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F59E0B] flex items-center justify-center">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Proveo</h1>
            <p className="text-[#74c69d] text-xs mt-0.5">
              {isNave ? 'Nave Obrador' : profile.organizations.name}
            </p>
          </div>
        </div>
      </div>

      {/* Usuario */}
      <div className="px-4 py-3 border-b border-[#2d6a4f]">
        <p className="text-[#95d5b2] text-xs uppercase tracking-wider font-medium mb-1">Usuario</p>
        <p className="text-white text-sm font-medium truncate">{profile.full_name ?? 'Sin nombre'}</p>
        <span className="inline-block text-xs bg-[#2d6a4f] text-[#95d5b2] px-2 py-0.5 rounded-full mt-1 capitalize">
          {profile.role.replace('_', ' ')}
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-3 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-[#F59E0B] text-white'
                  : 'text-[#95d5b2] hover:bg-[#2d6a4f] hover:text-white'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[#2d6a4f]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#95d5b2] hover:bg-red-900/30 hover:text-red-300 transition-all w-full"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
