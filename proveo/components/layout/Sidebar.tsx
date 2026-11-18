'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ProfileWithOrg } from '@/types/database'
import {
  ShoppingCart, Package, ClipboardList,
  FileText, Settings, LogOut, ChefHat, RefreshCw, BarChart3, Boxes, Tag, Calculator, Timer, Store, FolderLock, ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ORG_LOGOS } from '@/lib/orgLogos'
import { loginPathFor } from '@/lib/loginPath'
import { NotificationBell } from '@/components/notifications/NotificationProvider'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: string[]
  orgTypes?: string[]
  desktopOnly?: boolean
  hidden?: boolean
}

// Pestañas que van dentro de la carpeta «Nina» (no se ven sueltas en el menú). Cada una conserva su propia clave.
const NINA_FOLDER = new Set(['Costes', 'Informes'])

type Entry =
  | { kind: 'link'; label: string; item: NavItem }
  | { kind: 'folder'; label: string; children: NavItem[] }

// Pestañas de la nave marcadas en verde fosforescente
const HIGHLIGHT = new Set(['Pedidos', 'Productos', 'Stock', 'Albaranes'])

const navItems: NavItem[] = [
  { href: '/catalogo',        label: 'Pedido',      icon: ShoppingCart,  orgTypes: ['restaurante'] },
  { href: '/pedidos',         label: 'Mis pedidos', icon: ClipboardList, orgTypes: ['restaurante'] },
  { href: '/pedidos',         label: 'Pedidos',     icon: ClipboardList, orgTypes: ['nave'] },
  { href: '/promociones',     label: 'Promociones', icon: Tag,           orgTypes: ['nave'] },
  { href: '/inventario',      label: 'Stock',       icon: Boxes,         orgTypes: ['nave'] },
  { href: '/albaranes',       label: 'Albaranes',   icon: FileText },
  // Producción: oculta de momento. Para volver a mostrarla, quitar «hidden: true».
  { href: '/produccion',      label: 'Producción',  icon: Timer,         orgTypes: ['nave'], hidden: true },
  { href: '/costes',          label: 'Costes',      icon: Calculator,    roles: ['admin', 'nave_manager'], orgTypes: ['nave'] },
  { href: '/estadisticas',    label: 'Informes',    icon: BarChart3,     orgTypes: ['nave'] },
  { href: '/admin/productos', label: 'Productos',   icon: Package,       roles: ['admin', 'nave_manager'] },
  { href: '/admin/clientes',  label: 'Clientes',    icon: Store,         roles: ['admin', 'nave_manager'], orgTypes: ['nave'] },
  { href: '/admin/usuarios',  label: 'Usuarios',    icon: Settings,      roles: ['admin', 'nave_manager'] },
]

export function Sidebar({ profile }: { profile: ProfileWithOrg }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [refreshing, setRefreshing] = useState(false)
  const [ninaOpen, setNinaOpen] = useState(false)          // carpeta Nina en el menú lateral
  const [ninaSheet, setNinaSheet] = useState(false)        // carpeta Nina en el móvil

  const isNave = profile.organizations.type === 'nave'

  const visible = navItems.filter(item => {
    if (item.hidden) return false
    if (item.roles && !item.roles.includes(profile.role)) return false
    if (item.orgTypes && !item.orgTypes.includes(profile.organizations.type)) return false
    return true
  })

  // La nave tiene muchas más secciones y todas se usan a diario, así que el
  // orden alfabético hace más rápido encontrarlas. Los restaurantes
  // conservan el orden del flujo de trabajo (Pedido → Mis pedidos → ...).
  if (isNave) {
    visible.sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }

  // Costes e Informes se agrupan en la carpeta «Nina»; el resto sigue igual
  const folderChildren = visible.filter(i => NINA_FOLDER.has(i.label))
  const entries: Entry[] = [
    ...visible.filter(i => !NINA_FOLDER.has(i.label)).map((item): Entry => ({ kind: 'link', label: item.label, item })),
    ...(folderChildren.length > 0 ? [{ kind: 'folder', label: 'Nina', children: folderChildren } as Entry] : []),
  ]
  if (isNave) entries.sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const orgLabel = isNave ? 'Nave Obrador' : profile.organizations.name
  const orgLogo = ORG_LOGOS[profile.organizations.name]

  // iOS a veces no recoloca la pantalla al cerrar el teclado y la barra inferior se queda a media altura.
  // Al salir de un campo de texto se hace un scroll a la misma posición, que obliga a recolocarla. No mueve la página.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onFocusOut = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        const a = document.activeElement as HTMLElement | null
        if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return
        window.scrollTo(window.scrollX, window.scrollY)
      }, 350)
    }
    document.addEventListener('focusout', onFocusOut)
    return () => { document.removeEventListener('focusout', onFocusOut); clearTimeout(timer) }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push(loginPathFor(profile.organizations))
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const ninaActive = folderChildren.some(c => isActive(c.href))

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
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-red-500 text-white shadow-sm hover:bg-red-600 hover:scale-105 transition-all"
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
          <NotificationBell className="shrink-0 w-8 h-8 bg-white/15 text-white hover:bg-white/25" />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar datos"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#F59E0B] text-white shadow-sm hover:bg-[#D97C09] hover:scale-105 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {entries.map(entry => {
            if (entry.kind === 'folder') {
              const expanded = ninaOpen || ninaActive
              return (
                <div key="folder-nina">
                  <button
                    type="button"
                    onClick={() => setNinaOpen(v => !v)}
                    aria-expanded={expanded}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all text-left',
                      ninaActive ? 'bg-white/15 text-white' : 'text-white hover:bg-white/10'
                    )}
                  >
                    <FolderLock className="h-4 w-4 shrink-0" />
                    <span>{entry.label}</span>
                    <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')} />
                  </button>
                  {expanded && (
                    <div className="mt-0.5 ml-4 pl-2 border-l border-white/15 space-y-0.5">
                      {entry.children.map(child => {
                        const active = isActive(child.href)
                        const ChildIcon = child.icon
                        return (
                          <Link
                            key={child.href + child.label}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all',
                              active ? 'bg-white text-gray-900 shadow-sm' : 'text-white hover:bg-white/10'
                            )}
                          >
                            <ChildIcon className={cn('h-4 w-4 shrink-0', active && 'text-[#A8793A]')} />
                            <span>{child.label}</span>
                            {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A8793A]" />}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
            const item = entry.item
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all',
                  active
                    ? 'bg-white text-gray-900 shadow-sm'
                    : isNave && HIGHLIGHT.has(item.label)
                      ? 'bg-[#F59E0B]/15 text-[#F5B544] ring-1 ring-inset ring-[#F59E0B]/30 hover:bg-[#F59E0B]/25'
                      : 'text-white hover:bg-white/10'
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
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 [transform:translateZ(0)] bg-white border-t border-gray-200 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden">
          {entries.filter(e => e.kind === 'folder' || !e.item.desktopOnly).map(entry => {
            const tabClass = (active: boolean, highlight: boolean) => cn(
              'flex-1 shrink-0 flex flex-col items-center justify-center transition-colors',
              // La nave tiene muchas pestañas: botones más grandes para verlas y pulsarlas mejor en el móvil
              isNave ? 'min-w-[78px] min-h-[72px] gap-1.5 py-3' : 'min-w-[68px] min-h-[60px] gap-1 py-2.5',
              active ? 'text-[#A8793A]' : 'text-gray-600 hover:text-gray-600',
              highlight && !active && 'bg-[#F59E0B]/12 text-[#D97C09]'
            )
            if (entry.kind === 'folder') {
              return (
                <button key="folder-nina" type="button" onClick={() => setNinaSheet(v => !v)} aria-expanded={ninaSheet} className={tabClass(ninaActive || ninaSheet, false)}>
                  <FolderLock className={cn('shrink-0', isNave ? 'h-6 w-6' : 'h-5 w-5')} />
                  <span className={cn('font-medium leading-none', isNave ? 'text-[11px]' : 'text-[10px]')}>{entry.label}</span>
                </button>
              )
            }
            const item = entry.item
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href + item.label} href={item.href} className={tabClass(active, isNave && HIGHLIGHT.has(item.label))}>
                <Icon className={cn('shrink-0', isNave ? 'h-6 w-6' : 'h-5 w-5')} />
                <span className={cn('font-medium leading-none', isNave ? 'text-[11px]' : 'text-[10px]')}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        {ninaSheet && folderChildren.length > 0 && (
          <>
            <div className="md:hidden fixed inset-0 z-30 print:hidden" onClick={() => setNinaSheet(false)} />
            <div className="md:hidden fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 w-52 rounded-xl bg-white border border-gray-200 shadow-lg p-1.5 print:hidden">
              {folderChildren.map(child => {
                const active = isActive(child.href)
                const ChildIcon = child.icon
                return (
                  <Link
                    key={child.href + child.label}
                    href={child.href}
                    onClick={() => setNinaSheet(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold',
                      active ? 'bg-[#1E2B28] text-white' : 'text-gray-900 hover:bg-gray-100'
                    )}
                  >
                    <ChildIcon className="h-4 w-4 shrink-0" />
                    <span>{child.label}</span>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </>
    </>
  )
}
