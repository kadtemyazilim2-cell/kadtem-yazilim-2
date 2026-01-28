import { AppLayout } from '@/components/layout/AppLayout';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardDataLoader } from '@/components/dashboard-data-loader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    return (
        <>
            <Suspense fallback={null}>
                <DashboardDataLoader currentUser={session.user} />
            </Suspense>
            <AppLayout>{children}</AppLayout>
        </>
    );
}
