-- ============================================================
-- PROVEO — Row Level Security (RLS)
-- Cada usuario solo ve y modifica los datos de su organización
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_restaurant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nave_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCIÓN HELPER: obtener el perfil del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS uuid AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_org_type()
RETURNS text AS $$
  SELECT o.type FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
-- Todos los autenticados pueden ver organizaciones
CREATE POLICY "org_select" ON organizations FOR SELECT TO authenticated USING (true);
-- Solo admin puede modificar
CREATE POLICY "org_admin_all" ON organizations FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "profiles_select_own_org" ON profiles FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    OR get_my_role() = 'admin'
    OR get_my_org_type() = 'nave'
  );
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
CREATE POLICY "categories_select_all" ON product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_admin_manage" ON product_categories FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- PRODUCTS
-- ============================================================
-- Un restaurante ve: productos visibles para todos + productos de su acceso restringido
CREATE POLICY "products_select_restaurante" ON products FOR SELECT TO authenticated
  USING (
    is_active = true AND (
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
CREATE POLICY "products_admin_manage" ON products FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- PRODUCT RESTAURANT ACCESS
-- ============================================================
CREATE POLICY "pra_select" ON product_restaurant_access FOR SELECT TO authenticated USING (true);
CREATE POLICY "pra_admin_manage" ON product_restaurant_access FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- ORDERS
-- ============================================================
-- Restaurante: ve solo sus pedidos. Nave y admin: ve todos.
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR get_my_org_type() = 'nave'
    OR restaurant_id = get_my_org_id()
  );
-- Restaurante puede crear pedidos a su nombre
CREATE POLICY "orders_insert_restaurante" ON orders FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = get_my_org_id()
    AND get_my_org_type() = 'restaurante'
  );
-- Nave y admin pueden actualizar estado de pedidos
CREATE POLICY "orders_update_nave_admin" ON orders FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR get_my_org_type() = 'nave'
    OR (restaurant_id = get_my_org_id() AND status = 'pendiente')
  );

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE POLICY "order_items_select" ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND (
        get_my_role() = 'admin'
        OR get_my_org_type() = 'nave'
        OR o.restaurant_id = get_my_org_id()
      )
    )
  );
CREATE POLICY "order_items_insert" ON order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = order_items.order_id
        AND o.restaurant_id = get_my_org_id()
    )
  );

-- ============================================================
-- NAVE INVENTORY
-- ============================================================
CREATE POLICY "nave_inv_select" ON nave_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "nave_inv_manage" ON nave_inventory FOR ALL TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin')
  WITH CHECK (get_my_org_type() = 'nave' OR get_my_role() = 'admin');

-- ============================================================
-- RESTAURANT INVENTORY
-- ============================================================
CREATE POLICY "rest_inv_select" ON restaurant_inventory FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    OR get_my_role() = 'admin'
    OR get_my_org_type() = 'nave'
  );
CREATE POLICY "rest_inv_manage" ON restaurant_inventory FOR ALL TO authenticated
  USING (organization_id = get_my_org_id() OR get_my_role() = 'admin')
  WITH CHECK (organization_id = get_my_org_id() OR get_my_role() = 'admin');

-- ============================================================
-- RECIPES (ESCANDALLOS)
-- ============================================================
CREATE POLICY "recipes_select_own" ON recipes FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    OR get_my_role() = 'admin'
  );
CREATE POLICY "recipes_manage_own" ON recipes FOR ALL TO authenticated
  USING (organization_id = get_my_org_id() OR get_my_role() = 'admin')
  WITH CHECK (organization_id = get_my_org_id() OR get_my_role() = 'admin');

-- ============================================================
-- RECIPE INGREDIENTS
-- ============================================================
CREATE POLICY "recipe_ing_select" ON recipe_ingredients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id
        AND (r.organization_id = get_my_org_id() OR get_my_role() = 'admin')
    )
  );
CREATE POLICY "recipe_ing_manage" ON recipe_ingredients FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id
        AND (r.organization_id = get_my_org_id() OR get_my_role() = 'admin')
    )
  );

-- ============================================================
-- DELIVERY NOTES (ALBARANES)
-- ============================================================
CREATE POLICY "dn_select" ON delivery_notes FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR get_my_org_type() = 'nave'
    OR EXISTS (
      SELECT 1 FROM orders o WHERE o.id = delivery_notes.order_id
        AND o.restaurant_id = get_my_org_id()
    )
  );
CREATE POLICY "dn_manage_nave" ON delivery_notes FOR ALL TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin')
  WITH CHECK (get_my_org_type() = 'nave' OR get_my_role() = 'admin');

-- ============================================================
-- DELIVERY NOTE ITEMS
-- ============================================================
CREATE POLICY "dni_select" ON delivery_note_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM delivery_notes dn
      JOIN orders o ON o.id = dn.order_id
      WHERE dn.id = delivery_note_items.delivery_note_id AND (
        get_my_role() = 'admin'
        OR get_my_org_type() = 'nave'
        OR o.restaurant_id = get_my_org_id()
      )
    )
  );
CREATE POLICY "dni_manage_nave" ON delivery_note_items FOR ALL TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin')
  WITH CHECK (get_my_org_type() = 'nave' OR get_my_role() = 'admin');

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================
CREATE POLICY "notif_select_own" ON notification_log FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR get_my_role() = 'admin' OR get_my_org_type() = 'nave');
CREATE POLICY "notif_insert_system" ON notification_log FOR INSERT TO authenticated
  WITH CHECK (get_my_org_type() = 'nave' OR get_my_role() = 'admin');
