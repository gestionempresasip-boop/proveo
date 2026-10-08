-- Costes reales de producción de la nave: ficha de coste por producto
-- (materia prima + mano de obra + estructura + envasado, transporte...) y los
-- ajustes de la nave para repartir sus costes (personal de producción,
-- horas por persona, rendimiento, costes indirectos).
--
-- Solo añade tablas nuevas. Como app_notifications y org_cost_items: RLS activado
-- SIN políticas (solo las usan server actions con la service role, tras
-- comprobar nave/admin y el código de acceso), con su GRANT explícito.
CREATE TABLE IF NOT EXISTS nave_cost_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  labor_item_ids uuid[] NOT NULL DEFAULT '{}',
  hours_per_person numeric NOT NULL DEFAULT 160,
  efficiency_pct numeric NOT NULL DEFAULT 80,
  indirect_pct numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_cost_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  yield_qty numeric NOT NULL DEFAULT 1,
  people numeric NOT NULL DEFAULT 1,
  minutes numeric NOT NULL DEFAULT 0,
  ingredients jsonb NOT NULL DEFAULT '[]',
  extras jsonb NOT NULL DEFAULT '[]',
  markup_pct numeric NOT NULL DEFAULT 30,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_cost_sheets_product ON product_cost_sheets(product_id) WHERE product_id IS NOT NULL;

ALTER TABLE nave_cost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_cost_sheets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nave_cost_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_cost_sheets TO service_role;

NOTIFY pgrst, 'reload schema';
