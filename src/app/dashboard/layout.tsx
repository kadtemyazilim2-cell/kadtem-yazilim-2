import { getUsers } from '@/actions/user';
import { getCompanies } from '@/actions/company';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { getPersonnel } from '@/actions/personnel';
import { getCorrespondenceList } from '@/actions/correspondence';
import { getInstitutions } from '@/actions/institution';
import { getFuelTanks, getFuelLogs, getFuelTransfers } from '@/actions/fuel';
import { getSiteLogEntries } from '@/actions/site-log'; // [NEW]
import { getAllTransactions } from '@/actions/transaction'; // [NEW]
import { getYiUfeRates } from '@/actions/yiufe'; // [NEW]
import { getVehicleAttendanceList } from '@/actions/vehicle-attendance';
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

    let companies = [], sites = [], vehicles = [], personnel = [], users = [], correspondences = [], institutions = [], yiUfeRates = [];

    try {
        const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes, correspondencesRes, institutionsRes, yiUfeRes] = await Promise.all([
            getCompanies(),
            getSites(),
            getVehicles(),
            getPersonnel(),
            getUsers(),
            getCorrespondenceList(),
            getInstitutions(),
            getYiUfeRates(),
        ]);

        companies = serializeData(companiesRes?.data || []);
        sites = serializeData(sitesRes?.data || []);
        vehicles = serializeData(vehiclesRes?.data || []);
        personnel = serializeData(personnelRes?.data || []);
        users = serializeData(usersRes?.data || []);
        correspondences = serializeData(correspondencesRes?.data || []);
        institutions = serializeData(institutionsRes?.data || []);
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
                correspondences={correspondences}
                institutions={institutions}
                yiUfeRates={yiUfeRates}
                currentUser={session?.user}
            />
            <AppLayout>{children}</AppLayout>
        </>
    );
}
