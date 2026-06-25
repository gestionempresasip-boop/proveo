-- El historial de stock (pestaña "Historial" en Inventario) nunca llegó a
-- guardar nada porque esta tabla no existía: el código ya tenía un
-- try/catch "graceful" alrededor del insert ("la tabla puede no existir
-- aún") que silenciaba el error en cada guardado de stock.
CREATE TABLE IF NOT EXISTS inventory_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  product_unit text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  organization_name text NOT NULL,
  stock_value decimal(10,3) NOT NULL,
  min_stock decimal(10,3) NOT NULL,
  notes text,
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_log_org_date_idx ON inventory_log (organization_id, recorded_at DESC);

ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;

-- Cada organización ve y registra solo su propio historial (admin ve todo).
CREATE POLICY "inventory_log_select_own" ON inventory_log FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id() OR get_my_role() = 'admin');

CREATE POLICY "inventory_log_insert_own" ON inventory_log FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id() OR get_my_role() = 'admin');
