-- ============================================================
-- PROVEO — Datos de ejemplo iniciales
-- ============================================================

-- Organizaciones
INSERT INTO organizations (id, name, type, phone, email, address) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Nave Obrador Central', 'nave', '600000001', 'nave@proveo.es', 'Calle Industrial 1, Madrid'),
  ('00000000-0000-0000-0000-000000000002', 'Restaurante La Tasca', 'restaurante', '600000002', 'latasca@proveo.es', 'Calle Mayor 10, Madrid'),
  ('00000000-0000-0000-0000-000000000003', 'Restaurante El Rincón', 'restaurante', '600000003', 'elrincon@proveo.es', 'Avenida Sol 5, Madrid'),
  ('00000000-0000-0000-0000-000000000004', 'Restaurante Casa Paco', 'restaurante', '600000004', 'casapaco@proveo.es', 'Plaza España 3, Madrid'),
  ('00000000-0000-0000-0000-000000000005', 'Restaurante La Bodega', 'restaurante', '600000005', 'labodega@proveo.es', 'Calle Luna 7, Madrid'),
  ('00000000-0000-0000-0000-000000000006', 'Restaurante El Jardín', 'restaurante', '600000006', 'eljardin@proveo.es', 'Paseo Verde 2, Madrid');

-- Categorías de productos
INSERT INTO product_categories (id, name, description, icon, color, order_index) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Carnes', 'Carnes y aves frescas', '🥩', '#7C2D12', 1),
  ('10000000-0000-0000-0000-000000000002', 'Pescados', 'Pescados y mariscos frescos', '🐟', '#1E40AF', 2),
  ('10000000-0000-0000-0000-000000000003', 'Verduras y Hortalizas', 'Verduras frescas de temporada', '🥦', '#16A34A', 3),
  ('10000000-0000-0000-0000-000000000004', 'Frutas', 'Frutas frescas', '🍎', '#DC2626', 4),
  ('10000000-0000-0000-0000-000000000005', 'Lácteos', 'Quesos, mantequilla, nata, leche', '🧀', '#D97706', 5),
  ('10000000-0000-0000-0000-000000000006', 'Elaboraciones de Nave', 'Platos y preparaciones propias del obrador', '👨‍🍳', '#7C3AED', 6),
  ('10000000-0000-0000-0000-000000000007', 'Salsas y Bases', 'Salsas, fondos y bases de cocina', '🍯', '#B45309', 7),
  ('10000000-0000-0000-0000-000000000008', 'Panadería', 'Pan, masas y bollería', '🍞', '#92400E', 8);

-- Productos de ejemplo
INSERT INTO products (id, category_id, name, description, price, unit, min_order_quantity, order_increment, visibility) VALUES
  -- Carnes
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Pollo entero', 'Pollo fresco de granja', 4.50, 'kg', 1, 0.5, 'todos'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Pechuga de pollo', 'Pechuga entera sin hueso', 6.80, 'kg', 0.5, 0.5, 'todos'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Lomo de cerdo', 'Lomo de cerdo fresco', 5.20, 'kg', 1, 0.5, 'todos'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Ternera para estofar', 'Carne de ternera troceada', 9.50, 'kg', 0.5, 0.5, 'todos'),
  -- Pescados
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Merluza filetes', 'Filetes de merluza fresca', 12.00, 'kg', 0.5, 0.5, 'todos'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'Salmón en lomos', 'Lomos de salmón atlántico', 14.50, 'kg', 0.5, 0.5, 'todos'),
  -- Verduras
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'Tomates pera', 'Tomates pera maduros', 2.20, 'kg', 1, 1, 'todos'),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 'Cebolla', 'Cebolla blanca', 1.10, 'kg', 1, 1, 'todos'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'Pimiento rojo', 'Pimientos rojos frescos', 2.50, 'kg', 1, 0.5, 'todos'),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', 'Lechuga romana', 'Lechuga romana fresca', 1.80, 'unidad', 1, 1, 'todos'),
  -- Lácteos
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000005', 'Nata para cocinar', 'Nata líquida 35% materia grasa', 3.20, 'l', 1, 0.5, 'todos'),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000005', 'Queso manchego', 'Queso manchego curado', 18.00, 'kg', 0.5, 0.25, 'todos'),
  -- Elaboraciones de Nave
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000006', 'Croquetas de jamón (bandeja 20u)', 'Croquetas caseras de jamón serrano', 12.50, 'bandeja', 1, 1, 'todos'),
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000006', 'Gazpacho artesano', 'Gazpacho andaluz sin conservantes', 4.80, 'l', 1, 1, 'todos'),
  -- Salsas
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000007', 'Salsa de tomate base', 'Tomate frito artesano en conserva', 3.50, 'kg', 1, 1, 'todos'),
  ('20000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000007', 'Fondo de pollo', 'Caldo de pollo casero concentrado', 5.00, 'l', 1, 0.5, 'todos'),
  -- Panadería
  ('20000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000008', 'Pan de baguette', 'Baguette artesana 250g', 0.90, 'unidad', 5, 5, 'todos'),
  ('20000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000008', 'Pan de hogaza', 'Hogaza de masa madre 800g', 3.20, 'unidad', 1, 1, 'todos');

-- Inventario inicial de la nave (todo con stock 0 para que la nave lo configure)
INSERT INTO nave_inventory (product_id, current_stock, min_stock)
SELECT id, 0, 5 FROM products;
