-- El registro de cambios (product_price_log) apunta también el MARGEN: lo que valía antes y lo que vale ahora.
-- Antes solo se disparaba al cambiar el coste o el precio; ahora también si cambia el margen.
-- Solo AÑADE dos columnas y vuelve a definir la función y el disparador del registro.
-- No cambia ningún dato existente. Los cambios antiguos se quedan sin margen guardado
-- (la pantalla lo calcula a partir del coste y el precio de esa fecha).

ALTER TABLE product_price_log ADD COLUMN IF NOT EXISTS old_margin numeric;
ALTER TABLE product_price_log ADD COLUMN IF NOT EXISTS new_margin numeric;

CREATE OR REPLACE FUNCTION log_product_price_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF round(coalesce(old.cost_price, 0)::numeric, 4) IS DISTINCT FROM round(coalesce(new.cost_price, 0)::numeric, 4)
     OR round(coalesce(old.price, 0)::numeric, 4) IS DISTINCT FROM round(coalesce(new.price, 0)::numeric, 4)
     OR round(coalesce(old.margin, 0)::numeric, 4) IS DISTINCT FROM round(coalesce(new.margin, 0)::numeric, 4) THEN
    INSERT INTO product_price_log (product_id, product_name, unit, old_cost, new_cost, old_price, new_price, old_margin, new_margin, changed_by)
    VALUES (new.id, new.name, new.unit, old.cost_price, new.cost_price, old.price, new.price, old.margin, new.margin, auth.uid());
  END IF;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- El registro nunca debe impedir que se guarde un producto.
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_price_change ON products;
CREATE TRIGGER trg_log_product_price_change
  AFTER UPDATE OF cost_price, price, margin ON products
  FOR EACH ROW EXECUTE FUNCTION log_product_price_change();

NOTIFY pgrst, 'reload schema';
