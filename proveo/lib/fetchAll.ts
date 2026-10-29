// PostgREST devuelve como mucho 1000 filas por petición: las tablas que crecen (p. ej. los enlaces
// producto–categoría) se leen por tramos para que no se pierdan filas sin avisar.
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return out
}
