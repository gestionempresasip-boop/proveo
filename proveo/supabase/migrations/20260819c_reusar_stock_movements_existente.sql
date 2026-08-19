-- CORRECCIÓN IMPORTANTE: la tabla stock_movements ya existía desde antes de
-- hoy (del módulo Almacén, retirado en su día — ver commit c079543 — pero
-- esta tabla en concreto nunca se llegó a borrar y llevaba semanas
-- registrando movimientos reales con su propio esquema: organization_id,
-- item_name, movement_type, quantity, stock_after, reference_type,
-- reference_id). Las migraciones de hoy (20260819 y 20260819b) sin saberlo
-- sustituyeron la función que ya escribía ahí por una que apunta a columnas
-- que no existen — desde entonces los pedidos dejaron de descontar stock de
-- verdad (el INSERT fallaba y hacía rollback de todo el ajuste).
--
-- Esta migración NO toca la estructura de stock_movements (se deja tal cual
-- estaba, con sus datos históricos intactos) y reescribe adjust_nave_stock
-- para volver a escribir ahí, usando sus columnas reales.
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

    -- movement_type solo admite 6 valores fijos (constraint ya existente);
    -- p_reason (más detallado) se conserva igual en notes si hace falta.
    v_movement_type := CASE
      WHEN p_reason IN ('pedido', 'reapertura_pedido') THEN 'venta'
      WHEN p_reason IN ('cancelacion_pedido', 'devolucion_reutilizable') THEN 'entrada_manual'
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

-- RLS de stock_movements: se asegura que solo nave/admin puedan LEER
-- movimientos (por si no tenía políticas, o para no dejarlo abierto a
-- cualquier autenticado). Los INSERT automáticos (vía la función, SECURITY
-- DEFINER) no dependen de esto; el INSERT manual desde Inventario sí.
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'nave_manager'));

DROP POLICY IF EXISTS "stock_movements_insert_manual" ON stock_movements;
CREATE POLICY "stock_movements_insert_manual" ON stock_movements FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'nave_manager'));

GRANT SELECT, INSERT ON public.stock_movements TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
