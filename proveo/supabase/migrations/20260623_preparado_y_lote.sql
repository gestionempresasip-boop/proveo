-- Checklist de preparación por artículo (listo y cargado en la furgoneta)
-- y número de lote del producto servido en ese pedido.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS prepared boolean NOT NULL DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS lot_number text;
