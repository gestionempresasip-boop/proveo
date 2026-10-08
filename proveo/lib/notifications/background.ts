import { after } from 'next/server'

// Los avisos (campana y avisos al móvil con la app cerrada) son un extra: no deben hacer esperar a
// quien acaba de marcar un pedido como enviado, devolver algo o escribir en el chat. Se hacen DESPUÉS
// de contestar. Si por lo que sea no se puede diferir (fuera de una petición), se lanza igual sin esperar.
// Nunca lanza: un aviso que falla no debe afectar a nada más.
export function inBackground(task: () => Promise<unknown>): void {
  const safe = () => task().catch(() => {})
  try {
    after(safe)
  } catch {
    void safe()
  }
}
