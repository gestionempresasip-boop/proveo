export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />
}

// Esqueleto genérico para páginas que listan tarjetas/filas (pedidos,
// albaranes, inventario...). Se muestra al instante vía loading.tsx
// mientras el Server Component real carga sus datos.
export function PageListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  )
}

// Esqueleto para tablas (admin/productos, admin/usuarios)
export function PageTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t border-gray-50" />
        ))}
      </div>
    </div>
  )
}
