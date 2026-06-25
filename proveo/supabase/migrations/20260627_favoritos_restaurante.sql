-- Catálogo de favoritos por restaurante: productos que ese restaurante pide
-- habitualmente (o que la nave elabora específicamente para él), para que
-- no tenga que buscarlos cada vez entre todo el catálogo general.
-- Lo puede gestionar tanto la nave/admin (desde Gestión de Productos, para
-- cualquier restaurante) como el propio restaurante (marcando una estrella
-- en su catálogo).
CREATE TABLE IF NOT EXISTS restaurant_favorite_products (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (organization_id, product_id)
);

ALTER TABLE restaurant_favorite_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fav_select" ON restaurant_favorite_products FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    OR get_my_org_type() = 'nave'
    OR get_my_role() = 'admin'
  );

CREATE POLICY "fav_manage" ON restaurant_favorite_products FOR ALL TO authenticated
  USING (
    organization_id = get_my_org_id()
    OR get_my_org_type() = 'nave'
    OR get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = get_my_org_id()
    OR get_my_org_type() = 'nave'
    OR get_my_role() = 'admin'
  );
