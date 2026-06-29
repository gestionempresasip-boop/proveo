-- Bug: el catálogo trataba a un producto SIN fila en nave_inventory como
-- "sin límite de stock controlado por la nave" (en vez de "0 en stock"),
-- así que los restaurantes podían pedir productos nunca repuestos por la
-- nave. createProduct() ya se corrigió para crear siempre esta fila al dar
-- de alta un producto; esta migración rellena los que ya existían sin ella,
-- dejándolos en 0 (sin stock) hasta que la nave indique la cantidad real.
INSERT INTO nave_inventory (product_id, current_stock, min_stock)
SELECT p.id, 0, 0
FROM products p
LEFT JOIN nave_inventory ni ON ni.product_id = p.id
WHERE ni.product_id IS NULL;
