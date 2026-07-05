-- Copias de seguridad manuales de productos + categorías + stock (nave y
-- restaurantes). Cada fila guarda una foto completa en JSON, para poder
-- restaurar todo el catálogo/inventario a ese punto si algo se rompe.
-- Solo accesible desde la nave (o admin), porque afecta a todas las
-- organizaciones, no solo a la propia.

CREATE TABLE IF NOT EXISTS backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  data jsonb NOT NULL,
  products_count integer NOT NULL DEFAULT 0,
  categories_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backups_created_at_idx ON backups (created_at DESC);

ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backups_select_nave" ON backups FOR SELECT TO authenticated
  USING (get_my_role() = 'admin' OR get_my_org_type() = 'nave');

CREATE POLICY "backups_insert_nave" ON backups FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin' OR get_my_org_type() = 'nave');

CREATE POLICY "backups_delete_nave" ON backups FOR DELETE TO authenticated
  USING (get_my_role() = 'admin' OR get_my_org_type() = 'nave');

-- Mismo problema recurrente que product_category_links / inventory_closures:
-- las tablas nuevas no heredan los GRANT básicos de Postgres.
GRANT SELECT, INSERT, DELETE ON public.backups TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
