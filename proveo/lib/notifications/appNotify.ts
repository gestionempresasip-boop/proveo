import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToOrg } from '@/lib/notifications/webPush'

export type AppNotificationSeverity = 'info' | 'success' | 'warning' | 'danger'

export type AppNotificationInput = {
  targetOrgId: string
  kind: string
  severity?: AppNotificationSeverity
  title: string
  body?: string | null
  link?: string | null
  orderId?: string | null
  /** Si se indica, no se vuelve a crear un aviso con la misma clave dentro de la ventana. */
  dedupeKey?: string
  dedupeWindowMinutes?: number
  meta?: Record<string, unknown> | null
}

// Los avisos son un extra: si algo falla aquí (tabla sin crear, red...) NUNCA
// debe romper el pedido, el cambio de estado o el movimiento de stock que lo
// ha disparado. Por eso todo va envuelto y devuelve en silencio.
export async function createAppNotification(input: AppNotificationInput): Promise<void> {
  try {
    const admin = createAdminClient() as any

    if (input.dedupeKey) {
      const since = new Date(Date.now() - (input.dedupeWindowMinutes ?? 5) * 60000).toISOString()
      const { data: existing } = await admin
        .from('app_notifications')
        .select('id')
        .eq('dedupe_key', input.dedupeKey)
        .gte('created_at', since)
        .limit(1)
      if (existing && existing.length > 0) return
    }

    await admin.from('app_notifications').insert({
      target_org_id: input.targetOrgId,
      kind: input.kind,
      severity: input.severity ?? 'info',
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      order_id: input.orderId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      meta: input.meta ?? null,
    })

    // Aviso al móvil/ordenador aunque la app esté cerrada (si hay dispositivos suscritos).
    await sendPushToOrg(input.targetOrgId, { title: input.title, body: input.body, link: input.link, tag: input.dedupeKey ?? input.kind, kind: input.kind })

    // Limpieza ocasional: nada de más de 30 días.
    if (Math.random() < 0.02) {
      await admin.from('app_notifications')
        .delete()
        .lt('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    }
  } catch {
    // ignorado a propósito
  }
}

export async function getNaveOrgId(): Promise<string | null> {
  try {
    const admin = createAdminClient() as any
    const { data } = await admin.from('organizations').select('id').eq('type', 'nave').limit(1).maybeSingle()
    return data?.id ?? null
  } catch {
    return null
  }
}

function eur(n: number) {
  return `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
}

export async function notifyNewOrderCreated(orderId: string, callerOrgId: string): Promise<void> {
  try {
    const admin = createAdminClient() as any
    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, total_price, restaurant_id, created_at, organizations!restaurant_id(name), order_items(id)')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) return
    // Solo el propio restaurante puede avisar de su pedido, y solo si es reciente.
    if (order.restaurant_id !== callerOrgId) return
    if (Date.now() - new Date(order.created_at).getTime() > 15 * 60000) return

    const naveId = await getNaveOrgId()
    if (!naveId) return
    const n = order.order_items?.length ?? 0
    await createAppNotification({
      targetOrgId: naveId,
      kind: 'pedido_nuevo',
      severity: 'info',
      title: `Pedido nuevo #${order.order_number}`,
      body: `${order.organizations?.name ?? 'Un restaurante'} · ${n} producto${n !== 1 ? 's' : ''} · ${eur(order.total_price)}`,
      link: '/pedidos',
      orderId: order.id,
      dedupeKey: `pedido-nuevo:${order.id}`,
      dedupeWindowMinutes: 60,
    })
  } catch {
    // ignorado a propósito
  }
}

/** Avisos al cambiar el estado de un pedido (hecho / enviado / cancelado / eliminado). */
export async function notifyOrderStatus(orderId: string, event: 'hecho' | 'enviado' | 'cancelado' | 'eliminado' | 'restaurado', actorOrgType: 'nave' | 'restaurante' | null): Promise<void> {
  try {
    const admin = createAdminClient() as any
    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, restaurant_id, organizations!restaurant_id(name)')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) return
    const name = order.organizations?.name ?? 'Restaurante'
    const num = order.order_number

    if (event === 'cancelado' && actorOrgType === 'restaurante') {
      const naveId = await getNaveOrgId()
      if (!naveId) return
      await createAppNotification({
        targetOrgId: naveId, kind: 'pedido_cancelado', severity: 'warning',
        title: `Pedido #${num} cancelado`, body: `${name} ha cancelado su pedido.`,
        link: '/pedidos', orderId, dedupeKey: `pedido-cancelado:${orderId}`, dedupeWindowMinutes: 60,
      })
      return
    }

    const map = {
      hecho:     { kind: 'pedido_hecho',     severity: 'info' as const,    title: `Tu pedido #${num} está preparado`, body: 'La nave ya lo tiene listo.' },
      enviado:   { kind: 'pedido_enviado',   severity: 'success' as const, title: `Tu pedido #${num} ha sido enviado`, body: 'Va de camino. Ya tienes el albarán disponible.' },
      cancelado: { kind: 'pedido_cancelado', severity: 'warning' as const, title: `Tu pedido #${num} ha sido cancelado`, body: 'La nave ha cancelado el pedido. Mira el chat por si hay algún motivo.' },
      eliminado: { kind: 'pedido_eliminado', severity: 'warning' as const, title: `Tu pedido #${num} ha sido eliminado`, body: 'Lo puedes ver en "Pedidos eliminados por la nave".' },
      restaurado:{ kind: 'pedido_restaurado',severity: 'info' as const,    title: `Tu pedido #${num} se ha restaurado`, body: 'Vuelve a estar activo.' },
    }[event]

    await createAppNotification({
      targetOrgId: order.restaurant_id, kind: map.kind, severity: map.severity,
      title: map.title, body: map.body, link: '/pedidos', orderId,
      dedupeKey: `${map.kind}:${orderId}`, dedupeWindowMinutes: 30,
    })
  } catch {
    // ignorado a propósito
  }
}

export async function notifyReturnReceived(orderId: string, itemCount: number): Promise<void> {
  try {
    const admin = createAdminClient() as any
    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, organizations!restaurant_id(name)')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) return
    const naveId = await getNaveOrgId()
    if (!naveId) return
    await createAppNotification({
      targetOrgId: naveId, kind: 'devolucion', severity: 'warning',
      title: `Devolución del pedido #${order.order_number}`,
      body: `${order.organizations?.name ?? 'Un restaurante'} ha devuelto ${itemCount} producto${itemCount !== 1 ? 's' : ''}.`,
      link: '/albaranes', orderId,
    })
  } catch {
    // ignorado a propósito
  }
}

export async function notifyChatMessage(orderId: string, senderOrgType: 'nave' | 'restaurante', text: string): Promise<void> {
  try {
    const admin = createAdminClient() as any
    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, restaurant_id, organizations!restaurant_id(name)')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) return
    const snippet = text.length > 90 ? text.slice(0, 87) + '…' : text
    const target = senderOrgType === 'restaurante' ? await getNaveOrgId() : order.restaurant_id
    if (!target) return
    await createAppNotification({
      targetOrgId: target, kind: 'chat', severity: 'info',
      title: senderOrgType === 'restaurante'
        ? `Mensaje de ${order.organizations?.name ?? 'un restaurante'} (pedido #${order.order_number})`
        : `Mensaje de la nave (pedido #${order.order_number})`,
      body: snippet, link: '/pedidos', orderId,
      dedupeKey: `chat:${orderId}:${senderOrgType}`, dedupeWindowMinutes: 2,
    })
  } catch {
    // ignorado a propósito
  }
}

/** Avisa a la nave de productos agotados / bajo mínimo, sin repetir el mismo producto en 24 h. */
export async function notifyLowStockInApp(items: { productId: string; name: string; level: 'agotado' | 'bajo' }[]): Promise<void> {
  try {
    if (items.length === 0) return
    const admin = createAdminClient() as any
    const since = new Date(Date.now() - 24 * 3600000).toISOString()
    const { data: recent } = await admin
      .from('app_notifications')
      .select('meta')
      .eq('kind', 'stock')
      .gte('created_at', since)
    const already = new Set<string>()
    for (const r of recent ?? []) for (const id of (r.meta?.productIds ?? []) as string[]) already.add(id)

    const fresh = items.filter(i => !already.has(i.productId))
    if (fresh.length === 0) return
    const naveId = await getNaveOrgId()
    if (!naveId) return

    const out = fresh.filter(i => i.level === 'agotado')
    const low = fresh.filter(i => i.level === 'bajo')
    const names = (list: typeof fresh) => {
      const first = list.slice(0, 3).map(i => i.name).join(', ')
      return list.length > 3 ? `${first} y ${list.length - 3} más` : first
    }
    const parts: string[] = []
    if (out.length) parts.push(`Sin stock: ${names(out)}`)
    if (low.length) parts.push(`Stock bajo: ${names(low)}`)

    await createAppNotification({
      targetOrgId: naveId, kind: 'stock',
      severity: out.length ? 'danger' : 'warning',
      title: out.length
        ? `Sin stock en ${out.length} producto${out.length !== 1 ? 's' : ''}`
        : `Stock bajo en ${low.length} producto${low.length !== 1 ? 's' : ''}`,
      body: parts.join(' · '),
      link: '/inventario',
      meta: { productIds: fresh.map(i => i.productId) },
    })
  } catch {
    // ignorado a propósito
  }
}
