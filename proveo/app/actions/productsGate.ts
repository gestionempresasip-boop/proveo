'use server'

import { cookies } from 'next/headers'
import { createHash, timingSafeEqual } from 'crypto'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'

// Código de acceso a las categorías protegidas de Productos. Como el PIN de la
// nave lo conoce cualquiera que trabaje ahí, las categorías marcadas como
// protegidas no envían NINGÚN dato (ni precios, ni costes, ni márgenes) al
// navegador hasta que alguien introduce este código. Solo lo comprueba el
// servidor: nunca llega al navegador ni al código fuente.
const COOKIE_NAME = 'productos_unlocked'
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 horas: pasado ese tiempo hay que volver a meterlo

function expectedToken(): string | null {
  const code = process.env.PRODUCTOS_ACCESS_CODE
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!code || !secret) return null
  return createHash('sha256').update(`productos:${code}:${secret}`).digest('hex')
}

function sameCode(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

async function assertNaveManager() {
  const profile = await getAuthProfile()
  const ok = profile.role === 'admin' || (profile.role === 'nave_manager' && profile.organizations.type === 'nave')
  if (!ok) throw new Error('Sin permisos')
}

export async function isProductsCodeConfigured(): Promise<boolean> {
  return expectedToken() !== null
}

export async function isProductsUnlocked(): Promise<boolean> {
  const token = expectedToken()
  if (!token) return false
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === token
}

export async function unlockProducts(code: string): Promise<{ ok: boolean; error?: string }> {
  await assertNaveManager()
  const realCode = process.env.PRODUCTOS_ACCESS_CODE
  if (!realCode) return { ok: false, error: 'Todavía no hay ningún código configurado (falta PRODUCTOS_ACCESS_CODE)' }
  if (!sameCode(code.trim(), realCode.trim())) {
    await new Promise(r => setTimeout(r, 800)) // frena los intentos a lo loco
    return { ok: false, error: 'Código incorrecto' }
  }
  const token = expectedToken()
  if (!token) return { ok: false, error: 'No se pudo generar el acceso' }
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
  revalidatePath('/admin/productos')
  return { ok: true }
}

export async function lockProducts() {
  await assertNaveManager()
  const store = await cookies()
  store.delete(COOKIE_NAME)
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
