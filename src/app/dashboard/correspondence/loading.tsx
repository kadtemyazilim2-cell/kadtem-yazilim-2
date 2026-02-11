import { Skeleton } from '@/components/ui/skeleton';

export default function CorrespondenceLoading() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-80" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="border rounded-lg p-4 space-y-2">
                {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
        </div>
    );
}
