import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

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
  payload: { title: string; body?: string | null; link?: string | null; tag?: string }
): Promise<void> {
  try {
    if (!configure()) return
    const admin = createAdminClient() as any
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('org_id', orgId)
    if (!subs || subs.length === 0) return
    const body = JSON.stringify({ title: payload.title, body: payload.body ?? '', link: payload.link ?? '/', tag: payload.tag })
    const dead: string[] = []
    await Promise.all(subs.map(async (s: any) => {
      try {
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
