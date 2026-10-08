-- Categorías protegidas con código: los productos de estas categorías (y sus
-- precios, costes y márgenes) no se muestran en Productos hasta introducir el
-- código de acceso. Solo añade una columna; no cambia nada existente.
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
