'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { canAccess } from '@/lib/areas'
import { codesMatch } from '@/lib/accessCode'
import { clearGateCookie, gateToken, hasGateCookie, rejectWrongCode, setGateCookie } from '@/lib/accessGate'

// Código de acceso a las categorías protegidas de Productos. Como el PIN de la
// nave lo conoce cualquiera que trabaje ahí, las categorías marcadas como
// protegidas no envían NINGÚN dato (ni precios, ni costes, ni márgenes) al
// navegador hasta que alguien introduce este código. Solo lo comprueba el
// servidor: nunca llega al navegador ni al código fuente.
// (Costes tiene su propia clave, aparte: ver costesGate.ts.)
const COOKIE_NAME = 'productos_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 horas: pasado ese tiempo hay que volver a meterlo

const configured = () => process.env.PRODUCTOS_ACCESS_CODE

async function assertNaveManager() {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok || !canAccess(profile, 'productos')) throw new Error('Sin permisos')
}

export async function isProductsCodeConfigured(): Promise<boolean> {
  return gateToken('productos', configured()) !== null
}

export async function isProductsUnlocked(): Promise<boolean> {
  return hasGateCookie(COOKIE_NAME, gateToken('productos', configured()))
}

export async function unlockProducts(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertNaveManager()
  const real = configured()
  if (!real) return { ok: false, error: 'Todavía no hay ningún código configurado (falta PRODUCTOS_ACCESS_CODE)' }
  if (!codesMatch(code, real)) {
    await rejectWrongCode('productos', { PRODUCTOS_ACCESS_CODE: real })
    return { ok: false, error: 'Código incorrecto' }
  }
  const token = gateToken('productos', real)
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  await setGateCookie(COOKIE_NAME, token, MAX_AGE_SECONDS)
  revalidatePath('/admin/productos')
  return { ok: true }
}

export async function lockProducts() {
  await assertNaveManager()
  await clearGateCookie(COOKIE_NAME)
  revalidatePath('/admin/productos')
}

// Marcar o quitar la protección de una categoría: solo con el código ya introducido.
export async function setCategoryProtected(categoryId: string, isProtected: boolean): Promise<{ ok: boolean; error?: string }> {
  await assertNaveManager()
  if (!(await isProductsUnlocked())) return { ok: false, error: 'Introduce primero el código de acceso' }
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { error } = await supabase.from('product_categories').update({ is_protected: isProtected }).eq('id', categoryId)
  if (error) return { ok: false, error: 'No se pudo guardar (¿está aplicada la migración de categorías protegidas?)' }
  revalidatePath('/admin/productos')
  return { ok: true }
}
