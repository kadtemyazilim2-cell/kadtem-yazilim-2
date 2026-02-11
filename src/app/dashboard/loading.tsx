import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
    return (
        <div className="space-y-6 p-6">
            {/* Header skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
            </div>

            {/* Cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>

            {/* Table skeleton */}
            <div className="border rounded-lg p-4 space-y-3">
                <Skeleton className="h-6 w-48" />
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                    ))}
                </div>
            </div>
        </div>
    );
}
