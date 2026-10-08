// Mensaje legible de un error capturado (los server actions lanzan Error con el texto para el usuario).
export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}
