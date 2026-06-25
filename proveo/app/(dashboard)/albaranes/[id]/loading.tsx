import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Skeleton className="h-6 w-40 mb-6" />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>
    </div>
  )
}
