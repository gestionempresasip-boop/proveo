// Pantalla de entrada de cada usuario. El grupo entra por /login (con todos los locales);
// un cliente externo entra por su dirección propia, donde solo aparece él.
export const CLIENT_COOKIE = 'proveo_client'

export function loginPathFor(org: { is_external?: boolean | null; login_slug?: string | null } | null | undefined): string {
  return org?.is_external && org.login_slug ? `/cliente/${org.login_slug}` : '/login'
}

/** Recuerda por qué entrada ha entrado este dispositivo (si caduca la sesión, vuelve a la suya). Solo en el navegador. */
export function rememberEntry(slug?: string) {
  try {
    document.cookie = slug
      ? `${CLIENT_COOKIE}=${slug}; path=/; max-age=31536000; samesite=lax`
      : `${CLIENT_COOKIE}=; path=/; max-age=0`
  } catch { /* sin cookies: no pasa nada */ }
}
