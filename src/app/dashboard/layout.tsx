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
import { StoreInitializer } from '@/components/store-initializer';
import { serializeData } from '@/lib/serializer';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    let companies = [], sites = [], vehicles = [], personnel = [], users = [], correspondences = [], institutions = [], fuelTanks = [], fuelLogs = [], fuelTransfers = [], siteLogEntries = [], cashTransactions = [], yiUfeRates = [];

    try {
        const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes, correspondencesRes, institutionsRes, fuelTanksRes, fuelLogsRes, fuelTransfersRes, siteLogsRes, transactionsRes, yiUfeRes] = await Promise.all([
            getCompanies(),
            getSites(),
            getVehicles(),
            getPersonnel(),
            getUsers(),
            getCorrespondenceList(),
            getInstitutions(),
            getFuelTanks(),
            getFuelLogs(),
            getFuelTransfers(),
            getSiteLogEntries(),
            getAllTransactions(),
            getYiUfeRates()
        ]);

        companies = serializeData(companiesRes?.data || []);
        sites = serializeData(sitesRes?.data || []);
        vehicles = serializeData(vehiclesRes?.data || []);
        personnel = serializeData(personnelRes?.data || []);
        users = serializeData(usersRes?.data || []);
        correspondences = serializeData(correspondencesRes?.data || []);
        institutions = serializeData(institutionsRes?.data || []);
        fuelTanks = serializeData(fuelTanksRes?.data || []);
        fuelLogs = serializeData(fuelLogsRes?.data || []);
        fuelTransfers = serializeData(fuelTransfersRes?.data || []);
        siteLogEntries = serializeData(siteLogsRes?.data || []);
        cashTransactions = serializeData(transactionsRes?.data || []);
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
                fuelTanks={fuelTanks}
                fuelLogs={fuelLogs}
                fuelTransfers={fuelTransfers}
                siteLogEntries={siteLogEntries}
                cashTransactions={cashTransactions}
                yiUfeRates={yiUfeRates}
                currentUser={session?.user}
            />
            <AppLayout>{children}</AppLayout>
        </>
    );
}
