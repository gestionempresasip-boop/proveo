-- Coste del envase por unidad (bolsa, barqueta, cajón…). Se suma a la materia prima de la tanda
-- para dar el coste por unidad. Va en product_internal_notes (solo nave / admin). Solo AÑADE una columna.
ALTER TABLE product_internal_notes ADD COLUMN IF NOT EXISTS packaging_cost numeric;

NOTIFY pgrst, 'reload schema';
