-- Venta a distribuidores (fuera del grupo): margen que quieres, margen del
-- distribuidor y PVP al público, guardados en cada ficha de coste.
-- Solo añade una columna; no cambia nada existente.
ALTER TABLE product_cost_sheets ADD COLUMN IF NOT EXISTS external jsonb;

NOTIFY pgrst, 'reload schema';
