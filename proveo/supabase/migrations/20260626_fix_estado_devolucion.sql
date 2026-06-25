-- create_return comprobaba status = 'entregado', pero el valor real que usa
-- la app para un pedido ya enviado es 'enviado' (no 'entregado'). Por eso
-- la función rechazaba siempre la devolución sin que se viera ningún error
-- claro en la UI. Aceptamos ambos valores por si la base de datos tiene
-- pedidos antiguos con el estado legacy.
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
      PERFORM adjust_nave_stock(v_product_id, v_qty);
    END IF;
  END LOOP;

  RETURN v_note_id;
END;
$$;
