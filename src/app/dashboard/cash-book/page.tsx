'use client';

import { CashBookList } from '@/components/modules/cash-book/CashBookList';
import { useAuth } from '@/lib/store/use-auth';

export default function CashBookPage() {
    const { user, hasPermission } = useAuth(); // [FIX] Destructure
    const isAdmin = user?.role === 'ADMIN';
    const canView = isAdmin ||
        hasPermission('cash-book', 'VIEW') ||
        hasPermission('cash-book.reports', 'VIEW') ||
        hasPermission('cash-book.reports', 'EDIT');

    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">Bu modüle erişim yetkiniz yok.</div>;
    }

    return (
        <div className="space-y-6">

            <CashBookList />
        </div>
    );
}
