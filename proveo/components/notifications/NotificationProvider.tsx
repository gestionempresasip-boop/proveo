'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, BellRing, X, Info, CheckCircle2, AlertTriangle, XCircle, Volume2, VolumeX } from 'lucide-react'
import { listMyNotifications, savePushSubscription, removePushSubscription, type AppNotification } from '@/app/actions/notifications'
import { cn } from '@/lib/utils'

const POLL_MS = 15000
const SEEN_KEY = 'proveo:notif:seen'
const MUTE_KEY = 'proveo:notif:mute'
const MAX_TOASTS = 3
const TOAST_MS = 9000

type Ctx = { unread: number; openPanel: () => void }
const NotificationCtx = createContext<Ctx>({ unread: 0, openPanel: () => {} })

export function useNotifications() {
  return useContext(NotificationCtx)
}

const SEVERITY: Record<AppNotification['severity'], { icon: React.ElementType; bar: string; iconCls: string; bg: string }> = {
  info:    { icon: Info,          bar: 'border-l-blue-500',  iconCls: 'text-blue-600',  bg: 'bg-blue-50' },
  success: { icon: CheckCircle2,  bar: 'border-l-green-500', iconCls: 'text-green-600', bg: 'bg-green-50' },
  warning: { icon: AlertTriangle, bar: 'border-l-amber-500', iconCls: 'text-amber-600', bg: 'bg-amber-50' },
  danger:  { icon: XCircle,       bar: 'border-l-red-500',   iconCls: 'text-red-600',   bg: 'bg-red-50' },
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}

// Dos pitidos cortos. Los navegadores solo dejan sonar audio si la persona ya
// ha tocado la página alguna vez; si no, simplemente no suena (sin error).
function beep() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const play = (freq: number, start: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + 0.25)
    }
    play(880, 0)
    play(1175, 0.18)
    setTimeout(() => ctx.close().catch(() => {}), 800)
  } catch {
    // sin sonido, no pasa nada
  }
}

function readLS(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function writeLS(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch { /* ignorar */ }
}

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
type PushState = 'checking' | 'unsupported' | 'denied' | 'off' | 'on' | 'busy'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [items, setItems] = useState<AppNotification[]>([])
  const [lastSeen, setLastSeen] = useState<string>('')
  const [toasts, setToasts] = useState<AppNotification[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelBaseline, setPanelBaseline] = useState<string>('')
  const [muted, setMuted] = useState(false)
  const knownIds = useRef<Set<string> | null>(null)
  const mutedRef = useRef(false)
  const baseTitle = useRef<string>('')
  const [pushState, setPushState] = useState<PushState>('checking')

  // Registra el service worker y detecta si este dispositivo ya está suscrito.
  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return }
    if (Notification.permission === 'denied') { setPushState('denied'); return }
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushState(sub && Notification.permission === 'granted' ? 'on' : 'off'))
      .catch(() => setPushState('unsupported'))
  }, [])

  async function enablePush() {
    setPushState('busy')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setPushState(perm === 'denied' ? 'denied' : 'off'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
      const json = sub.toJSON()
      const res = await savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' }, navigator.userAgent)
      setPushState(res.ok ? 'on' : 'off')
    } catch {
      setPushState('off')
    }
  }

  async function disablePush() {
    setPushState('busy')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe() }
    } catch { /* ignorar */ }
    setPushState('off')
  }

  useEffect(() => {
    const stored = readLS(SEEN_KEY)
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage
      setLastSeen(stored)
    } else {
      const now = new Date().toISOString()
      writeLS(SEEN_KEY, now)
      setLastSeen(now)
    }
    const m = readLS(MUTE_KEY) === '1'
    setMuted(m)
    mutedRef.current = m
  }, [])

  const poll = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const list = await listMyNotifications()
    setItems(list)
    if (knownIds.current === null) {
      knownIds.current = new Set(list.map(n => n.id))
      return
    }
    const fresh = list.filter(n => !knownIds.current!.has(n.id))
    if (fresh.length === 0) return
    for (const n of fresh) knownIds.current.add(n.id)
    // más antiguos primero, para que el último en aparecer arriba sea el más reciente
    const ordered = [...fresh].reverse()
    setToasts(prev => [...prev, ...ordered].slice(-MAX_TOASTS))
    if (!mutedRef.current) beep()
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primera carga + sondeo periódico
    poll()
    const id = setInterval(poll, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') poll() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [poll])

  // Cada aviso emergente se retira solo a los pocos segundos.
  useEffect(() => {
    if (toasts.length === 0) return
    const t = setTimeout(() => setToasts(prev => prev.slice(1)), TOAST_MS)
    return () => clearTimeout(t)
  }, [toasts])

  const unread = useMemo(
    () => (lastSeen ? items.filter(n => n.createdAt > lastSeen).length : 0),
    [items, lastSeen]
  )

  // Contador en la pestaña del navegador: "(3) Proveo".
  useEffect(() => {
    if (!baseTitle.current || !document.title.startsWith('(')) baseTitle.current = document.title.replace(/^\(\d+\)\s*/, '')
    document.title = unread > 0 ? `(${unread}) ${baseTitle.current}` : baseTitle.current
  }, [unread, pathname])

  const markSeenUpTo = useCallback((iso: string) => {
    setLastSeen(prev => {
      if (prev && prev >= iso) return prev
      writeLS(SEEN_KEY, iso)
      return iso
    })
  }, [])

  const openPanel = useCallback(() => {
    setPanelBaseline(lastSeen)
    setPanelOpen(true)
    setToasts([])
    const newest = items[0]?.createdAt
    if (newest) markSeenUpTo(newest)
  }, [items, lastSeen, markSeenUpTo])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    mutedRef.current = next
    writeLS(MUTE_KEY, next ? '1' : null)
    if (!next) beep()
  }

  function goTo(n: AppNotification) {
    markSeenUpTo(n.createdAt)
    setToasts(prev => prev.filter(t => t.id !== n.id))
    setPanelOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <NotificationCtx.Provider value={{ unread, openPanel }}>
      {children}

      {/* Avisos emergentes */}
      <div className="fixed top-3 right-3 left-3 sm:left-auto sm:w-96 z-[60] flex flex-col gap-2 pointer-events-none print:hidden">
        {toasts.map(n => {
          const s = SEVERITY[n.severity] ?? SEVERITY.info
          const Icon = s.icon
          return (
            <div
              key={n.id}
              className={cn('pointer-events-auto bg-white rounded-xl shadow-xl border border-gray-100 border-l-4 p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-top-2', s.bar)}
            >
              <button onClick={() => goTo(n)} className="flex-1 min-w-0 flex items-start gap-3 text-left">
                <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', s.iconCls)} />
                <div className="min-w-0">
                  <p className="font-semibold text-black text-sm leading-tight">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>}
                </div>
              </button>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== n.id))}
                className="text-gray-400 hover:text-gray-700 shrink-0"
                aria-label="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Panel de avisos */}
      {panelOpen && (
        <div className="fixed inset-0 z-[70] print:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPanelOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[400px] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
              <h2 className="flex-1 font-bold text-black text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#A8793A]" /> Avisos
              </h2>
              <button
                onClick={toggleMute}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                title={muted ? 'Activar sonido' : 'Silenciar'}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {muted ? 'Sin sonido' : 'Con sonido'}
              </button>
              <button onClick={() => setPanelOpen(false)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            {pushState !== 'checking' && (
              <div className={cn('px-4 py-3 border-b border-gray-100 text-sm', pushState === 'on' ? 'bg-green-50' : 'bg-amber-50')}>
                {pushState === 'on' && (
                  <div className="flex items-center gap-3">
                    <BellRing className="w-5 h-5 text-green-600 shrink-0" />
                    <p className="flex-1 text-green-900">Recibirás avisos en este dispositivo aunque la app esté cerrada.</p>
                    <button onClick={disablePush} className="text-xs font-semibold text-green-800 underline">Desactivar</button>
                  </div>
                )}
                {(pushState === 'off' || pushState === 'busy') && (
                  <div className="flex items-center gap-3">
                    <BellRing className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="flex-1 text-amber-900">Activa los avisos para enterarte aunque la app esté cerrada.</p>
                    <button onClick={enablePush} disabled={pushState === 'busy'} className="text-sm font-semibold px-3.5 py-2 rounded-lg bg-[#1E2B28] text-white hover:bg-[#141F1C] disabled:opacity-60">
                      {pushState === 'busy' ? 'Activando…' : 'Activar'}
                    </button>
                  </div>
                )}
                {pushState === 'denied' && (
                  <p className="text-amber-900">Los avisos están bloqueados en este navegador. Permítelos en los ajustes del sitio para recibirlos con la app cerrada.</p>
                )}
                {pushState === 'unsupported' && (
                  <p className="text-gray-700">Este dispositivo no admite avisos con la app cerrada. En iPhone: Compartir → «Añadir a pantalla de inicio» y abre Proveo desde ahí.</p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-center text-gray-600 py-20 px-6">
                  <Bell className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="font-medium">No hay avisos</p>
                  <p className="text-sm mt-1">Aquí verás los pedidos nuevos, envíos y alertas de stock.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map(n => {
                    const s = SEVERITY[n.severity] ?? SEVERITY.info
                    const Icon = s.icon
                    const isNew = !!panelBaseline && n.createdAt > panelBaseline
                    return (
                      <button
                        key={n.id}
                        onClick={() => goTo(n)}
                        className={cn('w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors', isNew && 'bg-amber-50/60')}
                      >
                        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', s.bg)}>
                          <Icon className={cn('w-5 h-5', s.iconCls)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-black text-sm leading-tight">{n.title}</p>
                          {n.body && <p className="text-xs text-gray-600 mt-1">{n.body}</p>}
                          <p className="text-[11px] text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {isNew && <span className="w-2 h-2 rounded-full bg-[#A8793A] shrink-0 mt-2" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </NotificationCtx.Provider>
  )
}

export function NotificationBell({ className }: { className?: string }) {
  const { unread, openPanel } = useNotifications()
  return (
    <button
      onClick={openPanel}
      title="Avisos"
      aria-label={unread > 0 ? `Avisos (${unread} sin ver)` : 'Avisos'}
      className={cn('relative flex items-center justify-center rounded-full shadow-sm transition-all hover:scale-105', className)}
    >
      <Bell className="w-4 h-4" />
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#1E2B28]">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
