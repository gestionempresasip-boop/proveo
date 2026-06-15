'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProductCard } from '@/components/products/ProductCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Loader2, Check, X, ChevronUp } from 'lucide-react'
import type { Product, ProductCategory } from '@/types/database'
import { useRouter } from 'next/navigation'

type CartItem = { product: Product; quantity: number }

export default function CatalogoPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('todos')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [notes, setNotes] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('product_categories').select('*').order('order_index'),
      ])
      setProducts(prods ?? [])
      setCategories(cats ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleQuantityChange = useCallback((productId: string, quantity: number) => {
    setCart(prev => {
      if (quantity === 0) {
        const next = { ...prev }
        delete next[productId]
        return next
      }
      return { ...prev, [productId]: quantity }
    })
  }, [])

  const cartItems: CartItem[] = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find(p => p.id === id)!, quantity: qty }))
    .filter(item => item.product)

  const cartTotal = cartItems.reduce((sum, item) => sum + item.quantity * item.product.price, 0)
  const cartCount = cartItems.length

  const filteredProducts = selectedCategory === 'todos'
    ? products
    : products.filter(p => p.category_id === selectedCategory)

  async function submitOrder() {
    if (cartItems.length === 0) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const sb = supabase as any
    const { data: profile } = await sb
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single() as { data: { organization_id: string } | null }

    if (!profile) return

    const { data: order, error } = await sb
      .from('orders')
      .insert({
        restaurant_id: profile.organization_id,
        created_by: user.id,
        status: 'pendiente',
        notes: notes || null,
        total_price: cartTotal,
      })
      .select()
      .single()

    if (error || !order) { setSubmitting(false); return }

    await sb.from('order_items').insert(
      cartItems.map((item: CartItem) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit: item.product.unit,
        unit_price: item.product.price,
        total_price: item.quantity * item.product.price,
      }))
    )

    setSubmitted(true)
    setCart({})
    setCartOpen(false)
    setTimeout(() => router.push('/pedidos'), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-[#1C1C1E]">¡Pedido enviado!</h2>
        <p className="text-gray-500">La nave recibirá tu pedido en breve</p>
      </div>
    )
  }

  // ── Cart panel (shared markup) ─────────────────────────────────────────
  const cartBody = (
    <div className="p-4">
      {cartItems.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">
          Añade productos al pedido tocando los botones +
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {cartItems.map(({ product, quantity }) => (
            <div key={product.id} className="flex items-center justify-between text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1C1C1E] truncate">{product.name}</p>
                <p className="text-gray-400 text-xs">
                  {quantity} {product.unit} × {product.price.toFixed(2)}€
                </p>
              </div>
              <span className="font-semibold text-[#1B4332] ml-2 shrink-0">
                {(quantity * product.price).toFixed(2)}€
              </span>
            </div>
          ))}
        </div>
      )}

      {cartItems.length > 0 && (
        <>
          <div className="border-t border-gray-100 mt-3 pt-3">
            <div className="flex justify-between font-bold text-[#1C1C1E]">
              <span>Total</span>
              <span>{cartTotal.toFixed(2)}€</span>
            </div>
          </div>
          <textarea
            placeholder="Notas o instrucciones (opcional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full mt-3 text-sm p-2 border border-gray-200 rounded-lg resize-none h-16 focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
          />
          <Button
            onClick={submitOrder}
            disabled={submitting}
            className="w-full mt-3 bg-[#F59E0B] hover:bg-[#d97706] text-white font-semibold"
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
              : 'Enviar pedido a la nave'}
          </Button>
        </>
      )}
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-28 lg:pb-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Catálogo de productos</h1>
        <p className="text-gray-500 mt-1 text-sm">Selecciona los productos y haz tu pedido</p>
      </div>

      <div className="flex gap-6">
        {/* Columna principal */}
        <div className="flex-1 min-w-0">
          {/* Filtro por categoría */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 sm:mb-6 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedCategory('todos')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === 'todos'
                  ? 'bg-[#1B4332] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-[#1B4332] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* Grid de productos */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No hay productos en esta categoría</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart[product.id] ?? 0}
                  onQuantityChange={handleQuantityChange}
                />
              ))}
            </div>
          )}
        </div>

        {/* Carrito lateral — solo en desktop */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-[#1B4332]">
              <div className="flex items-center gap-2 text-white">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-semibold">Mi pedido</span>
                {cartCount > 0 && (
                  <Badge className="ml-auto bg-[#F59E0B] text-white border-0">{cartCount} productos</Badge>
                )}
              </div>
            </div>
            {cartBody}
          </div>
        </div>
      </div>

      {/* ── Carrito flotante móvil/tablet (< lg) ─────────────────────── */}
      {/* Drawer expandido */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 bg-[#1B4332] rounded-t-3xl">
              <div className="flex items-center gap-2 text-white">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-semibold">Mi pedido</span>
                {cartCount > 0 && (
                  <Badge className="ml-2 bg-[#F59E0B] text-white border-0">{cartCount} productos</Badge>
                )}
              </div>
              <button onClick={() => setCartOpen(false)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">{cartBody}</div>
          </div>
        </div>
      )}

      {/* Barra flotante abajo */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 p-4 bg-white border-t border-gray-200 shadow-lg ${cartCount === 0 ? 'hidden' : ''}`}>
        <button
          onClick={() => setCartOpen(true)}
          className="w-full flex items-center justify-between bg-[#1B4332] text-white px-5 py-3.5 rounded-2xl font-semibold"
        >
          <div className="flex items-center gap-3">
            <span className="bg-[#F59E0B] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
            <span>Ver pedido</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{cartTotal.toFixed(2)}€</span>
            <ChevronUp className="h-4 w-4" />
          </div>
        </button>
      </div>
    </div>
  )
}
