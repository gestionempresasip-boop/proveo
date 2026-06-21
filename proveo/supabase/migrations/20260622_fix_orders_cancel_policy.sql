-- Corrige la política de actualización de pedidos: el restaurante podía
-- iniciar la actualización mientras el pedido estaba "pendiente" (USING),
-- pero al no haber WITH CHECK explícito, Postgres reutilizaba la misma
-- condición para el resultado final, y como el nuevo estado ya no es
-- "pendiente", la actualización se rechazaba silenciosamente.
-- Ahora se permite explícitamente que el restaurante cancele su propio
-- pedido (pendiente -> cancelado), y nada más.

DROP POLICY IF EXISTS "orders_update_nave_admin" ON orders;

CREATE POLICY "orders_update_nave_admin" ON orders FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR get_my_org_type() = 'nave'
    OR (restaurant_id = get_my_org_id() AND status = 'pendiente')
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR get_my_org_type() = 'nave'
    OR (restaurant_id = get_my_org_id() AND status = 'cancelado')
  );
