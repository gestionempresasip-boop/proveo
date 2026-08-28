-- "Eliminar" un pedido pasa a ser un borrado suave (deleted_at/deleted_by)
-- en vez de borrar la fila de verdad: permite verlo en una papelera y
-- restaurarlo si fue un error. También se extiende adjust_nave_stock para
-- que "eliminar" devuelva el stock (como cancelar) y "restaurar" lo vuelva
-- a descontar — si no, un pedido eliminado por error deja el stock
-- descuadrado (de más) hasta que alguien lo note.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at);

DROP FUNCTION IF EXISTS adjust_nave_stock(uuid, numeric, text, uuid, text);

CREATE FUNCTION adjust_nave_stock(
  p_product_id uuid,
  p_delta numeric,
  p_reason text DEFAULT 'ajuste_manual',
  p_order_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_stock numeric;
  v_org_id uuid;
  v_item_name text;
  v_movement_type text;
BEGIN
  UPDATE nave_inventory
  SET current_stock = GREATEST(current_stock + p_delta, 0),
      last_updated = now(),
      last_restocked_at = CASE WHEN current_stock <= 0 AND current_stock + p_delta > 0 THEN now() ELSE last_restocked_at END
  WHERE product_id = p_product_id
  RETURNING current_stock INTO v_new_stock;

  IF v_new_stock IS NOT NULL THEN
    SELECT id INTO v_org_id FROM organizations WHERE type = 'nave' LIMIT 1;
    SELECT name INTO v_item_name FROM products WHERE id = p_product_id;

    v_movement_type := CASE
      WHEN p_reason IN ('pedido', 'reapertura_pedido', 'restauracion_pedido') THEN 'venta'
      WHEN p_reason IN ('cancelacion_pedido', 'devolucion_reutilizable', 'eliminacion_pedido') THEN 'entrada_manual'
      WHEN p_reason = 'rectificacion' THEN (CASE WHEN p_delta < 0 THEN 'venta' ELSE 'entrada_manual' END)
      WHEN p_reason = 'recuento' THEN (CASE WHEN p_delta < 0 THEN 'merma' ELSE 'entrada_manual' END)
      ELSE 'entrada_manual'
    END;

    INSERT INTO stock_movements (
      organization_id, product_id, item_name, movement_type, quantity, stock_after,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_org_id, p_product_id, COALESCE(v_item_name, 'Producto'), v_movement_type, p_delta, v_new_stock,
      CASE WHEN p_order_id IS NOT NULL THEN 'order' ELSE NULL END, p_order_id, p_notes, auth.uid()
    );
  END IF;

  RETURN v_new_stock;
END;
$$;

REVOKE ALL ON FUNCTION adjust_nave_stock(uuid, numeric, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION adjust_nave_stock(uuid, numeric, text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
