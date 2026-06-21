import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, TrendingUp } from 'lucide-react'
import { NuevaRecetaModal } from '@/components/escandallos/NuevaRecetaModal'

export default async function EscandалlosPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const sb = supabase as any

  const { data: rawRecipes } = await sb
    .from('recipes')
    .select('*, recipe_ingredients(*, products(name, price, unit))')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .order('name')

  const { data: products } = await sb
    .from('products')
    .select('id, name, unit, price')
    .eq('is_active', true)
    .order('name')

  const recipes = rawRecipes ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E]">Escandallos</h1>
          <p className="text-gray-500 mt-1">Fichas de recetas con cálculo de costes y márgenes</p>
        </div>
        <NuevaRecetaModal products={products ?? []} />
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>No hay escandallos todavía</p>
          <p className="text-sm mt-1">Crea tu primera receta para calcular costes automáticamente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe: any) => {
            const ingredients = recipe.recipe_ingredients ?? []
            const totalCost = ingredients.reduce((sum: number, ing: any) => {
              if (!ing.products) return sum
              return sum + ing.quantity * ing.products.price
            }, 0)
            const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0
            const margin = recipe.sale_price
              ? ((recipe.sale_price - costPerServing) / recipe.sale_price) * 100
              : null

            return (
              <Card key={recipe.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-[#d8f3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-6 w-6 text-[#1E2B28]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#1C1C1E] truncate">{recipe.name}</h3>
                      {recipe.category && <p className="text-xs text-gray-400 mt-0.5">{recipe.category}</p>}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Coste/ración</p>
                      <p className="text-lg font-bold text-[#1E2B28] mt-0.5">{costPerServing.toFixed(2)}€</p>
                    </div>
                    {recipe.sale_price && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">PVP</p>
                        <p className="text-lg font-bold text-[#1C1C1E] mt-0.5">{Number(recipe.sale_price).toFixed(2)}€</p>
                      </div>
                    )}
                  </div>

                  {margin !== null && (
                    <div className="mt-3 flex items-center gap-2">
                      <TrendingUp className={`h-4 w-4 ${margin > 60 ? 'text-green-600' : margin > 30 ? 'text-yellow-600' : 'text-red-600'}`} />
                      <span className={`text-sm font-semibold ${margin > 60 ? 'text-green-600' : margin > 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                        Margen: {margin.toFixed(1)}%
                      </span>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      {ingredients.length} ingrediente{ingredients.length !== 1 ? 's' : ''} · {recipe.servings} ración{recipe.servings !== 1 ? 'es' : ''}
                    </p>
                    <div className="mt-2 space-y-1">
                      {ingredients.slice(0, 3).map((ing: any, i: number) => (
                        <p key={i} className="text-xs text-gray-500">
                          {ing.products?.name} — {ing.quantity} {ing.unit}
                        </p>
                      ))}
                      {ingredients.length > 3 && (
                        <p className="text-xs text-gray-400">+{ingredients.length - 3} más...</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
