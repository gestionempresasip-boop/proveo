import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { areaOfNotification, canAccess, canSeePrices, stripAmounts } from '@/lib/areas'

let configured = false
function configure(): boolean {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@proveo.app', pub, priv)
  configured = true
  return true
}

// Envía el aviso a todos los dispositivos suscritos de una organización.
// Como el resto de avisos, nunca lanza: un fallo aquí no debe afectar a nada más.
export async function sendPushToOrg(
  orgId: string,
  payload: { title: string; body?: string | null; link?: string | null; tag?: string; kind?: string }
): Promise<void> {
  try {
    if (!configure()) return
    const admin = createAdminClient() as any
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .eq('org_id', orgId)
    if (!subs || subs.length === 0) return

    // Accesos de la nave con áreas: solo les llegan los avisos de sus áreas, y sin importes
    // si no ven precios. Los restaurantes y el acceso de Dirección (areas null) reciben todo.
    const userIds = [...new Set(subs.map((s: any) => s.user_id).filter(Boolean))]
    const { data: profs } = userIds.length
      ? await admin.from('profiles').select('id, areas, organizations(type)').in('id', userIds)
      : { data: [] }
    const byUser = new Map<string, { areas: string[] | null; type: string | undefined }>(
      (profs ?? []).map((p: any) => [p.id, { areas: p.areas ?? null, type: p.organizations?.type }])
    )
    const area = payload.kind ? areaOfNotification(payload.kind) : null
    const dead: string[] = []
    await Promise.all(subs.map(async (s: any) => {
      try {
        const subject = byUser.get(s.user_id) ?? { areas: null, type: undefined }
        const asProfile = { areas: subject.areas, organizations: { type: subject.type } }
        if (area && !canAccess(asProfile, area)) return
        const text = canSeePrices(asProfile) ? payload.body : stripAmounts(payload.body)
        const body = JSON.stringify({ title: payload.title, body: text ?? '', link: payload.link ?? '/', tag: payload.tag })
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600, urgency: 'high' })
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.id)
      }
    }))
    if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead)
  } catch {
    // ignorado a propósito
  }
}
