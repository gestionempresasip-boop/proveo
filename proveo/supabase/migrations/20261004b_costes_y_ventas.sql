-- Costes operativos (fijos y variables) de la nave y de los restaurantes, y
-- ventas mensuales de cada restaurante: lo que hace falta para calcular el
-- beneficio y la rentabilidad en Informes.
--
--  org_cost_items.kind   'fijo' | 'variable'
--  org_cost_items.mode   'monthly' (importe en € al mes) | 'percent' (% de las ventas)
--
-- La nave ya tiene sus costes fijos en nave_fixed_costs (no se toca); aquí
-- van sus "otros costes variables" (transporte, envases...) y todos los
-- costes de los restaurantes.
--
-- Igual que app_notifications: solo se accede desde server actions con la
-- service role (que comprueban que quien llama es nave/admin), así que RLS
-- activado sin políticas + GRANT explícito a service_role.
CREATE TABLE IF NOT EXISTS org_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('fijo', 'variable')),
  mode text NOT NULL DEFAULT 'monthly' CHECK (mode IN ('monthly', 'percent')),
  name text NOT NULL,
  value numeric(12, 2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_cost_items_org ON org_cost_items(organization_id);

CREATE TABLE IF NOT EXISTS restaurant_monthly_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month date NOT NULL,
  amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

ALTER TABLE org_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_monthly_sales ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_cost_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_monthly_sales TO service_role;

NOTIFY pgrst, 'reload schema';
