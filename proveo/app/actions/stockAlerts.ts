'use server'

import { checkAndNotifyLowStock } from '@/lib/notifications/lowStock'
import { assertArea } from '@/lib/areaGuard'

// Wrapper server action: CatalogoClient (sesión de restaurante) necesita
// poder disparar la comprobación tras hacer un pedido, pero la lógica en sí
// usa el cliente admin (ver lib/notifications/lowStock.ts).
export async function notifyLowStock(productIds: string[]) {
  await assertArea('stock')
  try {
    return await checkAndNotifyLowStock(productIds)
  } catch {
    return []
  }
}
