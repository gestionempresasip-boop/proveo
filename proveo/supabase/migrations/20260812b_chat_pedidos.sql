-- Chat por pedido entre restaurante y nave: un hilo de mensajes atado a
-- cada orders.id, para poder responder en contexto (no un chat suelto).
CREATE TABLE order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

-- Mismo criterio que "orders_select", pero restringiendo el lado nave a
-- admin/nave_manager (no cocineros: no deben ver conversaciones de pedidos,
-- eso queda fuera de su rol — igual que ya hicimos en production_tasks).
CREATE POLICY "order_messages_select" ON order_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = order_messages.order_id AND (
        get_my_role() IN ('admin', 'nave_manager')
        OR o.restaurant_id = get_my_org_id()
      )
    )
  );
CREATE POLICY "order_messages_insert" ON order_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders o WHERE o.id = order_messages.order_id AND (
        get_my_role() IN ('admin', 'nave_manager')
        OR o.restaurant_id = get_my_org_id()
      )
    )
  );

GRANT SELECT, INSERT ON public.order_messages TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
