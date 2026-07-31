-- ============================================================
-- Soporte de pedido por cajón
-- Ejecutar en Supabase SQL Editor ANTES de desplegar el código
-- ============================================================

-- 1. Productos: flag + unidades aproximadas por cajón
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allows_box_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS box_units        integer;

-- 2. Líneas de pedido: modo de pedido + datos del cajón
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS order_mode            text    NOT NULL DEFAULT 'unidad',
  ADD COLUMN IF NOT EXISTS box_count             integer,
  ADD COLUMN IF NOT EXISTS box_approximate_units integer,
  ADD COLUMN IF NOT EXISTS box_exact_units       integer;

-- Restricción opcional (no bloquea si falla en Supabase Free)
DO $$ BEGIN
  ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_mode_check
    CHECK (order_mode IN ('unidad', 'cajon'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
