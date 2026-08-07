-- ============================================================================
-- Cesta pendiente compartida por restaurante: si alguien empieza un pedido
-- en un dispositivo y otra persona del mismo restaurante entra desde otro
-- (móvil en la cocina, tablet en la barra...), lo ve y puede terminarlo.
--
-- Antes el carrito solo vivía en localStorage del navegador que lo creó —
-- invisible para cualquier otro dispositivo. Una fila por restaurante
-- (organization_id UNIQUE) porque el pedido es del restaurante, no de la
-- persona que lo está montando.
-- ============================================================================

CREATE TABLE pending_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  cart jsonb NOT NULL DEFAULT '{}'::jsonb,
  cart_modes jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  destination text,
  updated_by uuid REFERENCES profiles(id),
  updated_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pending_carts ENABLE ROW LEVEL SECURITY;

-- Cada restaurante ve y edita solo la cesta pendiente de su propia
-- organización (admin ve todas, igual que el resto de tablas de la app).
CREATE POLICY "pending_carts_own_org" ON pending_carts FOR ALL TO authenticated
  USING      (organization_id = get_my_org_id() OR get_my_role() = 'admin')
  WITH CHECK (organization_id = get_my_org_id() OR get_my_role() = 'admin');
