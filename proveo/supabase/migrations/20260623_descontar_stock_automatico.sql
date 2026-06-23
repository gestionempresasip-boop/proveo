-- Función para ajustar el stock de la nave de forma atómica (segura ante
-- pedidos simultáneos de varios restaurantes). SECURITY DEFINER porque los
-- restaurantes no tienen permiso de UPDATE sobre nave_inventory, pero sí
-- deben poder disparar este ajuste concreto al hacer/cancelar un pedido.
CREATE OR REPLACE FUNCTION adjust_nave_stock(p_product_id uuid, p_delta numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE nave_inventory
  SET current_stock = GREATEST(current_stock + p_delta, 0),
      last_updated = now(),
      last_restocked_at = CASE WHEN current_stock <= 0 AND current_stock + p_delta > 0 THEN now() ELSE last_restocked_at END
  WHERE product_id = p_product_id;
$$;

REVOKE ALL ON FUNCTION adjust_nave_stock(uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION adjust_nave_stock(uuid, numeric) TO authenticated;
