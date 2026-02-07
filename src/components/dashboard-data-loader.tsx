import { getUsers } from '@/actions/user';
import { getCompanies } from '@/actions/company';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { getPersonnel } from '@/actions/personnel';
import { getCorrespondenceList } from '@/actions/correspondence';
import { getInstitutions } from '@/actions/institution';
import { getFuelTanks, getFuelLogs, getFuelTransfers } from '@/actions/fuel'; // [UPDATED]
import { getAllTransactions } from '@/actions/transaction'; // [NEW]
import { getSiteLogEntries } from '@/actions/site-log'; // [NEW]
import { StoreInitializer } from '@/components/store-initializer';
import { serializeData } from '@/lib/serializer';

export async function DashboardDataLoader({ currentUser }: { currentUser: any }) {
    let companies = [], sites = [], vehicles = [], personnel = [], users = [], correspondences = [], institutions = [], fuelTanks = [];
    let cashTransactions = [], fuelLogs = [], fuelTransfers = [], siteLogEntries = []; // [NEW]

    try {
        const [
            companiesRes,
            sitesRes,
            vehiclesRes,
            personnelRes,
            usersRes,
            correspondencesRes,
            institutionsRes,
            fuelTanksRes,
            cashTransactionsRes, // [NEW]
            fuelLogsRes,         // [NEW]
            fuelTransfersRes,    // [NEW]
            siteLogEntriesRes    // [NEW]
        ] = await Promise.all([
            getCompanies(),
            getSites(),
            getVehicles(),
            getPersonnel(),
            getUsers(),
            getCorrespondenceList(),
            getInstitutions(),
            getFuelTanks(),
            getAllTransactions(), // [NEW]
            getFuelLogs(),        // [NEW]
            getFuelTransfers(),   // [NEW]
            getSiteLogEntries()   // [NEW]
        ]);

        companies = serializeData(companiesRes?.data || []);
        sites = serializeData(sitesRes?.data || []);
        vehicles = serializeData(vehiclesRes?.data || []);
        personnel = serializeData(personnelRes?.data || []);
        users = serializeData(usersRes?.data || []);
        correspondences = serializeData(correspondencesRes?.data || []);
        institutions = serializeData(institutionsRes?.data || []);
        fuelTanks = serializeData(fuelTanksRes?.data || []);
        cashTransactions = serializeData(cashTransactionsRes?.data || []); // [NEW]
        fuelLogs = serializeData(fuelLogsRes?.data || []);                 // [NEW]
        fuelTransfers = serializeData(fuelTransfersRes?.data || []);       // [NEW]
        siteLogEntries = serializeData(siteLogEntriesRes?.data || []);     // [NEW]

    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
    }

    return (
        <StoreInitializer
            companies={companies}
            sites={sites}
            vehicles={vehicles}
            personnel={personnel}
            users={users}
            correspondences={correspondences}
            institutions={institutions}
            fuelTanks={fuelTanks}
            cashTransactions={cashTransactions} // [NEW]
            fuelLogs={fuelLogs}                 // [NEW]
            fuelTransfers={fuelTransfers}       // [NEW]
            siteLogEntries={siteLogEntries}     // [NEW]
            currentUser={currentUser}
            yiUfeRates={[]} // Placeholder
            vehicleAttendance={[]} // Placeholder
        />
    );
}
