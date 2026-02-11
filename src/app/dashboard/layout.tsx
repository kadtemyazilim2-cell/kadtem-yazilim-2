import { getUsers } from '@/actions/user';
import { getCompanies } from '@/actions/company';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { getPersonnel } from '@/actions/personnel';
import { getYiUfeRates } from '@/actions/yiufe';
import { StoreInitializer } from '@/components/store-initializer';
import { serializeData } from '@/lib/serializer';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

// [NOTE] unstable_cache kaldırıldı — Next.js tüm route RSC payload'ını
// birleştirip cache'liyor ve 2MB limitini aşıyor (layout+page = 26MB).
// Veri zaten client-side Zustand store'a aktarılıyor, ayrıca cache'lemeye gerek yok.

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    // [PERF] Paralel fetch — tüm entity'ler aynı anda çekilir
    const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes, yiUfeRatesRes] = await Promise.all([
        getCompanies(),
        getSites(),
        getVehicles(),
        getPersonnel(),
        getUsers(),
        getYiUfeRates(),
    ]);

    return (
        <>
            <StoreInitializer
                companies={serializeData(companiesRes?.data || [])}
                sites={serializeData(sitesRes?.data || [])}
                vehicles={serializeData(vehiclesRes?.data || [])}
                personnel={serializeData(personnelRes?.data || [])}
                users={serializeData(usersRes?.data || [])}
                yiUfeRates={serializeData(yiUfeRatesRes?.data || [])}
                currentUser={session?.user}
            />
            <AppLayout>{children}</AppLayout>
        </>
    );
}
