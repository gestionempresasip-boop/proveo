-- El restaurante indica, antes de enviar el pedido, si es para Sala o
-- para Cocina. Se ve reflejado en el albarán de entrega.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS destination text
  CHECK (destination IN ('sala', 'cocina'));
