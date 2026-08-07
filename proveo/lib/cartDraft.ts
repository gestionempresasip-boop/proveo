// Guarda el pedido a medio hacer en localStorage, por restaurante, para que
// no se pierda si recargan la página, cierran el navegador o se les va la
// conexión antes de pulsar "Enviar pedido a la nave". Se borra al enviar
// el pedido con éxito.
export type CartDraft = {
  cart: Record<string, number>
  cartModes: Record<string, 'unidad' | 'cajon'>
  notes: string
  destination: 'sala' | 'cocina' | ''
}

function draftKey(organizationId: string) {
  return `proveo:cart-draft:${organizationId}`
}

export function saveCartDraft(organizationId: string, draft: CartDraft) {
  if (typeof window === 'undefined') return
  const isEmpty = Object.keys(draft.cart).length === 0 && !draft.notes && !draft.destination
  if (isEmpty) {
    window.localStorage.removeItem(draftKey(organizationId))
    return
  }
  window.localStorage.setItem(draftKey(organizationId), JSON.stringify(draft))
}

export function loadCartDraft(organizationId: string): CartDraft | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(draftKey(organizationId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      cart: parsed.cart ?? {},
      cartModes: parsed.cartModes ?? {},
      notes: parsed.notes ?? '',
      destination: parsed.destination ?? '',
    }
  } catch {
    return null
  }
}

export function clearCartDraft(organizationId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(draftKey(organizationId))
}
