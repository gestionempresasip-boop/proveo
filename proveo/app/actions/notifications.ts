'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewOrderCreated } from '@/lib/notifications/appNotify'

export type AppNotification = {
  id: string
  kind: string
  severity: 'info' | 'success' | 'warning' | 'danger'
  title: string
  body: string | null
  link: string | null
  createdAt: string
}

async function myOrg(): Promise<{ orgId: string; orgType: 'nave' | 'restaurante' } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await (supabase as any)
    .from('profiles').select('organization_id, organizations(type)').eq('id', user.id).single()
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, orgType: profile.organizations?.type === 'nave' ? 'nave' : 'restaurante' }
}

// Avisos de MI organización (los últimos 14 días). Cada dispositivo guarda
// hasta dónde ha "visto" y, con eso, calcula qué es nuevo — no hace falta
// guardar el estado de lectura en la base de datos.
export async function listMyNotifications(): Promise<AppNotification[]> {
  try {
    const me = await myOrg()
    if (!me) return []
    const admin = createAdminClient() as any
    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const { data, error } = await admin
      .from('app_notifications')
      .select('id, kind, severity, title, body, link, created_at')
      .eq('target_org_id', me.orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) return []
    return (data ?? []).map((n: any) => ({
      id: n.id, kind: n.kind, severity: n.severity, title: n.title,
      body: n.body, link: n.link, createdAt: n.created_at,
    }))
  } catch {
    return []
  }
}

// El restaurante crea el pedido desde el navegador; esto avisa a la nave.
export async function notifyNewOrder(orderId: string) {
  try {
    const me = await myOrg()
    if (!me || me.orgType !== 'restaurante') return
    await notifyNewOrderCreated(orderId, me.orgId)
  } catch {
    // ignorado a propósito: un aviso nunca debe afectar al pedido
  }
}

// ── Web Push: suscribir / desuscribir este dispositivo ──────────────────
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }, userAgent?: string) {
  try {
    const me = await myOrg()
    if (!me) return { ok: false }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admin = createAdminClient() as any
    const { error } = await admin.from('push_subscriptions').upsert({
      org_id: me.orgId, user_id: user?.id ?? null,
      endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth,
      user_agent: userAgent?.slice(0, 200) ?? null,
    }, { onConflict: 'endpoint' })
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}

export async function removePushSubscription(endpoint: string) {
  try {
    const me = await myOrg()
    if (!me) return { ok: false }
    const admin = createAdminClient() as any
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('org_id', me.orgId)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
