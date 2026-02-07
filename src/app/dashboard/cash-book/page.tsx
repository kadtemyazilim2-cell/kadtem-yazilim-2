import { CashBookList } from '@/components/modules/cash-book/CashBookList';
import { getAllTransactions } from '@/actions/transaction';
import { serializeData } from '@/lib/serializer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // [CONFIG] Increase duration for Vercel


export default async function CashBookPage() {
    const { user, hasPermission } = await import('@/auth').then(m => m.auth().then(s => ({ user: s?.user, hasPermission: (mod: string, act: string) => { const p = (s?.user as any)?.permissions?.[mod]; return p?.includes(act); } })));
    const isSuperAdmin = user?.role === 'ADMIN';

    // [NEW] Read URL Params (Server Component approach for searchParams)
    // Next.js 15+ searchParams is async, but this is 14/15 mixed structure. 
    // Assuming Page props: { searchParams: { userId?: string } }

    // Actually, let's stick to client-side param reading in List if needed, 
    // but here we just fetch ALL allowed data for the user.

    const canView = isSuperAdmin ||
        (user as any)?.permissions?.['cash-book']?.includes('VIEW') ||
        (user as any)?.permissions?.['cash-book.reports']?.includes('VIEW');

    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">Bu modüle erişim yetkiniz yok.</div>;
    }

    // [NEW] Fetch Data Locally
    const transactionsRes = await getAllTransactions();
    const initialData = serializeData(transactionsRes.data || []);

    return (
        <div className="space-y-6">
            <CashBookList initialData={initialData} />
        </div>
    );
}
