// Icono visual para productos sin foto. Primero intenta adivinar por el
// propio nombre del producto (más preciso), y si no encuentra nada,
// recurre a un icono genérico según la categoría.

// Pares [palabras clave, emoji]. Se evalúan en orden — la primera que
// coincida con el nombre del producto gana, así que las más específicas
// van primero.
const NAME_KEYWORDS: [string[], string][] = [
  // Carnes y aves
  [['pollo', 'gallina', 'pavo'], '🍗'],
  [['cerdo', 'cochinillo', 'jamón', 'jamon', 'panceta', 'bacon', 'tocino'], '🥓'],
  [['ternera', 'vacuno', 'buey', 'solomillo', 'entrecot', 'chuleton', 'chuletón'], '🥩'],
  [['cordero', 'lechazo'], '🍖'],
  [['conejo'], '🐇'],
  [['salchicha', 'chorizo', 'morcilla', 'embutido', 'longaniza'], '🌭'],
  [['hamburguesa'], '🍔'],
  [['huevo'], '🥚'],

  // Pescados y mariscos
  [['salmón', 'salmon'], '🐟'],
  [['atún', 'atun', 'bonito'], '🐟'],
  [['merluza', 'bacalao', 'lubina', 'dorada', 'rape', 'lenguado', 'pescadilla'], '🐟'],
  [['gamba', 'langostino', 'camaron', 'camarón'], '🦐'],
  [['pulpo'], '🐙'],
  [['calamar', 'sepia', 'chipiron', 'chipirón'], '🦑'],
  [['cangrejo', 'centollo', 'nécora', 'necora'], '🦀'],
  [['mejillón', 'mejillon', 'almeja', 'berberecho', 'ostra', 'marisco'], '🦪'],
  [['langosta', 'bogavante'], '🦞'],

  // Frutas
  [['tomate'], '🍅'],
  [['manzana'], '🍎'],
  [['platano', 'plátano', 'banana'], '🍌'],
  [['naranja'], '🍊'],
  [['limón', 'limon'], '🍋'],
  [['fresa'], '🍓'],
  [['uva'], '🍇'],
  [['pera'], '🍐'],
  [['melón', 'melon'], '🍈'],
  [['sandía', 'sandia'], '🍉'],
  [['piña', 'pina'], '🍍'],
  [['mango'], '🥭'],
  [['aguacate'], '🥑'],
  [['coco'], '🥥'],
  [['kiwi'], '🥝'],
  [['cereza'], '🍒'],
  [['melocotón', 'melocoton'], '🍑'],
  [['açai', 'acai'], '🫐'],

  // Verduras y hortalizas
  [['lechuga', 'ensalada'], '🥬'],
  [['cebolla'], '🧅'],
  [['ajo'], '🧄'],
  [['patata', 'papa'], '🥔'],
  [['pimiento'], '🫑'],
  [['zanahoria'], '🥕'],
  [['calabacín', 'calabacin'], '🥒'],
  [['pepino'], '🥒'],
  [['berenjena'], '🍆'],
  [['champiñón', 'champinon', 'seta', 'hongo'], '🍄'],
  [['brócoli', 'brocoli'], '🥦'],
  [['calabaza'], '🎃'],
  [['maíz', 'maiz'], '🌽'],

  // Lácteos y huevos
  [['queso'], '🧀'],
  [['leche'], '🥛'],
  [['mantequilla'], '🧈'],
  [['yogur'], '🥛'],
  [['nata'], '🥛'],

  // Bebidas
  [['vino'], '🍷'],
  [['cerveza'], '🍺'],
  [['agua'], '💧'],
  [['cava', 'champan', 'champán'], '🍾'],
  [['refresco', 'cola', 'zumo', 'cóctel', 'coctel'], '🥤'],
  [['café', 'cafe'], '☕'],

  // Panadería y masas
  [['pan', 'baguette', 'hogaza'], '🥖'],
  [['croissant'], '🥐'],
  [['masa', 'pizza'], '🍕'],
  [['pasta', 'espagueti', 'macarron', 'macarrón', 'lasaña', 'lasana'], '🍝'],
  [['arroz'], '🍚'],

  // Secos, conservas, condimentos
  [['aceite'], '🫒'],
  [['oliva', 'aceituna'], '🫒'],
  [['sal'], '🧂'],
  [['azúcar', 'azucar'], '🧂'],
  [['harina'], '🌾'],
  [['chocolate', 'cacao'], '🍫'],
  [['hielo'], '🧊'],
  [['miel'], '🍯'],
  [['salsa', 'mayonesa', 'ketchup', 'mostaza'], '🫙'],

  // Postres
  [['tarta', 'pastel', 'bizcocho'], '🍰'],
  [['helado'], '🍦'],

  // Utillaje / uniformes
  [['guante', 'delantal', 'uniforme', 'gorro', 'chaqueta'], '👕'],
  [['cuchillo', 'tijera', 'utensilio'], '🔪'],
  [['bandeja', 'caja', 'envase'], '📦'],
]

const CATEGORY_KEYWORDS: [string[], string][] = [
  [['carne', 'ave'], '🥩'],
  [['pescado', 'marisco'], '🐟'],
  [['fruta'], '🍊'],
  [['verdura', 'hortaliza'], '🥦'],
  [['lácteo', 'lacteo', 'huevo'], '🧀'],
  [['vino', 'bebida', 'caldo', 'fondo'], '🍷'],
  [['seco', 'conserva'], '🫙'],
  [['salsa', 'condimento'], '🫒'],
  [['panadería', 'panaderia', 'masa', 'pastelería', 'pasteleria', 'postre'], '🥖'],
  [['utillaje', 'menaje'], '🍴'],
  [['uniforme', 'ropa'], '👕'],
  [['elaboracion', 'elaboración', 'nave'], '👨‍🍳'],
]

function matchKeywords(text: string, table: [string[], string][]): string | null {
  for (const [keywords, emoji] of table) {
    if (keywords.some(k => text.includes(k))) return emoji
  }
  return null
}

export function productEmoji(productName?: string | null, categoryName?: string | null): string {
  if (productName) {
    const byName = matchKeywords(productName.toLowerCase(), NAME_KEYWORDS)
    if (byName) return byName
  }
  if (categoryName) {
    const byCategory = matchKeywords(categoryName.toLowerCase(), CATEGORY_KEYWORDS)
    if (byCategory) return byCategory
  }
  return '📦'
}
