-- Peso real de la línea de pedido: hay productos que se piden por unidad
-- ("3 ud") pero que en realidad pesan distinto cada vez (piezas de carne,
-- pescado entero...). La nave anota el peso real al preparar el pedido,
-- aparte de la cantidad en unidades; se refleja también en el albarán.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS actual_weight decimal(10,3);
ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS actual_weight decimal(10,3);
