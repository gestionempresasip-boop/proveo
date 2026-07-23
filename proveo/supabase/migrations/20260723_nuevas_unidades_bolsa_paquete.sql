-- ── Añadir 'bolsa' y 'paquete' como unidades de medida de productos ──────────
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_check;
ALTER TABLE products ADD CONSTRAINT products_unit_check CHECK (
  unit IN ('kg','g','l','ml','unidad','caja','bandeja',
           'bolsa_500g','bolsa_1kg','barqueta_2kg','barqueta_4kg','racion',
           'bolsa','paquete')
);
