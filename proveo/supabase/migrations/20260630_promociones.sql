-- Promociones / sugerencias que la nave comparte con los restaurantes
-- (productos que caducan pronto, sugerencias del día, ofertas especiales, etc.)
CREATE TABLE IF NOT EXISTS promotions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       text        NOT NULL DEFAULT 'Oferta especial',
  notes       text,
  expires_at  date,
  created_by  uuid        REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Solo una promoción activa por producto a la vez
CREATE UNIQUE INDEX IF NOT EXISTS promotions_product_id_key
  ON promotions (product_id);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer
CREATE POLICY "promotions_select" ON promotions
  FOR SELECT TO authenticated USING (true);

-- Solo usuarios de la nave pueden crear / modificar / eliminar
CREATE POLICY "promotions_nave_write" ON promotions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = auth.uid() AND o.type = 'nave'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = auth.uid() AND o.type = 'nave'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON promotions TO authenticated;
