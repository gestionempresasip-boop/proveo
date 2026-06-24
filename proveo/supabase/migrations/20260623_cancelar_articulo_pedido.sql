-- Motivo opcional al rectificar/cancelar una línea de pedido (ej: rotura de
-- stock, producto en mal estado...). Cuando rectified_quantity = 0 se
-- entiende que la nave ha cancelado ese artículo del pedido.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS rectification_note text;
ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS note text;
