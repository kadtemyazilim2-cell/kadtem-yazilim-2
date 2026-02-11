import { getUsers } from '@/actions/user';
import { getCompanies } from '@/actions/company';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { getPersonnel } from '@/actions/personnel';
// correspondence and institution imports removed
import { getYiUfeRates } from '@/actions/yiufe';
import { getPersonnelAttendanceList } from '@/actions/personnel'; // [NEW]
import { StoreInitializer } from '@/components/store-initializer';
import { serializeData } from '@/lib/serializer';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    noStore();
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    let companies = [], sites = [], vehicles = [], personnel = [], users = [], yiUfeRates = [];

    try {
        const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes, yiUfeRes] = await Promise.all([
            getCompanies(),
            getSites(),
            getVehicles(),
            getPersonnel(),
            getUsers(),
            getYiUfeRates(),
        ]);

        companies = serializeData(companiesRes?.data || []);
        sites = serializeData(sitesRes?.data || []);
        vehicles = serializeData(vehiclesRes?.data || []);
        personnel = serializeData(personnelRes?.data || []);
        users = serializeData(usersRes?.data || []);
        yiUfeRates = serializeData(yiUfeRes?.data || []);

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
                // correspondences removed
                // institutions removed
                yiUfeRates={yiUfeRates}
                currentUser={session?.user}
            />
            <AppLayout>{children}</AppLayout>
        </>
    );
}
