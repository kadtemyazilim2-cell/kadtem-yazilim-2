import { CashBookList } from '@/components/modules/cash-book/CashBookList';
import { getAllTransactions } from '@/actions/transaction';
import { serializeData } from '@/lib/serializer';

export const maxDuration = 60; // [CONFIG] Increase duration for Vercel

// [FIX] Next.js 15+ Page Props are Promises
type SearchParams = { [key: string]: string | string[] | undefined }

export default async function CashBookPage(props: { searchParams: Promise<SearchParams> }) {
    const searchParams = await props.searchParams;

    const { user, hasPermission } = await import('@/auth').then(m => m.auth().then(s => ({ user: s?.user, hasPermission: (mod: string, act: string) => { const p = (s?.user as any)?.permissions?.[mod]; return p?.includes(act); } })));
    const isSuperAdmin = user?.role === 'ADMIN';

    const userId = searchParams?.userId as string | undefined;

    const canView = isSuperAdmin ||
        (user as any)?.permissions?.['cash-book']?.includes('VIEW') ||
        (user as any)?.permissions?.['cash-book.reports']?.includes('VIEW');

    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">Bu modüle erişim yetkiniz yok.</div>;
    }

    // [NOTE] Not cached — getAllTransactions uses auth() for user-specific filtering
    const transactionsRes = await getAllTransactions();
    const initialData = serializeData(transactionsRes.data || []);

    return (
        <div className="space-y-6">
            <CashBookList initialData={initialData} currentUser={user} userId={userId} />
        </div>
    );
}
