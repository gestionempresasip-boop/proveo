-- ── Almacén propio de la nave ────────────────────────────────────────────────
-- Tabla independiente de products/nave_inventory para trackear materias primas,
-- envases, suministros y cualquier artículo que no se vende a restaurantes.

CREATE TABLE IF NOT EXISTS warehouse_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#6B7280',
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO warehouse_categories (name, color, order_index) VALUES
  ('Materias primas',    '#16A34A', 0),
  ('Envases y packaging','#2563EB', 1),
  ('Limpieza',           '#7C3AED', 2),
  ('Herramientas',       '#D97706', 3),
  ('Otros',              '#6B7280', 4)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS warehouse_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES warehouse_categories(id) ON DELETE SET NULL,
  name            text NOT NULL,
  description     text,
  unit            text NOT NULL DEFAULT 'unidad',
  current_stock   decimal(10,3) NOT NULL DEFAULT 0,
  min_stock       decimal(10,3) NOT NULL DEFAULT 0,
  supplier        text,
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE warehouse_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;

-- Categorías: lectura para todos los autenticados
CREATE POLICY "wh_categories_read" ON warehouse_categories
  FOR SELECT TO authenticated USING (true);

-- Artículos: solo la organización propietaria
CREATE POLICY "wh_items_own_org" ON warehouse_items
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
