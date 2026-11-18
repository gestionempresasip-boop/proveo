-- Ingredientes de la tanda (nombre, cantidad, unidad, coste) y datos del envasado, en formato JSON.
-- Va en product_internal_notes (solo nave / admin). Solo AÑADE una columna.
ALTER TABLE product_internal_notes ADD COLUMN IF NOT EXISTS batch_detail jsonb;

NOTIFY pgrst, 'reload schema';
