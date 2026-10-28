-- Clientes externos (distribuidores): compran a la nave con su propio usuario,
-- ven solo los productos que la nave les asigna y a su precio.
-- Todo lo nuevo es aditivo. Las dos políticas que se recrean (organizations y
-- products) se comportan igual que antes para la nave y los restaurantes del
-- grupo; solo cambian para los usuarios de un cliente externo.

-- 1) Datos del cliente externo (cuelgan de su organización, que sigue siendo
--    type = 'restaurante' para que pedidos, albaranes y stock funcionen igual).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fiscal_name text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS login_slug text;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_login_slug_key
  ON organizations (login_slug) WHERE login_slug IS NOT NULL;

-- 2) Productos asignados a cada cliente y su precio (sin IVA, como products.price).
--    Un producto está asignado a un cliente si existe su fila aquí.
CREATE TABLE IF NOT EXISTS client_product_prices (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price numeric(12,4) NOT NULL CHECK (price >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, product_id)
);
ALTER TABLE client_product_prices ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_org_is_external()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT o.is_external FROM profiles p
       JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = auth.uid()),
    false)
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "cpp_select" ON client_product_prices;
CREATE POLICY "cpp_select" ON client_product_prices FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    OR get_my_org_type() = 'nave'
    OR get_my_role() = 'admin'
  );
DROP POLICY IF EXISTS "cpp_manage" ON client_product_prices;
CREATE POLICY "cpp_manage" ON client_product_prices FOR ALL TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin')
  WITH CHECK (get_my_org_type() = 'nave' OR get_my_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_product_prices TO authenticated, service_role;

-- 3) Un cliente externo solo ve SU organización (hasta ahora cualquier usuario
--    autenticado podía leer la lista completa de locales).
DROP POLICY IF EXISTS "org_select" ON organizations;
CREATE POLICY "org_select" ON organizations FOR SELECT TO authenticated
  USING (NOT get_my_org_is_external() OR id = get_my_org_id());

-- 4) Productos: los usuarios externos NO ven el catálogo general del grupo, solo
--    los productos que se les han asignado (o los que ya han pedido, para que su
--    historial y sus albaranes sigan mostrando el nombre).
DROP POLICY IF EXISTS "products_select_restaurante" ON products;
CREATE POLICY "products_select_restaurante" ON products FOR SELECT TO authenticated
  USING (
    NOT get_my_org_is_external()
    AND is_active = true AND (
      get_my_role() = 'admin'
      OR get_my_org_type() = 'nave'
      OR visibility = 'todos'
      OR (
        visibility = 'restringido' AND
        EXISTS (
          SELECT 1 FROM product_restaurant_access pra
          WHERE pra.product_id = products.id
            AND pra.organization_id = get_my_org_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "products_select_externo" ON products;
CREATE POLICY "products_select_externo" ON products FOR SELECT TO authenticated
  USING (
    get_my_org_is_external()
    AND (
      EXISTS (
        SELECT 1 FROM client_product_prices c
        WHERE c.product_id = products.id AND c.organization_id = get_my_org_id()
      )
      OR EXISTS (
        SELECT 1 FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = products.id AND o.restaurant_id = get_my_org_id()
      )
    )
  );

NOTIFY pgrst, 'reload schema';
