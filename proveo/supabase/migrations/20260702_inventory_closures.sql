-- Cierres de inventario valorado: una "foto" del stock (nave o restaurante)
-- en el momento de cerrar, etiquetada con el periodo elegido (día/mes/año/
-- personalizado) y valorada al precio de coste de cada producto.
-- No es un cálculo retroactivo: el stock guardado es el que había en el
-- momento de pulsar "Cerrar inventario", con la etiqueta que el usuario
-- le puso a ese periodo.

CREATE TABLE IF NOT EXISTS inventory_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  period_type text NOT NULL CHECK (period_type IN ('dia','mes','anual','personalizado')),
  period_label text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  total_items integer NOT NULL DEFAULT 0,
  total_value decimal(12,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_closure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id uuid NOT NULL REFERENCES inventory_closures(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  category_name text,
  unit text NOT NULL,
  stock_qty decimal(10,3) NOT NULL,
  cost_price decimal(10,4),
  line_value decimal(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS inventory_closures_org_date_idx ON inventory_closures (organization_id, date_to DESC);
CREATE INDEX IF NOT EXISTS inventory_closure_items_closure_idx ON inventory_closure_items (closure_id);

ALTER TABLE inventory_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_closure_items ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que inventory_log: cada organización ve y crea solo lo suyo,
-- admin ve y crea de todas.
CREATE POLICY "inventory_closures_select_own" ON inventory_closures FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id() OR get_my_role() = 'admin');

CREATE POLICY "inventory_closures_insert_own" ON inventory_closures FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id() OR get_my_role() = 'admin');

CREATE POLICY "inventory_closures_delete_own" ON inventory_closures FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id() OR get_my_role() = 'admin');

CREATE POLICY "inventory_closure_items_select_own" ON inventory_closure_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM inventory_closures c
    WHERE c.id = closure_id AND (c.organization_id = get_my_org_id() OR get_my_role() = 'admin')
  ));

CREATE POLICY "inventory_closure_items_insert_own" ON inventory_closure_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM inventory_closures c
    WHERE c.id = closure_id AND (c.organization_id = get_my_org_id() OR get_my_role() = 'admin')
  ));
