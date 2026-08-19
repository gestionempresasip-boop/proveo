'use server'

import { checkAndNotifyLowStock } from '@/lib/notifications/lowStock'

// Wrapper server action: CatalogoClient (sesión de restaurante) necesita
// poder disparar la comprobación tras hacer un pedido, pero la lógica en sí
// usa el cliente admin (ver lib/notifications/lowStock.ts).
export async function notifyLowStock(productIds: string[]) {
  try {
    return await checkAndNotifyLowStock(productIds)
  } catch {
    return []
  }
}
