export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type OrgType = 'nave' | 'restaurante'
export type UserRole = 'admin' | 'nave_manager' | 'restaurante_manager' | 'restaurante_staff'
export type ProductUnit = 'kg' | 'g' | 'l' | 'ml' | 'unidad' | 'caja' | 'bandeja' | 'bolsa_500g' | 'bolsa_1kg' | 'barqueta_2kg' | 'barqueta_4kg' | 'racion' | 'bolsa' | 'paquete'
export type ProductVisibility = 'todos' | 'restringido'
export type OrderStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
export type NotifType = 'nuevo_pedido' | 'pedido_listo' | 'stock_minimo' | 'albaran_generado'
export type NotifChannel = 'email' | 'whatsapp'
export type NotifStatus = 'pending' | 'sent' | 'failed'

// ============================================================
// Row types (lo que devuelve Supabase al leer)
// ============================================================

export interface OrganizationRow {
  id: string
  name: string
  type: OrgType
  phone: string | null
  email: string | null
  address: string | null
  logo_url: string | null
  created_at: string
}

export interface ProfileRow {
  id: string
  organization_id: string
  role: UserRole
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
}

export interface ProductCategoryRow {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  order_index: number
  created_at: string
}

export interface ProductRow {
  id: string
  category_id: string | null
  name: string
  description: string | null
  image_url: string | null
  price: number
  unit: ProductUnit
  min_order_quantity: number
  order_increment: number
  visibility: ProductVisibility
  is_active: boolean
  created_at: string
}

export interface OrderRow {
  id: string
  order_number: number
  restaurant_id: string
  created_by: string | null
  status: OrderStatus
  notes: string | null
  total_price: number
  created_at: string
  updated_at: string
}

export interface OrderItemRow {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit: string
  unit_price: number
  total_price: number
  notes: string | null
}

export interface NaveInventoryRow {
  id: string
  product_id: string
  current_stock: number
  min_stock: number
  last_updated: string
}

export interface RestaurantInventoryRow {
  id: string
  organization_id: string
  product_id: string
  current_stock: number
  min_stock: number
  last_updated: string
}

export interface RecipeRow {
  id: string
  organization_id: string
  name: string
  description: string | null
  image_url: string | null
  category: string | null
  servings: number
  sale_price: number | null
  is_active: boolean
  created_at: string
}

export interface RecipeIngredientRow {
  id: string
  recipe_id: string
  product_id: string
  quantity: number
  unit: string
  notes: string | null
}

export interface DeliveryNoteRow {
  id: string
  order_id: string
  note_number: number
  delivered_by: string | null
  delivered_at: string
  pdf_url: string | null
  notes: string | null
  created_at: string
}

export interface DeliveryNoteItemRow {
  id: string
  delivery_note_id: string
  product_id: string
  ordered_quantity: number | null
  delivered_quantity: number
  unit: string
  unit_price: number
  total_price: number
}

export interface NotificationLogRow {
  id: string
  type: NotifType | null
  order_id: string | null
  recipient_id: string | null
  channel: NotifChannel | null
  status: NotifStatus
  error_message: string | null
  sent_at: string | null
  created_at: string
}

// ============================================================
// Database type para el cliente Supabase
// ============================================================
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow
        Insert: Partial<Pick<OrganizationRow, 'id' | 'created_at'>> & Omit<OrganizationRow, 'id' | 'created_at'>
        Update: Partial<OrganizationRow>
      }
      profiles: {
        Row: ProfileRow
        Insert: Partial<Pick<ProfileRow, 'created_at'>> & Omit<ProfileRow, 'created_at'>
        Update: Partial<ProfileRow>
      }
      product_categories: {
        Row: ProductCategoryRow
        Insert: Partial<Pick<ProductCategoryRow, 'id' | 'created_at' | 'order_index' | 'color'>> & Omit<ProductCategoryRow, 'id' | 'created_at' | 'order_index' | 'color'>
        Update: Partial<ProductCategoryRow>
      }
      products: {
        Row: ProductRow
        Insert: Partial<Pick<ProductRow, 'id' | 'created_at' | 'is_active' | 'visibility' | 'min_order_quantity' | 'order_increment'>> & Omit<ProductRow, 'id' | 'created_at' | 'is_active' | 'visibility' | 'min_order_quantity' | 'order_increment'>
        Update: Partial<ProductRow>
      }
      product_restaurant_access: {
        Row: { product_id: string; organization_id: string }
        Insert: { product_id: string; organization_id: string }
        Update: { product_id?: string; organization_id?: string }
      }
      orders: {
        Row: OrderRow
        Insert: {
          id?: string
          order_number?: number
          restaurant_id: string
          created_by?: string | null
          status?: OrderStatus
          notes?: string | null
          total_price?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<OrderRow>
      }
      order_items: {
        Row: OrderItemRow
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit: string
          unit_price: number
          total_price: number
          notes?: string | null
        }
        Update: Partial<OrderItemRow>
      }
      nave_inventory: {
        Row: NaveInventoryRow
        Insert: {
          id?: string
          product_id: string
          current_stock?: number
          min_stock?: number
          last_updated?: string
        }
        Update: Partial<NaveInventoryRow>
      }
      restaurant_inventory: {
        Row: RestaurantInventoryRow
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          current_stock?: number
          min_stock?: number
          last_updated?: string
        }
        Update: Partial<RestaurantInventoryRow>
      }
      recipes: {
        Row: RecipeRow
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          image_url?: string | null
          category?: string | null
          servings?: number
          sale_price?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<RecipeRow>
      }
      recipe_ingredients: {
        Row: RecipeIngredientRow
        Insert: {
          id?: string
          recipe_id: string
          product_id: string
          quantity: number
          unit: string
          notes?: string | null
        }
        Update: Partial<RecipeIngredientRow>
      }
      delivery_notes: {
        Row: DeliveryNoteRow
        Insert: {
          id?: string
          order_id: string
          note_number?: number
          delivered_by?: string | null
          delivered_at?: string
          pdf_url?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<DeliveryNoteRow>
      }
      delivery_note_items: {
        Row: DeliveryNoteItemRow
        Insert: {
          id?: string
          delivery_note_id: string
          product_id: string
          ordered_quantity?: number | null
          delivered_quantity: number
          unit: string
          unit_price: number
          total_price: number
        }
        Update: Partial<DeliveryNoteItemRow>
      }
      notification_log: {
        Row: NotificationLogRow
        Insert: {
          id?: string
          type?: NotifType | null
          order_id?: string | null
          recipient_id?: string | null
          channel?: NotifChannel | null
          status?: NotifStatus
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: Partial<NotificationLogRow>
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_role: { Args: Record<string, never>; Returns: string }
      get_my_org_id: { Args: Record<string, never>; Returns: string }
      get_my_org_type: { Args: Record<string, never>; Returns: string }
    }
    Enums: Record<string, never>
  }
}

// ============================================================
// Alias de tipos de conveniencia
// ============================================================
export type Organization = OrganizationRow
export type Profile = ProfileRow
export type ProductCategory = ProductCategoryRow
export type Product = ProductRow
export type Order = OrderRow
export type OrderItem = OrderItemRow
export type NaveInventory = NaveInventoryRow
export type RestaurantInventory = RestaurantInventoryRow
export type Recipe = RecipeRow
export type RecipeIngredient = RecipeIngredientRow
export type DeliveryNote = DeliveryNoteRow
export type DeliveryNoteItem = DeliveryNoteItemRow

// Tipos con relaciones (para joins de Supabase)
export type ProductWithCategory = Product & {
  product_categories: ProductCategory | null
}
export type OrderWithItems = Order & {
  order_items: (OrderItem & { products: Product })[]
  organizations: Organization
}
export type ProfileWithOrg = Profile & {
  organizations: Organization
}
