import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { canAccess, homeFor, type Area } from '@/lib/areas'

// En una acción del servidor: corta si el usuario de la nave no tiene esta área.
// Los restaurantes y el acceso de Dirección pasan siempre.
export async function assertArea(area: Area): Promise<void> {
  const profile = await getAuthProfile()
  if (!canAccess(profile, area)) throw new Error('No tienes acceso a esta sección')
}

// En una página: manda al inicio del usuario si no tiene esta área.
export async function requireArea(area: Area) {
  const profile = await getAuthProfile()
  if (!canAccess(profile, area)) {
    const home = homeFor(profile)
    redirect(home === '/dashboard' ? '/dashboard' : home)
  }
  return profile
}
