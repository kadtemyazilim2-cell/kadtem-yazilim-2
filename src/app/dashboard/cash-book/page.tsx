'use client';

import { CashBookList } from '@/components/modules/cash-book/CashBookList';
import { useAuth } from '@/lib/store/use-auth';
import { useSearchParams } from 'next/navigation'; // [NEW]

export default function CashBookPage() {
    const { user, hasPermission } = useAuth();
    const isSuperAdmin = user?.role === 'ADMIN'; // Changed var name for clarity

    // [NEW] Read URL Params
    const searchParams = useSearchParams();
    const userId = searchParams.get('userId') || undefined;

    const canView = isSuperAdmin ||
        hasPermission('cash-book', 'VIEW') ||
        hasPermission('cash-book.reports', 'VIEW') ||
        hasPermission('cash-book.reports', 'EDIT');

    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">Bu modüle erişim yetkiniz yok.</div>;
    }

    return (
        <div className="space-y-6">
            <CashBookList userId={userId} />
        </div>
    );
}
