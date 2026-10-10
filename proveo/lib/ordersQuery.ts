// Consultas de pedidos de la nave compartidas entre la página y las acciones de «cargar más».
export const NAVE_ORDER_SELECT = '*, organizations(id, name), order_items(*, products(name, unit)), delivery_notes(id, note_number, type, delivery_note_items(product_id, delivered_quantity, return_reason, products(name))), deleted_by_profile:profiles!deleted_by(full_name)'

/** Los pedidos de «hoy» + los pendientes se cargan al entrar; el resto, bajo demanda. */
export const RECENT_HOURS = 48
export const TRASH_DAYS = 90
