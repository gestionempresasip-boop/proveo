# CLAUDE.md — Proveo: Sistema de Gestión para Restaurantes y Nave-Obrador

## 1. Visión del Proyecto

**Nombre de la app:** Proveo  
**Subtítulo:** Gestión de productos, pedidos e inventario para grupos de restauración  
**Paleta de colores sugerida:**
- Primary: `#1B4332` (verde oscuro — frescura, cocina, ingredientes)
- Accent: `#F59E0B` (ámbar dorado — calidez, restauración)
- Background: `#FAFAF8` (blanco cálido)
- Text: `#1C1C1E` (gris muy oscuro)
- Surface: `#FFFFFF`
- Danger/alert: `#DC2626`
- Success: `#16A34A`

**Descripción:** App web responsive para gestionar pedidos, inventario y escandallos entre 5 restaurantes y una nave-obrador central. La nave actúa como proveedor principal. Los restaurantes hacen pedidos desde la app, la nave los recibe y prepara. Incluye gestión de inventario, escandallos con cálculo de costes, historial, estadísticas y generación de albaranes en PDF.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR, rutas API, rendimiento |
| Estilos | Tailwind CSS + Shadcn/ui | Diseño rápido y consistente |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + Realtime) | BaaS completo, fácil de usar |
| Formularios | React Hook Form + Zod | Validación robusta |
| Peticiones | TanStack Query (React Query) | Cache y sincronización de datos |
| Gráficas | Recharts | Estadísticas e informes |
| PDF | @react-pdf/renderer | Generación de albaranes |
| Email | Resend | Notificaciones por email |
| WhatsApp | Twilio / Fonnte | Notificaciones pedidos |
| Hosting | Render.com | Deploy web service Node.js |
| CI/CD | GitHub → Render auto-deploy | Push a main = deploy automático |

---

## 3. Roles de Usuario

| Rol | Descripción | Permisos principales |
|-----|------------|----------------------|
| `admin` | Administrador general | Todo: usuarios, productos, precios, escandallos, inventario, informes |
| `nave_manager` | Gestor de la nave-obrador | Ver/gestionar pedidos entrantes, inventario nave, albaranes, escandallos nave |
| `restaurante_manager` | Responsable de un restaurante | Hacer pedidos, ver historial, gestionar inventario restaurante, escandallos propios |
| `restaurante_staff` | Personal de un restaurante | Solo hacer pedidos (sin acceso a escandallos ni inventario completo) |

---

## 4. Entidades del Negocio

### 4.1 Organizations (Organizaciones)
- **1 nave-obrador** (tipo: `nave`)
- **5 restaurantes** (tipo: `restaurante`)
- Cada organización tiene sus propios usuarios

### 4.2 Productos
- Tienen: nombre, imagen, precio, unidad de medida, categoría
- Unidades posibles: `kg`, `g`, `l`, `ml`, `unidad`, `caja`, `bandeja`
- Visibilidad: `todos` (general) o `restringido` (solo ciertos restaurantes)
- Origen: `nave` (lo produce la nave) o `proveedor_externo` (futuro)

### 4.3 Pedidos
- Un restaurante crea un pedido con productos y cantidades
- El pedido llega a la nave directamente (sin confirmación previa)
- La nave lo prepara y genera un albarán al entregar
- Estados del pedido: `pendiente` → `en_preparacion` → `listo` → `entregado`

### 4.4 Albaranes
- Se genera cuando la nave entrega el pedido
- Incluye: productos, cantidades entregadas vs. pedidas, precios, totales
- Exportable a PDF
- Reemplaza la factura (la facturación formal es externa)

### 4.5 Escandallos (Recetas)
- Disponibles para nave Y restaurantes
- Cada receta: nombre, foto, raciones, ingredientes con cantidades
- Cálculo automático de coste por ración/plato
- Precio de venta y margen de beneficio

### 4.6 Inventario
- **Nave**: stock de cada producto que tiene disponible + alertas de mínimo
- **Restaurante**: stock de cada producto en su almacén + alertas de mínimo

---

## 5. Esquema de Base de Datos (Supabase / PostgreSQL)

```sql
-- ORGANIZACIONES (nave + restaurantes)
organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('nave', 'restaurante')),
  phone text,
  email text,
  address text,
  logo_url text,
  created_at timestamptz DEFAULT now()
)

-- USUARIOS (vinculados a auth.users de Supabase)
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  role text NOT NULL CHECK (role IN ('admin', 'nave_manager', 'restaurante_manager', 'restaurante_staff')),
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
)

-- CATEGORÍAS DE PRODUCTOS
product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  color text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- PRODUCTOS
products (
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
)

-- ACCESO RESTRINGIDO: qué restaurantes pueden ver un producto "restringido"
product_restaurant_access (
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, organization_id)
)

-- PEDIDOS
orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number serial UNIQUE,
  restaurant_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','en_preparacion','listo','entregado','cancelado')),
  notes text,
  total_price decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- LÍNEAS DEL PEDIDO
order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity decimal(10,3) NOT NULL,
  unit text NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  notes text
)

-- INVENTARIO NAVE
nave_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES products(id),
  current_stock decimal(10,3) DEFAULT 0,
  min_stock decimal(10,3) DEFAULT 0,
  last_updated timestamptz DEFAULT now()
)

-- INVENTARIO RESTAURANTE
restaurant_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  product_id uuid NOT NULL REFERENCES products(id),
  current_stock decimal(10,3) DEFAULT 0,
  min_stock decimal(10,3) DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE (organization_id, product_id)
)

-- ESCANDALLOS (RECETAS)
recipes (
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
)

-- INGREDIENTES DE RECETA
recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity decimal(10,3) NOT NULL,
  unit text NOT NULL,
  notes text
)

-- ALBARANES DE ENTREGA
delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  note_number serial UNIQUE,
  delivered_by text,
  delivered_at timestamptz DEFAULT now(),
  pdf_url text,
  notes text,
  created_at timestamptz DEFAULT now()
)

-- LÍNEAS DEL ALBARÁN
delivery_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  ordered_quantity decimal(10,3),
  delivered_quantity decimal(10,3) NOT NULL,
  unit text NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL
)

-- NOTIFICACIONES (log de envíos)
notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text CHECK (type IN ('nuevo_pedido','pedido_listo','stock_minimo','albaran_generado')),
  order_id uuid REFERENCES orders(id),
  recipient_id uuid REFERENCES profiles(id),
  channel text CHECK (channel IN ('email','whatsapp')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
)
```

---

## 6. Estructura de Carpetas del Proyecto

```
proveo/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Rutas de autenticación
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/              # Rutas protegidas
│   │   ├── layout.tsx            # Layout con nav lateral
│   │   ├── pedidos/              # Hacer y ver pedidos
│   │   ├── catalogo/             # Catálogo de productos
│   │   ├── inventario/           # Inventario (nave o restaurante)
│   │   ├── escandallos/          # Recetas y costes
│   │   ├── albaranes/            # Albaranes de entrega
│   │   ├── estadisticas/         # Informes y gráficas
│   │   └── admin/                # Solo rol admin
│   │       ├── usuarios/
│   │       ├── productos/
│   │       └── organizaciones/
│   ├── api/                      # API Routes de Next.js
│   │   ├── notifications/        # Envío de emails/WhatsApp
│   │   ├── pdf/                  # Generación de PDFs
│   │   └── webhooks/
│   └── layout.tsx
├── components/
│   ├── ui/                       # Shadcn/ui components
│   ├── products/                 # Tarjeta de producto, selector cantidad
│   ├── orders/                   # Formulario pedido, listado
│   ├── inventory/                # Tabla inventario, alertas
│   ├── recipes/                  # Escandallo form y detalle
│   ├── delivery-notes/           # Albarán vista y PDF
│   └── charts/                   # Gráficas estadísticas
├── lib/
│   ├── supabase/                 # Cliente Supabase (server + client)
│   ├── validations/              # Schemas Zod
│   ├── pdf/                      # Templates PDF
│   └── notifications/            # Funciones email/WhatsApp
├── hooks/                        # Custom React hooks
├── types/                        # TypeScript types/interfaces
├── middleware.ts                 # Auth middleware Next.js
└── supabase/
    ├── migrations/               # SQL migrations
    └── seed.sql                  # Datos iniciales
```

---

## 7. Módulos y Pantallas

### 7.1 Restaurante
- **Catálogo (pantalla principal)**: Grid de productos con imagen grande, nombre, precio y selector de cantidad (botones +/-). Filtro por categoría. Botón "Hacer pedido" cuando hay productos seleccionados.
- **Mi Pedido**: Resumen antes de confirmar. Notas opcionales. Confirmación.
- **Mis Pedidos**: Historial de pedidos con estado visual (pendiente/en preparación/entregado).
- **Mi Inventario**: Stock actual de productos, edición de cantidades, alertas de mínimo.
- **Escandallos**: Fichas de recetas con coste calculado y margen.

### 7.2 Nave / Obrador
- **Pedidos Entrantes**: Lista de pedidos recibidos de los 5 restaurantes, ordenados por fecha. Vista detallada de cada pedido.
- **Gestión de Estado**: Cambiar estado del pedido (en preparación → listo → entregado + generar albarán).
- **Mi Inventario**: Stock de todos los productos, edición, alertas.
- **Albaranes**: Historial de albaranes generados, descarga PDF.
- **Escandallos**: Recetas/elaboraciones propias de la nave.
- **Estadísticas**: Consumo por restaurante, productos más pedidos, costes.

### 7.3 Admin
- **Usuarios**: Crear/editar/desactivar usuarios de cualquier organización.
- **Productos**: CRUD completo con imagen, precio, visibilidad.
- **Categorías**: Gestión de categorías de productos.
- **Organizaciones**: Datos de los 5 restaurantes y la nave.
- **Estadísticas globales**: Vista completa del negocio.

---

## 8. Seguridad y Permisos (Row Level Security en Supabase)

- Cada tabla tiene políticas RLS activadas
- Un restaurante solo ve SUS pedidos, SU inventario, SUS escandallos
- La nave ve TODOS los pedidos, inventario de la nave
- Admin ve y modifica todo
- Los productos con `visibility = 'restringido'` solo se muestran a los restaurantes autorizados

---

## 9. Notificaciones

| Evento | Canal | Destinatario |
|--------|-------|-------------|
| Nuevo pedido recibido | WhatsApp + Email | Nave manager |
| Pedido listo para entregar | Email | Restaurante |
| Stock bajo el mínimo | Email | Admin + Nave/Restaurante según aplique |
| Albarán generado | Email con PDF | Restaurante |

---

## 10. Deploy y Entorno

### Variables de entorno necesarias
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email (Resend)
RESEND_API_KEY=

# WhatsApp (Twilio o Fonnte)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=

# App
NEXT_PUBLIC_APP_URL=
```

### Flujo de deploy
1. Código en repositorio GitHub (`main` = producción)
2. Render.com conectado al repo → deploy automático en cada push a `main`
3. Supabase: proyecto en plan Free (o Pro si se necesita más)
4. Migrations de DB se aplican manualmente via CLI o Supabase Dashboard

---

## 11. Convenciones de Desarrollo

- **Idioma del código**: Inglés (variables, funciones, comentarios)
- **Idioma de la UI**: Español (España)
- **TypeScript strict mode**: activado
- **Formato**: Prettier + ESLint
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- **Ramas**: `main` (producción), `develop` (desarrollo), `feature/xxx` (features)

---

## 12. Fases de Desarrollo

### Fase 1 — Base (MVP)
- [ ] Setup Next.js + Supabase + Auth
- [ ] Tablas DB + RLS + seed datos iniciales
- [ ] Login y gestión de sesión por rol
- [ ] Catálogo de productos con imágenes
- [ ] Hacer pedido (restaurante → nave)
- [ ] Panel nave: ver pedidos entrantes
- [ ] Cambio de estado de pedido
- [ ] Deploy en Render

### Fase 2 — Inventario y Albaranes
- [ ] Inventario nave
- [ ] Inventario restaurante
- [ ] Alertas de stock mínimo
- [ ] Generación de albarán PDF
- [ ] Historial de pedidos

### Fase 3 — Escandallos y Notificaciones
- [ ] Módulo escandallos (nave + restaurantes)
- [ ] Cálculo automático de costes y márgenes
- [ ] Notificaciones email (Resend)
- [ ] Notificaciones WhatsApp (Twilio/Fonnte)

### Fase 4 — Estadísticas y Admin
- [ ] Panel de estadísticas con gráficas
- [ ] Módulo admin completo
- [ ] Exportar informes a PDF/Excel
- [ ] Pedidos a proveedores externos (futuro)
