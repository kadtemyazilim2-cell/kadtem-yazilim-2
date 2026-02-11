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

// [PERF] Tüm dashboard verisini 30 saniyelik cache ile sar
const getCachedDashboardData = unstable_cache(
    async () => {
        const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes, yiUfeRes] = await Promise.all([
            getCompanies(),
            getSites(),
            getVehicles(),
            getPersonnel(),
            getUsers(),
            getYiUfeRates(),
        ]);

        return {
            companies: serializeData(companiesRes?.data || []),
            sites: serializeData(sitesRes?.data || []),
            vehicles: serializeData(vehiclesRes?.data || []),
            personnel: serializeData(personnelRes?.data || []),
            users: serializeData(usersRes?.data || []),
            yiUfeRates: serializeData(yiUfeRes?.data || []),
        };
    },
    ['dashboard-global-data'],
    { revalidate: 30, tags: ['dashboard-data', 'vehicles', 'sites', 'personnel', 'fuel-logs', 'fuel-tanks', 'fuel-transfers'] }
);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    let companies: any[] = [], sites: any[] = [], vehicles: any[] = [], personnel: any[] = [], users: any[] = [], yiUfeRates: any[] = [];

    try {
        const data = await getCachedDashboardData();
        companies = data.companies;
        sites = data.sites;
        vehicles = data.vehicles;
        personnel = data.personnel;
        users = data.users;
        yiUfeRates = data.yiUfeRates;
    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
    }

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
