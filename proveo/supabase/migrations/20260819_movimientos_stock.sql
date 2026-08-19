-- Historial real de movimientos de stock. Hasta ahora inventory_log solo
-- guardaba una "foto" cuando alguien editaba el stock a mano desde la
-- pantalla de Inventario — los cambios automáticos (pedidos, cancelaciones,
-- rectificaciones, devoluciones) no dejaban ningún rastro. Esta tabla
-- registra CADA cambio de nave_inventory.current_stock, venga de donde
-- venga, con el motivo y (si aplica) el pedido de origen.
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  delta decimal(10,3) NOT NULL,
  resulting_stock decimal(10,3) NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'pedido', 'cancelacion_pedido', 'reapertura_pedido', 'rectificacion',
    'devolucion_reutilizable', 'ajuste_manual', 'recuento'
  )),
  reference_order_id uuid REFERENCES orders(id),
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'nave_manager'));
-- INSERT directo (fuera de la función adjust_nave_stock) solo lo usan los
-- ajustes manuales desde la pantalla de Inventario, hechos por nave/admin.
CREATE POLICY "stock_movements_insert_manual" ON stock_movements FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'nave_manager'));

GRANT SELECT, INSERT ON public.stock_movements TO authenticated, service_role;

-- adjust_nave_stock pasa de "solo ajustar" a "ajustar y dejar constancia".
-- Se añaden 3 parámetros opcionales (con default) para no romper las
-- llamadas existentes que solo pasan product_id y delta — siguen
-- funcionando igual, solo que ahora también quedan registradas con motivo
-- 'ajuste_manual' por defecto. Al ser SECURITY DEFINER, el INSERT en
-- stock_movements no necesita que el llamante tenga permiso de escritura
-- directo (igual que ya pasaba con el UPDATE de nave_inventory).
DROP FUNCTION IF EXISTS adjust_nave_stock(uuid, numeric);

CREATE OR REPLACE FUNCTION adjust_nave_stock(
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

-- create_return llamaba a adjust_nave_stock solo con product_id y cantidad;
-- ahora le pasa también el motivo y el pedido de origen para que quede
-- igual de trazable que el resto. Mismo cuerpo que la versión anterior
-- (20260626_fix_estado_devolucion.sql), solo cambia esa llamada.
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

-- Para las alertas de stock bajo: poder saber a qué producto se refiere una
-- entrada de notification_log (el tipo 'stock_minimo' ya estaba previsto en
-- el esquema original, pero sin forma de saber de qué producto se trataba).
-- Esta tabla nunca se ha usado desde código (se confirmó por grep), así que
-- de paso se asegura el GRANT — en este proyecto los GRANT no salen gratis
-- solo por tener RLS y políticas (ya pasó con pending_carts/nave_fixed_costs).
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id);
GRANT SELECT, INSERT ON public.notification_log TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
