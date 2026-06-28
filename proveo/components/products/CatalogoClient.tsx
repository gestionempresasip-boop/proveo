'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProductCard } from '@/components/products/ProductCard'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Loader2, Check, X, ChevronUp, ChevronDown, Search, Star } from 'lucide-react'
import type { Product, ProductCategory } from '@/types/database'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { takeRepeatOrder } from '@/lib/repeatOrder'
import { setFavoriteProduct } from '@/app/actions/favorites'

type CartItem = { product: Product; quantity: number }
type StockRow = { product_id: string; current_stock: number; last_restocked_at: string | null }

function priceWithIva(product: Product): number {
  const iva = Number((product as any).iva_rate) || 0
  return Number(product.price) * (1 + iva)
}

// Category color dot
function CatDot({ color }: { color?: string | null }) {
  if (!color) return null
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
}

function buildStockMaps(stock: StockRow[]) {
  const sMap: Record<string, number> = {}
  const rMap: Record<string, boolean> = {}
  const dayAgo = Date.now() - 48 * 60 * 60 * 1000
  for (const s of stock) {
    sMap[s.product_id] = Number(s.current_stock)
    rMap[s.product_id] = !!s.last_restocked_at && new Date(s.last_restocked_at).getTime() > dayAgo
  }
  return { sMap, rMap }
}

interface CatalogoClientProps {
  initialProducts: Product[]
  initialCategories: ProductCategory[]
  initialStock: StockRow[]
  initialFavoriteIds: string[]
  organizationId: string
  userId: string
}

export function CatalogoClient({
  initialProducts, initialCategories, initialStock, initialFavoriteIds, organizationId, userId,
}: CatalogoClientProps) {
  const products = initialProducts
  const categories = initialCategories
  const [cart, setCart] = useState<Record<string, number>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [notes, setNotes] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const initialMaps = buildStockMaps(initialStock)
  const [stockMap, setStockMap] = useState<Record<string, number>>(initialMaps.sMap)
  const [stockError, setStockError] = useState<string | null>(null)
  const [restockedMap] = useState<Record<string, boolean>>(initialMaps.rMap)
  const [repeatedNotice, setRepeatedNotice] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(initialFavoriteIds))
  const [showFavorites, setShowFavorites] = useState(false)
  const [favoriteError, setFavoriteError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // "Repetir pedido": viene de Mis pedidos con product_id + cantidad del
  // pedido anterior. Se rellena el carrito (recortando al stock
  // disponible) para que el restaurante solo revise y envíe.
  // Tiene que ir en un efecto (no en un lazy initializer de useState):
  // localStorage no existe durante el renderizado en servidor, así que
  // leerlo fuera de un efecto causaría un mismatch de hidratación.
  useEffect(() => {
    const repeat = takeRepeatOrder()
    if (!repeat || repeat.length === 0) return
    const validIds = new Set(products.map(p => p.id))
    const nextCart: Record<string, number> = {}
    for (const item of repeat) {
      if (!validIds.has(item.product_id) || item.quantity <= 0) continue
      const max = stockMap[item.product_id]
      nextCart[item.product_id] = max !== undefined ? Math.min(item.quantity, max) : item.quantity
    }
    if (Object.keys(nextCart).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage, no con props/estado de React
      setCart(nextCart)
      setRepeatedNotice(true)
    }
    // Solo al montar: el pedido a repetir se consume una sola vez de localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleQuantityChange = useCallback((productId: string, quantity: number) => {
    setCart(prev => {
      if (quantity === 0) { const next = { ...prev }; delete next[productId]; return next }
      return { ...prev, [productId]: quantity }
    })
  }, [])

  async function toggleFavorite(productId: string, next: boolean) {
    setFavoriteIds(prev => { const n = new Set(prev); next ? n.add(productId) : n.delete(productId); return n })
    try {
      await setFavoriteProduct(organizationId, productId, next)
    } catch {
      setFavoriteIds(prev => { const n = new Set(prev); next ? n.delete(productId) : n.add(productId); return n })
      setFavoriteError('No se pudo guardar el favorito, inténtalo de nuevo')
      setTimeout(() => setFavoriteError(null), 3000)
    }
  }

  const cartItems: CartItem[] = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find(p => p.id === id)!, quantity: qty }))
    .filter(item => item.product)

  const cartTotal = cartItems.reduce((sum, item) => sum + item.quantity * priceWithIva(item.product), 0)
  const cartCount = cartItems.length

  const filteredProducts = products.filter(p => {
    const q = searchQuery.trim().toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false)
    const matchCat = selectedCategory === 'todos' || (p as any).category_id === selectedCategory
    const matchFav = !showFavorites || favoriteIds.has(p.id)
    return matchSearch && matchCat && matchFav
  })

  // Count per category for badge
  const countByCat = categories.reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = products.filter(p => (p as any).category_id === c.id).length
    return acc
  }, {})

  const visibleCategories = categories.filter(c => countByCat[c.id] > 0)
  const selectedCatObj = visibleCategories.find(c => c.id === selectedCategory)
  const selectedCatLabel = selectedCategory === 'todos' ? 'Todas las categorías' : (selectedCatObj?.name ?? 'Todas las categorías')
  const selectedCatCount = selectedCategory === 'todos' ? products.length : (countByCat[selectedCategory] ?? 0)

  async function submitOrder() {
    if (cartItems.length === 0) return
    const sb = supabase as any

    // Revalidar stock con datos frescos justo antes de enviar (por si otro
    // restaurante ha pedido entre que cargó la página y ahora).
    const trackedIds = cartItems.filter(i => i.product.id in stockMap).map(i => i.product.id)
    let freshStock: Record<string, number> = {}
    if (trackedIds.length > 0) {
      const { data: fresh } = await sb.from('nave_inventory').select('product_id, current_stock').in('product_id', trackedIds)
      freshStock = Object.fromEntries((fresh ?? []).map((r: any) => [r.product_id, Number(r.current_stock)]))
      setStockMap(prev => ({ ...prev, ...freshStock }))
    }
    const overStock = cartItems.find(item => item.product.id in freshStock && item.quantity > freshStock[item.product.id])
    if (overStock) {
      const left = freshStock[overStock.product.id]
      setStockError(`No queda suficiente stock de "${overStock.product.name}" (quedan ${left} ${overStock.product.unit})`)
      handleQuantityChange(overStock.product.id, Math.max(0, left))
      return
    }
    setStockError(null)
    setSubmitting(true)
    const { data: order, error } = await sb
      .from('orders')
      .insert({ restaurant_id: organizationId, created_by: userId, status: 'pendiente', notes: notes || null, total_price: cartTotal })
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
    // Descontar del stock de la nave (atómico, seguro ante pedidos simultáneos)
    await Promise.all(
      cartItems.map(item => sb.rpc('adjust_nave_stock', { p_product_id: item.product.id, p_delta: -item.quantity }))
    )
    setSubmitted(true); setCart({}); setCartOpen(false)
    setTimeout(() => router.push('/pedidos'), 2000)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-black">¡Pedido enviado!</h2>
        <p className="text-gray-700">La nave recibirá tu pedido en breve</p>
      </div>
    )
  }

  // ── Shared cart body: lista de productos (se desplaza) ──────────────────
  const cartItemsList = (
    <div className="p-4">
      {cartItems.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">
          Pulsa + en cualquier producto para añadirlo
        </p>
      ) : (
        <div className="space-y-2">
          {cartItems.map(({ product, quantity }) => (
            <div key={product.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-black leading-tight">{product.name}</p>
                <p className="text-gray-600 text-xs mt-0.5">
                  {quantity} {product.unit}
                </p>
              </div>
              <button
                onClick={() => handleQuantityChange(product.id, 0)}
                className="text-gray-700 hover:text-red-500 transition-colors shrink-0"
                title="Eliminar del pedido"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── Pie del carrito: total, notas y botón — siempre visible ─────────────
  const cartFooter = cartItems.length > 0 ? (
    <div className="p-4 pt-3 border-t border-gray-100 shrink-0 bg-white">
      {stockError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{stockError}</p>
      )}
      <textarea
        placeholder="Notas o instrucciones (opcional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full mt-3 text-sm p-2.5 border border-gray-200 rounded-xl resize-none h-16 focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
      />
      <button
        onClick={submitOrder}
        disabled={submitting}
        className="w-full mt-3 bg-[#A8793A] hover:bg-[#8C6430] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {submitting
          ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>
          : 'Enviar pedido a la nave'}
      </button>
    </div>
  ) : null

  return (
    // Extra bottom padding on mobile so content clears the fixed cart bar
    <div className="flex flex-col h-full">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 pb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-black">Catálogo de productos</h1>
        <p className="text-gray-700 mt-0.5 text-sm">
          {searchQuery
            ? `${filteredProducts.length} resultado${filteredProducts.length !== 1 ? 's' : ''} para "${searchQuery}"`
            : `${products.length} productos disponibles · selecciona y haz tu pedido`}
        </p>
        {repeatedNotice && (
          <div className="mt-3 flex items-start justify-between gap-3 bg-[#1E2B28]/10 border border-[#1E2B28]/30 rounded-xl px-3.5 py-2.5">
            <p className="text-sm text-[#1E2B28]">
              Hemos rellenado tu pedido con los productos de tu pedido anterior. Revisa las cantidades y pulsa "Enviar pedido a la nave".
            </p>
            <button onClick={() => setRepeatedNotice(false)} className="text-[#1E2B28]/70 hover:text-[#1E2B28] shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Search + Category filter — sticky ────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 sm:px-6 pt-3 pb-2 space-y-2">

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] focus:border-transparent placeholder-gray-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Todos / Favoritos */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setShowFavorites(false)}
            className={cn('px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors', !showFavorites ? 'bg-white text-black shadow-sm' : 'text-gray-700')}
          >
            Todos
          </button>
          <button
            onClick={() => setShowFavorites(true)}
            className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors', showFavorites ? 'bg-white text-black shadow-sm' : 'text-gray-700')}
          >
            <Star className="w-3.5 h-3.5" /> Favoritos {favoriteIds.size > 0 && `(${favoriteIds.size})`}
          </button>
        </div>
        {favoriteError && <p className="text-xs text-red-600">{favoriteError}</p>}

        {/* Category dropdown */}
        <div className="relative">
          <button
            onClick={() => setCategoryMenuOpen(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors"
          >
            <span className="flex items-center gap-2 truncate">
              {selectedCategory !== 'todos' && <CatDot color={(selectedCatObj as any)?.color} />}
              <span className="truncate">{selectedCatLabel}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 shrink-0">
                {selectedCatCount}
              </span>
            </span>
            <ChevronDown className={cn('h-4 w-4 text-gray-600 transition-transform shrink-0', categoryMenuOpen && 'rotate-180')} />
          </button>

          {categoryMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setCategoryMenuOpen(false)} />
              <div className="absolute left-0 right-0 mt-2 z-40 bg-white rounded-xl border border-gray-100 shadow-lg max-h-80 overflow-y-auto py-1.5">
                <button
                  onClick={() => { setSelectedCategory('todos'); setCategoryMenuOpen(false) }}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition-colors',
                    selectedCategory === 'todos' ? 'bg-[#1E2B28]/[0.06] text-[#1E2B28] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <span>Todas las categorías</span>
                  <span className="text-xs text-gray-600">{products.length}</span>
                </button>
                {visibleCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); setCategoryMenuOpen(false) }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition-colors',
                      selectedCategory === cat.id ? 'bg-[#1E2B28]/[0.06] text-[#1E2B28] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <CatDot color={(cat as any).color} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="text-xs text-gray-600 shrink-0">{countByCat[cat.id]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Main content: products grid + desktop cart ───────────────────
          This section scrolls independently */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-0 lg:gap-6 px-4 sm:px-6 py-4 max-w-7xl mx-auto">

          {/* Products grid */}
          <div className="flex-1 min-w-0 pb-28 lg:pb-6">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                {showFavorites ? <Star className="h-10 w-10 mx-auto mb-3 opacity-30" /> : <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />}
                <p className="text-lg font-medium">{showFavorites ? 'Sin favoritos todavía' : 'Sin resultados'}</p>
                <p className="text-sm mt-1">
                  {showFavorites
                    ? 'Pulsa la estrella de un producto para añadirlo a tus favoritos'
                    : searchQuery ? `No hay productos que coincidan con "${searchQuery}"` : 'No hay productos en esta categoría'}
                </p>
                {searchQuery && !showFavorites && (
                  <button onClick={() => setSearchQuery('')} className="mt-4 text-[#1E2B28] text-sm font-medium underline">
                    Limpiar búsqueda
                  </button>
                )}
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
                    maxStock={product.id in stockMap ? stockMap[product.id] : undefined}
                    justRestocked={restockedMap[product.id]}
                    isFavorite={favoriteIds.has(product.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Desktop cart sidebar ─────────────────────────────────────
              Only visible on lg+. Fixed width so it NEVER overlaps grid. */}
          <div className="hidden lg:flex w-72 shrink-0 self-start sticky top-4 max-h-[calc(100vh-2rem)]">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col w-full max-h-full">
              <div className="px-4 py-3 bg-[#1E2B28] flex items-center gap-2 text-white shrink-0">
                <ShoppingCart className="h-5 w-5 shrink-0" />
                <span className="font-semibold flex-1">Mi pedido</span>
                {cartCount > 0 && (
                  <Badge className="bg-[#A8793A] text-white border-0 shrink-0">{cartCount}</Badge>
                )}
              </div>
              <div className="overflow-y-auto flex-1 min-h-0">{cartItemsList}</div>
              {cartFooter}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tablet/Mobile: drawer — se abre por encima de la tab bar ── */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col mb-[60px]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 bg-[#1E2B28] rounded-t-3xl">
              <div className="flex items-center gap-2 text-white">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-semibold">Mi pedido</span>
                {cartCount > 0 && <Badge className="ml-2 bg-[#A8793A] text-white border-0">{cartCount}</Badge>}
              </div>
              <button onClick={() => setCartOpen(false)} className="text-white/70 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">{cartItemsList}</div>
            {cartFooter}
          </div>
        </div>
      )}

      {/* Botón flotante del carrito — encima de la tab bar */}
      {cartCount > 0 && !cartOpen && (
        <div className="lg:hidden fixed bottom-[60px] left-0 right-0 z-50 px-4 pb-3">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between bg-[#1E2B28] text-white px-5 py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform shadow-xl"
          >
            <div className="flex items-center gap-3">
              <span className="bg-[#A8793A] text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                {cartCount}
              </span>
              <span>Ver pedido</span>
            </div>
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
