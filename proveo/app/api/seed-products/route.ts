import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCTOS_IMPORT } from '@/lib/productos_import_data'

// One-time product import endpoint
// GET /api/seed-products?secret=proveo-seed-2026
//
// What it does:
//   1. Inserts missing product categories
//   2. Inserts all 597 products (skips any already present by name)
//
// NOTE: run the following in Supabase SQL Editor BEFORE calling this endpoint:
//   ALTER TABLE products
//     ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,4) DEFAULT 0,
//     ADD COLUMN IF NOT EXISTS iva_rate   DECIMAL(5,4)  DEFAULT 0.10,
//     ADD COLUMN IF NOT EXISTS margin     DECIMAL(5,4)  DEFAULT 0;

const CATEGORIES_DEF = [
  { name: 'Elaboraciones nave',    color: '#1B4332', order_index: 1 },
  { name: 'Carnes y aves',         color: '#DC2626', order_index: 2 },
  { name: 'Pescados y mariscos',   color: '#0EA5E9', order_index: 3 },
  { name: 'Frutas',                color: '#F97316', order_index: 4 },
  { name: 'Verduras y hortalizas', color: '#16A34A', order_index: 5 },
  { name: 'Lácteos y huevos',      color: '#F59E0B', order_index: 6 },
  { name: 'Vinos y bebidas',       color: '#7C3AED', order_index: 7 },
  { name: 'Secos y conservas',     color: '#78716C', order_index: 8 },
  { name: 'Salsas y condimentos',  color: '#CA8A04', order_index: 9 },
  { name: 'Panadería y masas',     color: '#D97706', order_index: 10 },
  { name: 'Utillaje y menaje',     color: '#64748B', order_index: 11 },
  { name: 'Uniformes y ropa',      color: '#374151', order_index: 12 },
  { name: 'Caldos y fondos',       color: '#0369A1', order_index: 13 },
  { name: 'Pastelería y postres',  color: '#DB2777', order_index: 14 },
  { name: 'Bebidas sin alcohol',   color: '#06B6D4', order_index: 15 },
]

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (secret !== (process.env.SEED_SECRET ?? 'proveo-seed-2026')) {
    return NextResponse.json({ error: 'Unauthorized — add ?secret=proveo-seed-2026' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const log: string[] = []
  const errors: string[] = []

  // ── Step 1: Categories ───────────────────────────────────────────────────
  log.push('═══ Paso 1: Categorías ═══')
  const { data: existingCats } = await (sb as any).from('product_categories').select('name')
  const existingCatNames = new Set((existingCats ?? []).map((c: any) => c.name))

  let catsInserted = 0
  for (const cat of CATEGORIES_DEF) {
    if (existingCatNames.has(cat.name)) continue
    const { error } = await (sb as any).from('product_categories').insert(cat)
    if (error) errors.push(`Cat "${cat.name}": ${error.message}`)
    else catsInserted++
  }
  log.push(`  ✓ ${catsInserted} categorías nuevas insertadas (${existingCatNames.size} ya existían)`)

  // Fetch final category map
  const { data: allCats } = await (sb as any).from('product_categories').select('id, name')
  const catMap: Record<string, string> = {}
  for (const c of allCats ?? []) catMap[c.name] = c.id

  // ── Step 2: Products ─────────────────────────────────────────────────────
  log.push('═══ Paso 2: Productos ═══')

  // Fetch existing product names (active + deleted, to avoid re-insert)
  const { data: existingProds } = await (sb as any)
    .from('products')
    .select('name')
  const existingNames = new Set((existingProds ?? []).map((p: any) => (p.name as string).toLowerCase()))
  log.push(`  ${existingNames.size} productos ya existentes en la base de datos`)

  // Filter and build insert rows
  const toInsert = (PRODUCTOS_IMPORT as readonly (readonly [string, string | null, number, number, number, number, string, string])[])
    .filter(([name]) => !existingNames.has(name.toLowerCase()))
    .map(([name, description, price, cost_price, iva_rate, margin, unit, categoryName]) => ({
      name,
      description: description ?? null,
      price: Number(price),
      cost_price: Number(cost_price),
      iva_rate: Number(iva_rate),
      margin: Number(margin),
      unit,
      category_id: catMap[categoryName] ?? null,
      is_active: true,
      visibility: 'todos',
    }))

  log.push(`  ${toInsert.length} productos nuevos a insertar`)

  // Insert in batches of 50
  const BATCH = 50
  let totalInserted = 0

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { data, error } = await (sb as any)
      .from('products')
      .insert(batch)
      .select('id')

    if (error) {
      errors.push(`Lote ${Math.floor(i/BATCH)+1} (${i+1}–${Math.min(i+BATCH, toInsert.length)}): ${error.message}`)
    } else {
      totalInserted += data?.length ?? 0
      log.push(`  ✓ Lote ${Math.floor(i/BATCH)+1}: ${batch.length} productos (total ${totalInserted})`)
    }
  }

  log.push('')
  log.push(`✅ COMPLETADO`)
  log.push(`   Categorías insertadas: ${catsInserted}`)
  log.push(`   Productos insertados:  ${totalInserted}`)
  log.push(`   Errores:               ${errors.length}`)

  return NextResponse.json({
    success: errors.length === 0,
    categorias_insertadas: catsInserted,
    productos_insertados: totalInserted,
    log,
    errors,
  })
}
