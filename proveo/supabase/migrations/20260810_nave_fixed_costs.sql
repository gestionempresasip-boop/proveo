-- Costes fijos de la nave (personal, suministros, alquiler, préstamos, otros),
-- para poder calcular punto muerto y cuenta de resultados en Informes.
-- Son datos financieros sensibles: solo visibles/editables por la nave o admin,
-- a diferencia de nave_inventory que cualquiera puede consultar.
CREATE TABLE nave_fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('personal', 'suministros', 'alquiler', 'prestamos', 'seguros', 'otros')),
  name text NOT NULL,
  monthly_amount decimal(10,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE nave_fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_costs_select_nave" ON nave_fixed_costs FOR SELECT TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin');
CREATE POLICY "fixed_costs_manage_nave" ON nave_fixed_costs FOR ALL TO authenticated
  USING (get_my_org_type() = 'nave' OR get_my_role() = 'admin')
  WITH CHECK (get_my_org_type() = 'nave' OR get_my_role() = 'admin');
