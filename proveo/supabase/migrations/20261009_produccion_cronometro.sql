-- Cronómetro de producción de la nave: cada tanda (run) se cronometra por
-- etapas (preparación, cocción, enfriado, envasado...), con las personas que
-- participan. Sirve para medir el tiempo de trabajo REAL de cada producto y
-- cuánto tarda en estar terminado (incluidas las esperas de horno y enfriado).
--
-- Solo añade tablas nuevas. Como el resto de tablas de la nave: RLS activado
-- SIN políticas (solo las usan server actions con la service role, tras
-- comprobar que quien llama es de la nave), con su GRANT explícito.
CREATE TABLE IF NOT EXISTS production_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  station text,
  status text NOT NULL DEFAULT 'en_curso' CHECK (status IN ('en_curso', 'terminada', 'cancelada')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  units_produced numeric,
  units_wasted numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_stage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
  stage text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('personal', 'espera', 'pausa')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS production_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES production_workers(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_production_runs_status ON production_runs(organization_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_runs_product ON production_runs(product_id, status);
CREATE INDEX IF NOT EXISTS idx_production_stage_logs_run ON production_stage_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_production_participants_run ON production_participants(run_id);

ALTER TABLE production_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_stage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_participants ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_workers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_stage_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_participants TO service_role;

NOTIFY pgrst, 'reload schema';
