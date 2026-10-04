-- Avisos dentro de la app (campana + aviso emergente) para nave y restaurantes:
-- pedido nuevo, pedido hecho/enviado/cancelado, stock agotado o bajo, chat...
--
-- La tabla solo la leen/escriben las server actions con la service role (el
-- navegador nunca habla directamente con ella), por eso se activa RLS SIN
-- ninguna política: anon y authenticated quedan sin acceso, y service_role
-- (que ignora RLS) necesita su GRANT explícito (el "GRANT gotcha" de este
-- proyecto: sin él, "permission denied for table").
CREATE TABLE IF NOT EXISTS app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'danger')),
  title text NOT NULL,
  body text,
  link text,
  order_id uuid,
  dedupe_key text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_target ON app_notifications(target_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_dedupe ON app_notifications(dedupe_key, created_at DESC);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.app_notifications TO service_role;

NOTIFY pgrst, 'reload schema';
