-- Coste total de la tanda de cada producto (lo que costó la tanda entera). Junto con las unidades que salen
-- da el coste de materia prima por unidad, que rellena el precio de coste en la ficha.
-- Va en product_internal_notes (solo nave / admin). Solo AÑADE una columna.
ALTER TABLE product_internal_notes ADD COLUMN IF NOT EXISTS batch_cost numeric;

NOTIFY pgrst, 'reload schema';
