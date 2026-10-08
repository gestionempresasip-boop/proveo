// Pestañas (áreas) de la nave y permisos por usuario. Pura (sin acceso a datos): se usa en
// el menú, en las páginas, en las acciones del servidor y en la pantalla de entrada.
//
// Cada usuario de la nave tiene una lista de pestañas permitidas (`areas`). Con `areas = null`
// ve TODO: es el acceso de Dirección y el de los usuarios que ya existían. Los restaurantes
// no usan áreas: no cambia nada para ellos.

export const AREAS = ['pedidos', 'precios', 'albaranes', 'promociones', 'stock', 'productos', 'usuarios', 'costes', 'informes', 'produccion'] as const
export type Area = (typeof AREAS)[number]

export const AREA_LABEL: Record<Area, string> = {
  pedidos: 'Pedidos', precios: 'Ver precios e importes', albaranes: 'Albaranes', promociones: 'Promociones', stock: 'Stock',
  productos: 'Productos', usuarios: 'Usuarios', costes: 'Costes', informes: 'Informes', produccion: 'Producción',
}

/** Pestañas del menú que se pueden dar a un usuario, en el orden del menú. «precios» va aparte. */
export const TAB_AREAS: Area[] = ['pedidos', 'albaranes', 'promociones', 'stock', 'produccion', 'costes', 'informes', 'productos', 'usuarios']

/** Cómo se llama en pantalla el acceso sin límite de pestañas (el que ve todo y gestiona los usuarios). */
export const FULL_ACCESS_LABEL = 'Gestión'

type Subject = { areas?: string[] | null; organizations?: { type?: string } | null }

/** ¿Puede este usuario entrar en esta pestaña? Los restaurantes no se ven afectados. */
export function canAccess(profile: Subject, area: Area): boolean {
  if (profile.organizations?.type !== 'nave') return true
  if (!profile.areas) return true
  return profile.areas.includes(area)
}

export const canSeePrices = (profile: Subject) => canAccess(profile, 'precios')

/** Área → ruta del menú. */
export const AREA_HREF: Partial<Record<Area, string>> = {
  pedidos: '/pedidos', albaranes: '/albaranes', promociones: '/promociones', stock: '/inventario',
  productos: '/admin/productos', usuarios: '/admin/usuarios', costes: '/costes', informes: '/estadisticas', produccion: '/produccion',
}

/** Primera pantalla a la que puede ir este usuario (su «inicio»). */
export function homeFor(profile: Subject): string {
  if (profile.organizations?.type !== 'nave' || !profile.areas) return '/dashboard'
  for (const a of TAB_AREAS) {
    if (profile.areas.includes(a) && AREA_HREF[a]) return AREA_HREF[a] as string
  }
  return '/dashboard'
}

/** Quita los importes en euros de un texto de aviso (para usuarios sin permiso de precios). */
export const stripAmounts = (text: string | null | undefined): string | null =>
  text == null ? null : text.replace(/\s*·\s*[\d.,]+\s*€/g, '').replace(/\s*[\d.,]+\s*€/g, '').trim()

/** Área que corresponde a cada tipo de aviso (campana y avisos con la app cerrada). */
export function areaOfNotification(kind: string): Area | null {
  if (kind.startsWith('pedido') || kind === 'devolucion' || kind === 'chat') return 'pedidos'
  if (kind === 'stock') return 'stock'
  return null
}
