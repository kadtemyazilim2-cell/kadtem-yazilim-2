import { getUsers } from '@/actions/user';
import { getCompanies } from '@/actions/company';
import { getVehicles } from '@/actions/vehicle';
import { getPersonnel } from '@/actions/personnel';
import { getYiUfeRates } from '@/actions/yiufe';
import { StoreInitializer } from '@/components/store-initializer';
import { serializeData } from '@/lib/serializer';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';

// [PERF] Her entity kendi cache'inde — unstable_cache 2MB limiti var
// auth() kullanan fonksiyonlar cache içinde ÇAĞRILAMAZ (headers() erişimi)
// Bu yüzden auth-bağımlı getSites yerine doğrudan prisma kullanıyoruz

const getCachedCompanies = unstable_cache(
    async () => {
        const res = await getCompanies();
        return serializeData(res?.data || []);
    },
    ['layout-companies'],
    { revalidate: 60, tags: ['dashboard-data', 'companies'] }
);

// [FIX] getSites auth() kullandığı için cache içinden çağrılamaz
// Role ve userId parametrelerini dışarıdan alıp cache key'e ekliyoruz
const getCachedSites = unstable_cache(
    async (role: string, userId: string) => {
        let whereClause: any = {};
        if (role !== 'ADMIN') {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { assignedSites: true }
            });
            if (user) {
                const assignedSiteIds = user.assignedSites.map((s: { id: string }) => s.id);
                whereClause.id = { in: assignedSiteIds };
            } else {
                return [];
            }
        }
        const sites = await prisma.site.findMany({
            orderBy: { name: 'asc' },
            include: {
                company: true,
                partners: true,
                similarWorks: true,
                _count: { select: { fuelTanks: true } }
            },
            where: whereClause
        });
        return serializeData(sites);
    },
    ['layout-sites'],
    { revalidate: 60, tags: ['dashboard-data', 'sites'] }
);

const getCachedVehicles = unstable_cache(
    async () => {
        const res = await getVehicles();
        return serializeData(res?.data || []);
    },
    ['layout-vehicles'],
    { revalidate: 60, tags: ['dashboard-data', 'vehicles'] }
);

const getCachedPersonnel = unstable_cache(
    async () => {
        const res = await getPersonnel();
        return serializeData(res?.data || []);
    },
    ['layout-personnel'],
    { revalidate: 60, tags: ['dashboard-data', 'personnel'] }
);

const getCachedUsers = unstable_cache(
    async () => {
        const res = await getUsers();
        return serializeData(res?.data || []);
    },
    ['layout-users'],
    { revalidate: 60, tags: ['dashboard-data', 'users'] }
);

const getCachedYiUfeRates = unstable_cache(
    async () => {
        const res = await getYiUfeRates();
        return serializeData(res?.data || []);
    },
    ['layout-yiufe'],
    { revalidate: 60, tags: ['dashboard-data', 'yiufe'] }
);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    // [PERF] Paralel cache çağrıları — her biri <2MB
    // getSites'a role ve userId dışarıdan geçiliyor (auth cache içinde çağrılamaz)
    const [companies, sites, vehicles, personnel, users, yiUfeRates] = await Promise.all([
        getCachedCompanies(),
        getCachedSites(session.user.role || 'USER', session.user.id || ''),
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
