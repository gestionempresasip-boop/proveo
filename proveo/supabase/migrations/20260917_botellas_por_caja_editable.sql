-- Pedido de vinos por caja con nº de botellas editable en el momento del
-- pedido (por defecto 6, pero el restaurante puede corregirlo a 12, 4...
-- si esa caja en concreto trae otra cantidad). El descuento de stock ya
-- usaba box_units por producto (mecanismo existente, sin cambios aquí);
-- esto solo añade dónde guardar la cesta pendiente compartida con el
-- número de botellas que el restaurante haya puesto para cada línea,
-- para que sobreviva a un cambio de dispositivo igual que cart/cart_modes.
ALTER TABLE pending_carts ADD COLUMN IF NOT EXISTS cart_box_units jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
