-- ============================================================
-- PROVEO — Stock limitado, multi-categoría, rectificación de
-- pedidos, productos pendientes de margen, alertas de stock,
-- nuevas unidades e IVAs.
-- ============================================================

-- ── 1. Arreglo de permisos que faltaban (RLS) ─────────────────
-- La nave no tenía permiso para ACTUALIZAR ni BORRAR líneas de
-- pedido, ni para BORRAR pedidos. Sin esto, "Eliminar pedido" y
-- la futura rectificación de cantidades fallan en silencio.

DROP POLICY IF EXISTS "order_items_update_nave" ON order_items;
CREATE POLICY "order_items_update_nave" ON order_items FOR UPDATE TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin')
  WITH CHECK (get_my_org_type() = 'nave' OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "order_items_delete_nave" ON order_items;
CREATE POLICY "order_items_delete_nave" ON order_items FOR DELETE TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "orders_delete_nave" ON orders;
CREATE POLICY "orders_delete_nave" ON orders FOR DELETE TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin');

-- ── 2. Nuevas unidades ─────────────────────────────────────────
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_check;
ALTER TABLE products ADD CONSTRAINT products_unit_check CHECK (
  unit IN ('kg','g','l','ml','unidad','caja','bandeja',
           'bolsa_500g','bolsa_1kg','barqueta_2kg','barqueta_4kg','racion')
);

-- ── 3. Productos: pendientes de margen (bandeja superior) ─────
ALTER TABLE products ADD COLUMN IF NOT EXISTS pending_review boolean NOT NULL DEFAULT true;
-- Los productos ya existentes (con coste puesto) no deben aparecer como pendientes
UPDATE products SET pending_review = false WHERE cost_price > 0;

-- ── 4. Multi-categoría: tabla puente producto <-> categoría ────
CREATE TABLE IF NOT EXISTS product_category_links (
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- Migrar la categoría única actual a la tabla puente
INSERT INTO product_category_links (product_id, category_id)
SELECT id, category_id FROM products WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE product_category_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pcl_select" ON product_category_links;
CREATE POLICY "pcl_select" ON product_category_links FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pcl_manage" ON product_category_links;
CREATE POLICY "pcl_manage" ON product_category_links FOR ALL TO authenticated
  USING (get_my_role() = 'admin' OR get_my_org_type() = 'nave')
  WITH CHECK (get_my_role() = 'admin' OR get_my_org_type() = 'nave');

-- ── 5. Inventario nave: marca de "vuelve a haber stock" ────────
ALTER TABLE nave_inventory ADD COLUMN IF NOT EXISTS last_restocked_at timestamptz;

-- ── 6. Rectificación de pedidos por la nave ────────────────────
-- Cantidad que la nave confirma realmente enviar (si es distinta
-- a la pedida). NULL = sin rectificar, se entiende = lo pedido.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS rectified_quantity decimal(10,3);

-- ── 7. Usuarios: PIN visible/gestionable por la nave/admin ─────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin text;

DROP POLICY IF EXISTS "profiles_update_nave" ON profiles;
CREATE POLICY "profiles_update_nave" ON profiles FOR UPDATE TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin')
  WITH CHECK (get_my_org_type() = 'nave' OR get_my_role() = 'admin');
