'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Copy, Check, Link2, Save, Store, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { unitLabel } from '@/lib/units'
import { createExternalClient, saveClientProducts, updateExternalClient } from '@/app/actions/externalClients'

export type ExternalClient = {
  id: string
  name: string
  fiscal_name: string | null
  tax_id: string | null
  address: string | null
  phone: string | null
  login_slug: string | null
}
export type ClientProduct = {
  id: string
  name: string
  unit: string
  price: number // precio general, sin IVA
  iva: number // fracción: 0.1 = 10 %
  active: boolean
  category: string | null
}
type PriceRow = { organization_id: string; product_id: string; price: number }

const eur = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const parseNum = (s: string) => {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const fmt4 = (n: number) => String(Math.round(n * 10000) / 10000)
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:border-[#1E2B28]'

export function ClientesExternosManager({ clients, catalog, prices, sqlMissing }: {
  clients: ExternalClient[]
  catalog: ClientProduct[]
  prices: PriceRow[]
  sqlMissing: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(clients[0]?.id ?? null)
  const [creating, setCreating] = useState(clients.length === 0)
  const selected = clients.find(c => c.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Clientes externos</h1>
          <p className="text-gray-700 mt-1 text-sm max-w-xl">
            Distribuidores a los que vendes. Cada uno entra con su propio PIN, solo ve los productos que tú le asignas y a su precio, y no ve ningún otro local.
          </p>
        </div>
        {!sqlMissing && (
          <button onClick={() => setCreating(v => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E2B28] text-white text-sm font-semibold px-4 py-2.5 hover:bg-[#2c3f3a]">
            <Plus className="w-4 h-4" /> Nuevo cliente
          </button>
        )}
      </div>

      {sqlMissing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Falta ejecutar en Supabase el SQL de clientes externos (<code>20261029_clientes_externos.sql</code>). Hasta entonces esta pantalla no puede mostrar ni crear clientes.
        </div>
      )}

      {creating && !sqlMissing && (
        <NewClientForm onDone={(id) => { setCreating(false); if (id) setSelectedId(id) }} />
      )}

      {clients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {clients.map(c => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                c.id === selectedId ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white text-black border-gray-200 hover:border-[#1E2B28]')}>
              <Store className="w-4 h-4" /> {c.name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div key={selected.id} className="space-y-6">
          <ClientInfo client={selected} />
          <ClientProducts
            client={selected}
            catalog={catalog}
            initial={Object.fromEntries(prices.filter(p => p.organization_id === selected.id).map(p => [p.product_id, Number(p.price)]))}
          />
        </div>
      )}

      {!selected && clients.length === 0 && !creating && !sqlMissing && (
        <p className="text-sm text-gray-600">Todavía no hay ningún cliente externo. Pulsa «Nuevo cliente».</p>
      )}
    </div>
  )
}

function NewClientForm({ onDone }: { onDone: (id?: string) => void }) {
  const router = useRouter()
  const [f, setF] = useState({ name: '', slug: '', pin: '', fiscalName: '', taxId: '', address: '', phone: '' })
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await createExternalClient(f)
      if (!res.ok) { setError(res.error ?? 'No se pudo crear'); return }
      router.refresh()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="font-bold text-black">Nuevo cliente</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm font-medium text-black">Nombre comercial
          <input className={cn(inputCls, 'mt-1')} value={f.name} required
            onChange={e => { set('name', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)) }} />
        </label>
        <label className="text-sm font-medium text-black">PIN de 4 cifras
          <input className={cn(inputCls, 'mt-1')} value={f.pin} required inputMode="numeric" maxLength={4} pattern="\d{4}"
            onChange={e => set('pin', e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="text-sm font-medium text-black sm:col-span-2">Dirección de acceso
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-gray-600 shrink-0">…/cliente/</span>
            <input className={inputCls} value={f.slug} required
              onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)) }} />
          </div>
          <span className="text-xs text-gray-600">Es el enlace que le das al cliente: en él solo aparece su local.</span>
        </label>
        <label className="text-sm font-medium text-black">Razón social
          <input className={cn(inputCls, 'mt-1')} value={f.fiscalName} onChange={e => set('fiscalName', e.target.value)} />
        </label>
        <label className="text-sm font-medium text-black">CIF
          <input className={cn(inputCls, 'mt-1')} value={f.taxId} onChange={e => set('taxId', e.target.value)} />
        </label>
        <label className="text-sm font-medium text-black sm:col-span-2">Dirección
          <input className={cn(inputCls, 'mt-1')} value={f.address} onChange={e => set('address', e.target.value)} />
        </label>
        <label className="text-sm font-medium text-black">Teléfono
          <input className={cn(inputCls, 'mt-1')} value={f.phone} onChange={e => set('phone', e.target.value)} />
        </label>
      </div>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-xl bg-[#1E2B28] text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50">
          {busy ? 'Creando…' : 'Crear cliente'}
        </button>
        <button type="button" onClick={() => onDone()} className="rounded-xl border border-gray-200 text-sm font-semibold px-4 py-2.5 text-black">Cancelar</button>
      </div>
      <p className="text-xs text-gray-600">El PIN se puede ver y cambiar después en Usuarios.</p>
    </form>
  )
}

function ClientInfo({ client }: { client: ExternalClient }) {
  const router = useRouter()
  const [f, setF] = useState({ name: client.name, fiscalName: client.fiscal_name ?? '', taxId: client.tax_id ?? '', address: client.address ?? '', phone: client.phone ?? '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string) => { setF(p => ({ ...p, [k]: v })); setMsg(null) }
  const url = typeof window !== 'undefined' && client.login_slug ? `${window.location.origin}/cliente/${client.login_slug}` : `/cliente/${client.login_slug}`

  async function save() {
    setBusy(true)
    const res = await updateExternalClient(client.id, f)
    setBusy(false)
    setMsg(res.ok ? 'Guardado' : res.error ?? 'No se pudo guardar')
    if (res.ok) router.refresh()
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h2 className="font-bold text-black">{client.name}</h2>
        <button onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* sin portapapeles */ } }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-black hover:border-[#1E2B28]">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}
          {copied ? 'Enlace copiado' : 'Copiar enlace de acceso'}
          <Copy className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      <p className="text-xs text-gray-600 break-all">{url}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm font-medium text-black">Nombre comercial
          <input className={cn(inputCls, 'mt-1')} value={f.name} onChange={e => set('name', e.target.value)} />
        </label>
        <label className="text-sm font-medium text-black">Razón social
          <input className={cn(inputCls, 'mt-1')} value={f.fiscalName} onChange={e => set('fiscalName', e.target.value)} />
        </label>
        <label className="text-sm font-medium text-black">CIF
          <input className={cn(inputCls, 'mt-1')} value={f.taxId} onChange={e => set('taxId', e.target.value)} />
        </label>
        <label className="text-sm font-medium text-black">Teléfono
          <input className={cn(inputCls, 'mt-1')} value={f.phone} onChange={e => set('phone', e.target.value)} />
        </label>
        <label className="text-sm font-medium text-black sm:col-span-2">Dirección
          <input className={cn(inputCls, 'mt-1')} value={f.address} onChange={e => set('address', e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="rounded-xl bg-[#1E2B28] text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50">Guardar datos</button>
        {msg && <span className={cn('text-sm font-medium', msg === 'Guardado' ? 'text-green-700' : 'text-red-600')}>{msg}</span>}
      </div>
    </section>
  )
}

type Filter = 'asignados' | 'todos'

function ClientProducts({ client, catalog, initial }: { client: ExternalClient; catalog: ClientProduct[]; initial: Record<string, number> }) {
  const router = useRouter()
  // Precio SIN IVA que se le cobrará, como texto mientras se edita. Solo están los productos asignados.
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([id, p]) => [id, fmt4(p)])))
  const [filter, setFilter] = useState<Filter>(Object.keys(initial).length > 0 ? 'asignados' : 'todos')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter(p => {
      if (filter === 'asignados' && !(p.id in draft)) return false
      return !q || p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)
    })
  }, [catalog, draft, filter, query])
  // Agrupado por categoría. Los totales de cada categoría cuentan TODO el catálogo, no solo lo filtrado.
  const NO_CAT = 'Sin categoría'
  const groups = useMemo(() => {
    const m = new Map<string, ClientProduct[]>()
    for (const p of list) m.set(p.category ?? NO_CAT, [...(m.get(p.category ?? NO_CAT) ?? []), p])
    return [...m.entries()].sort(([a], [b]) => (a === NO_CAT ? 1 : b === NO_CAT ? -1 : a.localeCompare(b, 'es')))
  }, [list])
  const totalByCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of catalog) m.set(p.category ?? NO_CAT, (m.get(p.category ?? NO_CAT) ?? 0) + 1)
    return m
  }, [catalog])
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())
  const searching = query.trim() !== ''
  const isOpen = (cat: string) => searching || openCats.has(cat)
  function toggleOpen(cat: string) {
    setOpenCats(s => { const n = new Set(s); if (n.has(cat)) n.delete(cat); else n.add(cat); return n })
  }
  // Marca o desmarca la categoría entera (lo que se ve de ella: con una búsqueda, solo lo encontrado)
  function toggleGroup(items: ClientProduct[]) {
    setMsg(null)
    setDraft(d => {
      const next = { ...d }
      if (items.every(p => p.id in next)) for (const p of items) delete next[p.id]
      else for (const p of items) if (!(p.id in next)) next[p.id] = fmt4(p.price)
      return next
    })
  }

  const changes = useMemo(() => {
    const upserts: { productId: string; price: number }[] = []
    for (const [id, txt] of Object.entries(draft)) {
      const n = parseNum(txt)
      if (!Number.isFinite(n)) continue
      if (!(id in initial) || Math.abs(initial[id] - n) > 0.00005) upserts.push({ productId: id, price: n })
    }
    const removeIds = Object.keys(initial).filter(id => !(id in draft))
    const invalid = Object.entries(draft).filter(([, t]) => !Number.isFinite(parseNum(t)) || parseNum(t) < 0).length
    return { upserts, removeIds, invalid }
  }, [draft, initial])
  const dirty = changes.upserts.length + changes.removeIds.length > 0
  const assignedCount = Object.keys(draft).length

  function toggle(p: ClientProduct) {
    setMsg(null)
    setDraft(d => {
      const next = { ...d }
      if (p.id in next) delete next[p.id]
      else next[p.id] = fmt4(p.price)
      return next
    })
  }
  function setSin(id: string, txt: string) { setMsg(null); setDraft(d => ({ ...d, [id]: txt })) }
  function setCon(p: ClientProduct, txt: string) {
    const n = parseNum(txt)
    setMsg(null)
    setDraft(d => ({ ...d, [p.id]: Number.isFinite(n) ? fmt4(n / (1 + p.iva)) : '' }))
  }
  function assignFiltered() {
    setMsg(null)
    setDraft(d => {
      const next = { ...d }
      for (const p of list) if (!(p.id in next)) next[p.id] = fmt4(p.price)
      return next
    })
  }
  function unassignFiltered() {
    setMsg(null)
    setDraft(d => {
      const next = { ...d }
      for (const p of list) delete next[p.id]
      return next
    })
  }

  async function save() {
    if (changes.invalid > 0) { setMsg({ ok: false, text: 'Hay precios sin rellenar o no válidos' }); return }
    setBusy(true); setMsg(null)
    try {
      const res = await saveClientProducts(client.id, changes.upserts, changes.removeIds)
      setMsg(res.ok ? { ok: true, text: 'Guardado. El cliente ya ve estos productos y precios.' } : { ok: false, text: res.error ?? 'No se pudo guardar' })
      if (res.ok) router.refresh()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'No se pudo guardar' })
    } finally { setBusy(false) }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-black">Productos y precios de {client.name}</h2>
          <p className="text-sm text-gray-600">{assignedCount} producto{assignedCount === 1 ? '' : 's'} asignado{assignedCount === 1 ? '' : 's'} · lo que marques es lo único que verá y podrá pedir.</p>
        </div>
        <button onClick={save} disabled={!dirty || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1E2B28] text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-40">
          <Save className="w-4 h-4" /> {busy ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios'}
        </button>
      </div>
      {msg && <p className={cn('text-sm font-medium', msg.ok ? 'text-green-700' : 'text-red-600')}>{msg.text}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={cn(inputCls, 'pl-9')} placeholder="Buscar producto o categoría" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {(['asignados', 'todos'] as Filter[]).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn('rounded-lg border px-3 py-2 text-sm font-semibold', filter === k ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white text-black border-gray-200 hover:border-[#1E2B28]')}>
            {k === 'asignados' ? 'Asignados' : 'Todos los productos'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <button onClick={assignFiltered} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-black hover:border-[#1E2B28]">Asignar los {list.length} de la lista</button>
        <button onClick={unassignFiltered} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-black hover:border-red-400">Quitar los de la lista</button>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button onClick={() => setOpenCats(new Set(groups.map(([c]) => c)))} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-black hover:border-[#1E2B28]">Abrir todas las categorías</button>
        <button onClick={() => setOpenCats(new Set())} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-black hover:border-[#1E2B28]">Cerrar todas</button>
      </div>

      <div className="space-y-3">
        {groups.map(([cat, items]) => {
          const assignedHere = items.filter(p => p.id in draft).length
          const all = assignedHere === items.length
          const some = assignedHere > 0 && !all
          const open = isOpen(cat)
          return (
            <div key={cat} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className={cn('flex items-center gap-3 px-3 py-2.5', assignedHere > 0 ? 'bg-emerald-50' : 'bg-gray-50')}>
                <input type="checkbox" checked={all} ref={el => { if (el) el.indeterminate = some }}
                  onChange={() => toggleGroup(items)} className="w-5 h-5 accent-[#1E2B28] shrink-0"
                  aria-label={'Asignar toda la categoría ' + cat} />
                <button onClick={() => toggleOpen(cat)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                  {open ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-600" /> : <ChevronRight className="w-4 h-4 shrink-0 text-gray-600" />}
                  <span className="font-semibold text-black truncate">{cat}</span>
                  <span className="text-xs text-gray-600 shrink-0">
                    {assignedHere}/{searching || filter === 'asignados' ? items.length : (totalByCat.get(cat) ?? items.length)} asignados
                  </span>
                </button>
                <button onClick={() => toggleGroup(items)}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:border-[#1E2B28]">
                  {all ? 'Quitar categoría' : 'Asignar toda la categoría'}
                </button>
              </div>
              {open && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs text-gray-600">
                        <th className="py-2 pl-3 pr-2 w-10"></th>
                        <th className="py-2 pr-2 font-semibold">Producto</th>
                        <th className="py-2 pr-2 font-semibold text-right whitespace-nowrap">Precio grupo</th>
                        <th className="py-2 pr-2 font-semibold text-right whitespace-nowrap">Su precio sin IVA</th>
                        <th className="py-2 pr-3 font-semibold text-right whitespace-nowrap">Su precio con IVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(p => {
                        const on = p.id in draft
                        const sin = on ? parseNum(draft[p.id]) : NaN
                        const con = Number.isFinite(sin) ? (sin * (1 + p.iva)).toFixed(2) : ''
                        return (
                          <tr key={p.id} className={cn('border-b border-gray-100 last:border-0', on && 'bg-emerald-50/50')}>
                            <td className="py-2 pl-3 pr-2">
                              <input type="checkbox" checked={on} onChange={() => toggle(p)} className="w-5 h-5 accent-[#1E2B28]" aria-label={'Asignar ' + p.name} />
                            </td>
                            <td className="py-2 pr-2">
                              <span className="font-medium text-black">{p.name}</span>
                              <span className="block text-xs text-gray-600">{unitLabel(p.unit)}{!p.active ? ' · oculto a restaurantes' : ''}</span>
                            </td>
                            <td className="py-2 pr-2 text-right text-gray-700 whitespace-nowrap">{eur(p.price)}</td>
                            <td className="py-2 pr-2 text-right">
                              {on ? (
                                <input className={cn(inputCls, 'w-24 text-right ml-auto')} inputMode="decimal" value={draft[p.id]} onChange={e => setSin(p.id, e.target.value)} aria-label={'Precio sin IVA de ' + p.name} />
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {on ? (
                                <input className={cn(inputCls, 'w-24 text-right ml-auto')} inputMode="decimal"
                                  defaultValue={con} key={p.id + '-' + con}
                                  onBlur={e => setCon(p, e.target.value)}
                                  aria-label={'Precio con IVA de ' + p.name} />
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
        {groups.length === 0 && (
          <p className="py-8 text-center text-gray-600">
            {filter === 'asignados' ? 'Aún no hay productos asignados. Cambia a «Todos los productos» y marca los que quieras.' : 'No hay productos que coincidan.'}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-600">
        Al marcar un producto se rellena con el precio del grupo; cámbialo por el de este cliente. Puedes escribir el precio sin IVA o el final con IVA (el otro se calcula). El IVA es el de cada producto.
      </p>
    </section>
  )
}
