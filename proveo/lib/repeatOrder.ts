// Puente entre "Repetir pedido" (en Mis pedidos) y el Catálogo: se guarda
// en localStorage la lista de productos/cantidades del pedido anterior, el
// catálogo la lee al cargar, rellena el carrito y borra la clave. Así el
// restaurante puede revisar/editar cantidades antes de enviar el pedido
// "repetido", que se crea como un pedido nuevo con la fecha de hoy.
export const REPEAT_ORDER_KEY = 'proveo:repeat-order'

export type RepeatOrderItem = { product_id: string; quantity: number }

export function setRepeatOrder(items: RepeatOrderItem[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REPEAT_ORDER_KEY, JSON.stringify(items))
}

export function takeRepeatOrder(): RepeatOrderItem[] | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(REPEAT_ORDER_KEY)
  if (!raw) return null
  window.localStorage.removeItem(REPEAT_ORDER_KEY)
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
