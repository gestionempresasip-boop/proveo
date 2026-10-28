-- Clientes externos: pueden pedir sus productos asignados aunque no haya stock, y la
-- nave se lo descuenta hasta dejarlo en negativo. Tampoco ven el stock de la nave.
--
-- Para el grupo (restaurantes y nave) todo sigue igual: el stock nunca baja de 0.
-- Solo los movimientos de PEDIDOS de un cliente externo (pedir, rectificar, eliminar,
-- restaurar...) pueden dejar el stock en negativo, y reponer siempre suma sin recortar
-- (así, al cancelar un pedido externo, el stock negativo se recupera exacto).

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
  v_allow_negative boolean := false;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT COALESCE(org.is_external, false) INTO v_allow_negative
    FROM orders o JOIN organizations org ON org.id = o.restaurant_id
    WHERE o.id = p_order_id;
    v_allow_negative := COALESCE(v_allow_negative, false);
  END IF;

  UPDATE nave_inventory
  SET current_stock = CASE
        WHEN p_delta >= 0 OR v_allow_negative THEN current_stock + p_delta
        ELSE GREATEST(current_stock + p_delta, 0)
      END,
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

-- Un cliente externo no puede leer el stock de la nave (ni por la API).
DROP POLICY IF EXISTS "nave_inv_select" ON nave_inventory;
CREATE POLICY "nave_inv_select" ON nave_inventory FOR SELECT TO authenticated
  USING (NOT get_my_org_is_external());

NOTIFY pgrst, 'reload schema';
