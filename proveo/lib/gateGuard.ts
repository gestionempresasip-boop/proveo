import { getAuthProfile } from '@/lib/supabase/helpers'
import { isProductsUnlocked } from '@/app/actions/productsGate'
import { isStockUnlocked } from '@/app/actions/stockGate'
import { isUsuariosUnlocked } from '@/app/actions/usuariosGate'
import { isInformesUnlocked } from '@/app/actions/informesGate'

// Cada pestaña sensible de la nave tiene su clave. La pantalla no basta: quien llame a una acción
// del servidor sin haber metido la clave de su pestaña también se encuentra con la puerta cerrada.
// Los restaurantes no pasan por aquí (usan sus propias pantallas, sin claves).
export type Gate = 'productos' | 'stock' | 'usuarios' | 'informes'

const CHECK: Record<Gate, () => Promise<boolean>> = {
  productos: isProductsUnlocked,
  stock: isStockUnlocked,
  usuarios: isUsuariosUnlocked,
  informes: isInformesUnlocked,
}

/** Falla si el usuario de la nave no ha desbloqueado NINGUNA de estas pestañas (basta una). */
export async function assertUnlocked(...gates: Gate[]): Promise<void> {
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave') return
  for (const g of gates) if (await CHECK[g]()) return
  throw new Error('Introduce primero la clave de acceso de esta pestaña')
}
