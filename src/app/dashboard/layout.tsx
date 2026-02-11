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
import { unstable_cache } from 'next/cache';

// [PERF] Her entity kendi cache'inde — unstable_cache 2MB limiti var
// Hepsini tek cache'e koymak 6.99MB → cache çalışmıyor
// Entity bazlı bölünce her biri <2MB → cache çalışıyor

const getCachedCompanies = unstable_cache(
    async () => serializeData((await getCompanies())?.data || []),
    ['layout-companies'],
    { revalidate: 60, tags: ['dashboard-data', 'companies'] }
);

const getCachedSites = unstable_cache(
    async () => serializeData((await getSites())?.data || []),
    ['layout-sites'],
    { revalidate: 60, tags: ['dashboard-data', 'sites'] }
);

const getCachedVehicles = unstable_cache(
    async () => serializeData((await getVehicles())?.data || []),
    ['layout-vehicles'],
    { revalidate: 60, tags: ['dashboard-data', 'vehicles'] }
);

const getCachedPersonnel = unstable_cache(
    async () => serializeData((await getPersonnel())?.data || []),
    ['layout-personnel'],
    { revalidate: 60, tags: ['dashboard-data', 'personnel'] }
);

const getCachedUsers = unstable_cache(
    async () => serializeData((await getUsers())?.data || []),
    ['layout-users'],
    { revalidate: 60, tags: ['dashboard-data', 'users'] }
);

const getCachedYiUfeRates = unstable_cache(
    async () => serializeData((await getYiUfeRates())?.data || []),
    ['layout-yiufe'],
    { revalidate: 60, tags: ['dashboard-data', 'yiufe'] }
);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    // [PERF] Paralel cache çağrıları — her biri <2MB
    const [companies, sites, vehicles, personnel, users, yiUfeRates] = await Promise.all([
        getCachedCompanies(),
        getCachedSites(),
        getCachedVehicles(),
        getCachedPersonnel(),
        getCachedUsers(),
        getCachedYiUfeRates(),
    ]);

    return (
        <>
            <StoreInitializer
                companies={companies}
                sites={sites}
                vehicles={vehicles}
                personnel={personnel}
                users={users}
                yiUfeRates={yiUfeRates}
                currentUser={session?.user}
            />
            <AppLayout>{children}</AppLayout>
        </>
    );
}
