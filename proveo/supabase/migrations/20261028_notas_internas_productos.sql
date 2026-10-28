-- Notas internas de producto (coste de la tanda, tiempo de preparación, proveedor…).
-- Solo las puede leer y escribir la nave (admin / nave_manager). Los restaurantes NO las ven:
-- por eso viven en una tabla aparte con su propio RLS y no como columna de products
-- (a una columna de products podría llegar cualquier restaurante con su sesión).
-- Solo AÑADE una tabla nueva: no toca nada existente.

CREATE TABLE IF NOT EXISTS product_internal_notes (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE product_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_internal_notes_nave" ON product_internal_notes;
CREATE POLICY "product_internal_notes_nave" ON product_internal_notes
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'nave_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'nave_manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_internal_notes TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
