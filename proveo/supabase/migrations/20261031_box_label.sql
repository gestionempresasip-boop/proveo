-- Productos que se piden "por caja" pueden llamarse "caja" o "bolsa" (p. ej. las croquetas: bolsa de ~100 und).
-- El mecanismo es el mismo de siempre (unidades aproximadas por envase y la nave corrige las exactas);
-- esto solo guarda cómo se llama el envase en cada producto. Aditivo: todo lo existente sigue siendo "caja".
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_label text NOT NULL DEFAULT 'caja';
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_box_label_check;
ALTER TABLE products ADD CONSTRAINT products_box_label_check CHECK (box_label IN ('caja', 'bolsa'));

NOTIFY pgrst, 'reload schema';
