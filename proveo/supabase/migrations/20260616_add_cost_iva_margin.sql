-- Añade columnas de coste, IVA y margen a productos
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_rate   DECIMAL(5,4)  DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS margin     DECIMAL(5,4)  DEFAULT 0;
