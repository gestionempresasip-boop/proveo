-- Registro de cambios de coste y precio de los productos.
-- Cada vez que cambia el coste o el precio de un producto (desde Editar, Precios en masa,
-- Costes… da igual el camino) se apunta una fila con el valor ANTERIOR y el NUEVO. Así se
-- conserva lo que costaba la tanda anterior y se puede ver qué ha subido o bajado y pasarlo
-- al programa de facturación (billed_at = cuándo se marcó como ya pasado).
-- Solo la nave / admin pueden verlo. Solo AÑADE una tabla, una función y un disparador:
-- no cambia ningún dato existente.

CREATE TABLE IF NOT EXISTS product_price_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  unit text,
  old_cost numeric,
  new_cost numeric,
  old_price numeric,
  new_price numeric,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  billed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_product_price_log_product ON product_price_log(product_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_price_log_pending ON product_price_log(changed_at DESC) WHERE billed_at IS NULL;

ALTER TABLE product_price_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_price_log_nave" ON product_price_log;
CREATE POLICY "product_price_log_nave" ON product_price_log
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'nave_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'nave_manager'));

GRANT SELECT, UPDATE ON public.product_price_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_price_log TO service_role;

CREATE OR REPLACE FUNCTION log_product_price_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF round(coalesce(old.cost_price, 0)::numeric, 4) IS DISTINCT FROM round(coalesce(new.cost_price, 0)::numeric, 4)
     OR round(coalesce(old.price, 0)::numeric, 4) IS DISTINCT FROM round(coalesce(new.price, 0)::numeric, 4) THEN
    INSERT INTO product_price_log (product_id, product_name, unit, old_cost, new_cost, old_price, new_price, changed_by)
    VALUES (new.id, new.name, new.unit, old.cost_price, new.cost_price, old.price, new.price, auth.uid());
  END IF;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- El registro nunca debe impedir que se guarde un producto.
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_price_change ON products;
CREATE TRIGGER trg_log_product_price_change
  AFTER UPDATE OF cost_price, price ON products
  FOR EACH ROW EXECUTE FUNCTION log_product_price_change();

NOTIFY pgrst, 'reload schema';
