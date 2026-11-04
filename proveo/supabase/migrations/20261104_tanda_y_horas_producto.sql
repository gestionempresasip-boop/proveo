-- Tanda de producción de cada producto: cuántas unidades salen y cuántas horas de trabajo
-- (suma de todas las personas) cuesta hacerla. Con esto la ficha del producto calcula el
-- precio recomendado (materia prima + mano de obra + indirectos).
-- Va en product_internal_notes: esa tabla ya es solo para la nave (RLS admin / nave_manager).
-- Solo AÑADE dos columnas: no cambia nada existente.
ALTER TABLE product_internal_notes ADD COLUMN IF NOT EXISTS batch_units numeric;
ALTER TABLE product_internal_notes ADD COLUMN IF NOT EXISTS labor_hours numeric;

NOTIFY pgrst, 'reload schema';
