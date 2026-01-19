'use client';

import { SiteLogList } from '@/components/modules/site-log/SiteLogList';
import { useAuth } from '@/lib/store/use-auth';

export default function SiteLogPage() {
    const { hasPermission } = useAuth();
    // Check for Site Log module VIEW permission
    const canView = hasPermission('site-log', 'VIEW');

    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">Bu modüle erişim yetkiniz yok.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Şantiye Defteri</h2>
                <p className="text-muted-foreground">
                    Şantiyelerden günlük raporlar ve gelişmeler.
                </p>
            </div>
            <SiteLogList />
        </div>
    );
}
