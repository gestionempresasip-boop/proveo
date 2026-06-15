-- ============================================================
-- PROVEO — Migración inicial: esquema completo de la base de datos
-- ============================================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ORGANIZACIONES (nave + restaurantes)
-- ============================================================
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('nave', 'restaurante')),
  phone text,
  email text,
  address text,
  logo_url text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PERFILES DE USUARIO (extiende auth.users de Supabase)
-- ============================================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  role text NOT NULL CHECK (role IN ('admin', 'nave_manager', 'restaurante_manager', 'restaurante_staff')),
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- CATEGORÍAS DE PRODUCTOS
-- ============================================================
CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  color text DEFAULT '#1B4332',
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PRODUCTOS
-- ============================================================
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES product_categories(id),
  name text NOT NULL,
  description text,
  image_url text,
  price decimal(10,2) NOT NULL DEFAULT 0,
  unit text NOT NULL CHECK (unit IN ('kg','g','l','ml','unidad','caja','bandeja')),
  min_order_quantity decimal(10,3) DEFAULT 1,
  order_increment decimal(10,3) DEFAULT 1,
  visibility text NOT NULL DEFAULT 'todos' CHECK (visibility IN ('todos','restringido')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ACCESO RESTRINGIDO A PRODUCTOS POR RESTAURANTE
-- (solo para productos con visibility = 'restringido')
-- ============================================================
CREATE TABLE product_restaurant_access (
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, organization_id)
);

-- ============================================================
-- PEDIDOS
-- ============================================================
CREATE SEQUENCE order_number_seq START 1000;

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number integer UNIQUE DEFAULT nextval('order_number_seq'),
  restaurant_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pendiente' CHECK (
    status IN ('pendiente','en_preparacion','listo','entregado','cancelado')
  ),
  notes text,
  total_price decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- LÍNEAS DEL PEDIDO
-- ============================================================
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity decimal(10,3) NOT NULL,
  unit text NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  notes text
);

-- ============================================================
-- INVENTARIO DE LA NAVE
-- ============================================================
CREATE TABLE nave_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES products(id),
  current_stock decimal(10,3) DEFAULT 0,
  min_stock decimal(10,3) DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

-- ============================================================
-- INVENTARIO DE CADA RESTAURANTE
-- ============================================================
CREATE TABLE restaurant_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  product_id uuid NOT NULL REFERENCES products(id),
  current_stock decimal(10,3) DEFAULT 0,
  min_stock decimal(10,3) DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE (organization_id, product_id)
);

-- ============================================================
-- ESCANDALLOS (RECETAS)
-- ============================================================
CREATE TABLE recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  description text,
  image_url text,
  category text,
  servings decimal(10,2) DEFAULT 1,
  sale_price decimal(10,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INGREDIENTES DE RECETA
-- ============================================================
CREATE TABLE recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity decimal(10,3) NOT NULL,
  unit text NOT NULL,
  notes text
);

-- ============================================================
-- ALBARANES DE ENTREGA
-- ============================================================
CREATE SEQUENCE delivery_note_number_seq START 1;

CREATE TABLE delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  note_number integer UNIQUE DEFAULT nextval('delivery_note_number_seq'),
  delivered_by text,
  delivered_at timestamptz DEFAULT now(),
  pdf_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- LÍNEAS DEL ALBARÁN
-- ============================================================
CREATE TABLE delivery_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  ordered_quantity decimal(10,3),
  delivered_quantity decimal(10,3) NOT NULL,
  unit text NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL
);

-- ============================================================
-- LOG DE NOTIFICACIONES
-- ============================================================
CREATE TABLE notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text CHECK (type IN ('nuevo_pedido','pedido_listo','stock_minimo','albaran_generado')),
  order_id uuid REFERENCES orders(id),
  recipient_id uuid REFERENCES profiles(id),
  channel text CHECK (channel IN ('email','whatsapp')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
