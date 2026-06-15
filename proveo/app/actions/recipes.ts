'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createRecipe(formData: FormData) {
  const supabase = await createClient()
  const sb = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await sb
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Perfil no encontrado')

  const name = formData.get('name') as string
  const category = formData.get('category') as string
  const servings = Number(formData.get('servings')) || 1
  const sale_price = formData.get('sale_price') ? Number(formData.get('sale_price')) : null
  const description = formData.get('description') as string

  const { data: recipe, error } = await sb
    .from('recipes')
    .insert({
      organization_id: profile.organization_id,
      name,
      category: category || null,
      servings,
      sale_price,
      description: description || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Insertar ingredientes
  const ingredientLines = formData.getAll('ingredient_product_id')
  const quantities = formData.getAll('ingredient_quantity')
  const units = formData.getAll('ingredient_unit')

  const ingredients = ingredientLines
    .map((pid, i) => ({
      recipe_id: recipe.id,
      product_id: pid as string,
      quantity: Number(quantities[i]) || 0,
      unit: units[i] as string,
    }))
    .filter(ing => ing.product_id && ing.quantity > 0)

  if (ingredients.length > 0) {
    await sb.from('recipe_ingredients').insert(ingredients)
  }

  revalidatePath('/escandallos')
}

export async function deleteRecipe(recipeId: string) {
  const supabase = await createClient()
  await (supabase as any).from('recipes').update({ is_active: false }).eq('id', recipeId)
  revalidatePath('/escandallos')
}
