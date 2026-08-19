-- La migración 20260819_movimientos_stock.sql se cortó a mitad (el editor
-- de Supabase paró en el primer error al reejecutarla). Este script repara
-- el estado sea cual sea el punto exacto en que se quedó: cada paso es
-- seguro de repetir aunque ya se hubiera aplicado antes.

-- 1) Índice, RLS y políticas de stock_movements (por si la tabla se creó
--    pero se quedó sin esto).
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'nave_manager'));

DROP POLICY IF EXISTS "stock_movements_insert_manual" ON stock_movements;
CREATE POLICY "stock_movements_insert_manual" ON stock_movements FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'nave_manager'));

GRANT SELECT, INSERT ON public.stock_movements TO authenticated, service_role;

-- 2) adjust_nave_stock: se borran las dos firmas posibles (la vieja de 2
--    argumentos y la nueva de 5, por si ya se llegó a crear) y se deja una
--    sola versión limpia.
DROP FUNCTION IF EXISTS adjust_nave_stock(uuid, numeric);
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
BEGIN
  UPDATE nave_inventory
  SET current_stock = GREATEST(current_stock + p_delta, 0),
      last_updated = now(),
      last_restocked_at = CASE WHEN current_stock <= 0 AND current_stock + p_delta > 0 THEN now() ELSE last_restocked_at END
  WHERE product_id = p_product_id
  RETURNING current_stock INTO v_new_stock;

  IF v_new_stock IS NOT NULL THEN
    INSERT INTO stock_movements (product_id, delta, resulting_stock, reason, reference_order_id, notes, created_by)
    VALUES (p_product_id, p_delta, v_new_stock, p_reason, p_order_id, p_notes, auth.uid());
  END IF;

  RETURN v_new_stock;
END;
$$;

REVOKE ALL ON FUNCTION adjust_nave_stock(uuid, numeric, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION adjust_nave_stock(uuid, numeric, text, uuid, text) TO authenticated;

-- 3) create_return: CREATE OR REPLACE ya es idempotente de por sí.
CREATE OR REPLACE FUNCTION create_return(p_order_id uuid, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_status text;
  v_caller_org uuid;
  v_caller_org_type text;
  v_caller_role text;
  v_note_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_reason text;
  v_delivered numeric;
  v_already_returned numeric;
BEGIN
  SELECT restaurant_id, status INTO v_restaurant_id, v_status FROM orders WHERE id = p_order_id;
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  IF v_status NOT IN ('entregado', 'enviado') THEN
    RAISE EXCEPTION 'Solo se pueden devolver artículos de un pedido ya entregado';
  END IF;

  SELECT p.organization_id, p.role, o.type
  INTO v_caller_org, v_caller_role, v_caller_org_type
  FROM profiles p JOIN organizations o ON o.id = p.organization_id
  WHERE p.id = auth.uid();

  IF v_caller_org IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF v_caller_org <> v_restaurant_id AND v_caller_org_type <> 'nave' AND v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Sin permisos para devolver artículos de este pedido';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No hay artículos para devolver';
  END IF;

  INSERT INTO delivery_notes (order_id, type) VALUES (p_order_id, 'devolucion')
  RETURNING id INTO v_note_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty        := (v_item->>'quantity')::numeric;
    v_reason     := v_item->>'reason';

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad de devolución inválida';
    END IF;
    IF v_reason NOT IN ('reutilizable', 'no_utilizable') THEN
      RAISE EXCEPTION 'Motivo de devolución inválido';
    END IF;

    SELECT COALESCE(SUM(dni.delivered_quantity), 0) INTO v_delivered
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.order_id = p_order_id AND dn.type = 'entrega' AND dni.product_id = v_product_id;

    SELECT COALESCE(SUM(dni.delivered_quantity), 0) INTO v_already_returned
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.order_id = p_order_id AND dn.type = 'devolucion' AND dni.product_id = v_product_id;

    IF v_already_returned + v_qty > v_delivered THEN
      RAISE EXCEPTION 'No puedes devolver más cantidad de la entregada';
    END IF;

    INSERT INTO delivery_note_items (
      delivery_note_id, product_id, delivered_quantity, unit, unit_price, total_price,
      return_reason, lot_number
    ) VALUES (
      v_note_id, v_product_id, v_qty, v_item->>'unit',
      (v_item->>'unit_price')::numeric, v_qty * (v_item->>'unit_price')::numeric,
      v_reason, v_item->>'lot_number'
    );

    IF v_reason = 'reutilizable' THEN
      PERFORM adjust_nave_stock(v_product_id, v_qty, p_reason => 'devolucion_reutilizable', p_order_id => p_order_id);
    END IF;
  END LOOP;

  RETURN v_note_id;
END;
$$;

-- 4) notification_log.product_id (por si no se llegó a añadir).
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id);
GRANT SELECT, INSERT ON public.notification_log TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
