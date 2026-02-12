import { ClientDataLoader } from '@/components/ClientDataLoader';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    return (
        <>
            <ClientDataLoader currentUser={session?.user} />
            <AppLayout>{children}</AppLayout>
        </>
    );
}
