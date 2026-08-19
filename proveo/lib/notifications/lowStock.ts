import { createAdminClient } from '@/lib/supabase/admin'

// Antes, el aviso de "stock bajo" era solo un color en la pantalla de
// Inventario — si nadie entraba a mirar, no se enteraba nadie. Esto manda
// un aviso real (email) la primera vez que un producto cruza su mínimo, y
// no vuelve a avisar del mismo producto hasta pasadas 24h (para no
// saturar si el stock sube y baja varias veces seguidas por el mismo
// producto). Se usa el cliente admin porque esto se dispara también desde
// la sesión de un restaurante (al hacer un pedido que deja algo bajo
// mínimo), que no tiene permiso de escritura en notification_log.
const DEDUPE_HOURS = 24

export type LowStockAlert = { productId: string; productName: string; currentStock: number; minStock: number; level: 'bajo' | 'agotado' }

export async function checkAndNotifyLowStock(productIds: string[]): Promise<LowStockAlert[]> {
  const uniqueIds = [...new Set(productIds)]
  if (uniqueIds.length === 0) return []

  const admin = createAdminClient() as any

  const { data: rows } = await admin
    .from('nave_inventory')
    .select('product_id, current_stock, min_stock, products(name)')
    .in('product_id', uniqueIds)
  if (!rows || rows.length === 0) return []

  const belowMin = (rows as any[]).filter(r => Number(r.min_stock) > 0 && Number(r.current_stock) <= Number(r.min_stock))
  if (belowMin.length === 0) return []

  const since = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
  const { data: recentAlerts } = await admin
    .from('notification_log')
    .select('product_id')
    .eq('type', 'stock_minimo')
    .in('product_id', belowMin.map(r => r.product_id))
    .gte('created_at', since)
  const alreadyNotified = new Set((recentAlerts ?? []).map((a: any) => a.product_id))

  const toNotify = belowMin.filter(r => !alreadyNotified.has(r.product_id))
  if (toNotify.length === 0) return []

  const alerts: LowStockAlert[] = toNotify.map(r => ({
    productId: r.product_id,
    productName: r.products?.name ?? 'Producto',
    currentStock: Number(r.current_stock),
    minStock: Number(r.min_stock),
    level: Number(r.current_stock) === 0 ? 'agotado' : 'bajo',
  }))

  const { data: nave } = await admin.from('organizations').select('email').eq('type', 'nave').limit(1).maybeSingle()
  const recipientEmail = nave?.email || null
  const emailSent = recipientEmail ? await sendLowStockEmail(recipientEmail, alerts) : false

  await admin.from('notification_log').insert(
    alerts.map(a => ({
      type: 'stock_minimo',
      product_id: a.productId,
      channel: 'email',
      status: emailSent ? 'sent' : (recipientEmail ? 'failed' : 'pending'),
      error_message: recipientEmail ? (emailSent ? null : 'No se pudo enviar el email') : 'Sin RESEND_API_KEY configurada o sin email de la nave',
      sent_at: emailSent ? new Date().toISOString() : null,
    }))
  )

  return alerts
}

async function sendLowStockEmail(to: string, alerts: LowStockAlert[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const rows = alerts
      .map(a => `<tr><td style="padding:4px 12px 4px 0">${a.productName}</td><td style="padding:4px 0;color:${a.level === 'agotado' ? '#DC2626' : '#F59E0B'};font-weight:600">${a.level === 'agotado' ? 'Agotado' : `Stock bajo (${a.currentStock}/${a.minStock})`}</td></tr>`)
      .join('')
    const { error } = await resend.emails.send({
      from: 'Proveo <alertas@proveo.es>',
      to,
      subject: `⚠️ ${alerts.length} producto${alerts.length !== 1 ? 's' : ''} con stock bajo`,
      html: `<p>Estos productos han caído por debajo de su stock mínimo:</p><table>${rows}</table><p>Revisa el inventario en Proveo para reponer.</p>`,
    })
    return !error
  } catch {
    return false
  }
}
