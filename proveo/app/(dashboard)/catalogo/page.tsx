'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProductCard } from '@/components/products/ProductCard'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Loader2, Check, X, ChevronUp } from 'lucide-react'
import type { Product, ProductCategory } from '@/types/database'
import { useRouter } from 'next/navigation'

type CartItem = { product: Product; quantity: number }

function priceWithIva(product: Product): number {
  const iva = Number((product as any).iva_rate) || 0
  return Number(product.price) * (1 + iva)
}

// Category color dot
function CatDot({ color }: { color?: string | null }) {
  if (!color) return null
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
}

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
        (supabase as any).from('products').select('*, product_categories(name, color)').eq('is_active', true).is('deleted_at', null).order('name'),
        (supabase as any).from('product_categories').select('*').order('order_index').order('name'),
      ])
      setProducts(prods ?? [])
      setCategories(cats ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleQuantityChange = useCallback((productId: string, quantity: number) => {
    setCart(prev => {
      if (quantity === 0) { const next = { ...prev }; delete next[productId]; return next }
      return { ...prev, [productId]: quantity }
    })
  }, [])

  const cartItems: CartItem[] = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find(p => p.id === id)!, quantity: qty }))
    .filter(item => item.product)

  const cartTotal = cartItems.reduce((sum, item) => sum + item.quantity * priceWithIva(item.product), 0)
  const cartCount = cartItems.length

  const filteredProducts = selectedCategory === 'todos'
    ? products
    : products.filter(p => (p as any).category_id === selectedCategory)

  // Count per category for badge
  const countByCat = categories.reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = products.filter(p => (p as any).category_id === c.id).length
    return acc
  }, {})

  async function submitOrder() {
    if (cartItems.length === 0) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const sb = supabase as any
    const { data: profile } = await sb.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile) return
    const { data: order, error } = await sb
      .from('orders')
      .insert({ restaurant_id: profile.organization_id, created_by: user.id, status: 'pendiente', notes: notes || null, total_price: cartTotal })
      .select().single()
    if (error || !order) { setSubmitting(false); return }
    await sb.from('order_items').insert(
      cartItems.map((item: CartItem) => {
        const unitPrice = priceWithIva(item.product)
        return {
          order_id: order.id, product_id: item.product.id, quantity: item.quantity,
          unit: item.product.unit, unit_price: unitPrice,
          total_price: item.quantity * unitPrice,
        }
      })
    )
    setSubmitted(true); setCart({}); setCartOpen(false)
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

  // ── Shared cart body ───────────────────────────────────────────────────────
  const cartBody = (
    <div className="p-4">
      {cartItems.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">
          Pulsa + en cualquier producto para añadirlo
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {cartItems.map(({ product, quantity }) => {
            const unitPrice = priceWithIva(product)
            return (
              <div key={product.id} className="flex items-start justify-between gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1C1C1E] leading-tight">{product.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {quantity} {product.unit} × {unitPrice.toFixed(2)}€
                  </p>
                </div>
                <span className="font-semibold text-[#1B4332] shrink-0">
                  {(quantity * unitPrice).toFixed(2)}€
                </span>
              </div>
            )
          })}
        </div>
      )}

      {cartItems.length > 0 && (
        <>
          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold text-[#1C1C1E]">
            <span>Total</span>
            <span className="text-[#1B4332]">{cartTotal.toFixed(2)}€</span>
          </div>
          <textarea
            placeholder="Notas o instrucciones (opcional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full mt-3 text-sm p-2.5 border border-gray-200 rounded-xl resize-none h-16 focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
          />
          <button
            onClick={submitOrder}
            disabled={submitting}
            className="w-full mt-3 bg-[#F59E0B] hover:bg-[#d97706] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>
              : 'Enviar pedido a la nave'}
          </button>
        </>
      )}
    </div>
  )

  return (
    // Extra bottom padding on mobile so content clears the fixed cart bar
    <div className="flex flex-col h-full">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 pb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Catálogo de productos</h1>
        <p className="text-gray-500 mt-0.5 text-sm">{products.length} productos disponibles · selecciona y haz tu pedido</p>
      </div>

      {/* ── Category filter — sticky, spans FULL width ───────────────────
          Sits outside the products/cart flex so it never competes with cart */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 sm:px-6 py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('todos')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'todos'
                ? 'bg-[#1B4332] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Todos
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedCategory === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {products.length}
            </span>
          </button>
          {categories.filter(c => countByCat[c.id] > 0).map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#1B4332] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <CatDot color={(cat as any).color} />
              {cat.name}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedCategory === cat.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {countByCat[cat.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content: products grid + desktop cart ───────────────────
          This section scrolls independently */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-0 lg:gap-6 px-4 sm:px-6 py-4 max-w-7xl mx-auto">

          {/* Products grid */}
          <div className="flex-1 min-w-0 pb-28 lg:pb-6">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg">No hay productos en esta categoría</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map(product => {
                  const cat = (product as any).product_categories
                  return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={cart[product.id] ?? 0}
                    onQuantityChange={handleQuantityChange}
                    categoryColor={cat?.color}
                    categoryName={cat?.name}
                  />
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Desktop cart sidebar ─────────────────────────────────────
              Only visible on lg+. Fixed width so it NEVER overlaps grid. */}
          <div className="hidden lg:block w-72 shrink-0 self-start sticky top-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-[#1B4332] flex items-center gap-2 text-white">
                <ShoppingCart className="h-5 w-5 shrink-0" />
                <span className="font-semibold flex-1">Mi pedido</span>
                {cartCount > 0 && (
                  <Badge className="bg-[#F59E0B] text-white border-0 shrink-0">{cartCount}</Badge>
                )}
              </div>
              {cartBody}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile/tablet: drawer + bottom bar (< lg) ────────────────── */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[82vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 bg-[#1B4332] rounded-t-3xl">
              <div className="flex items-center gap-2 text-white">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-semibold">Mi pedido</span>
                {cartCount > 0 && <Badge className="ml-2 bg-[#F59E0B] text-white border-0">{cartCount}</Badge>}
              </div>
              <button onClick={() => setCartOpen(false)} className="text-white/80 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">{cartBody}</div>
          </div>
        </div>
      )}

      {/* Bottom bar — only when cart has items, never overlaps content (content has pb-28) */}
      {cartCount > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-white border-t border-gray-200 shadow-lg">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between bg-[#1B4332] text-white px-5 py-3.5 rounded-2xl font-semibold active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <span className="bg-[#F59E0B] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                {cartCount}
              </span>
              <span>Ver pedido</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{cartTotal.toFixed(2)}€</span>
              <ChevronUp className="h-4 w-4" />
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
