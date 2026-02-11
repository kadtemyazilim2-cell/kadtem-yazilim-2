import { DashboardPageClient } from './DashboardPageClient';
import { getFuelLogs, getFuelTanks, getFuelTransfers } from '@/actions/fuel';
import { getAllTransactions } from '@/actions/transaction';
import { getSiteLogEntries } from '@/actions/site-log';
import { serializeData } from '@/lib/serializer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
    // Parallel Data Fetching
    const [
        fuelLogsRes,
        fuelTanksRes,
        fuelTransfersRes,
        transactionsRes,
        siteLogsRes
    ] = await Promise.all([
        getFuelLogs(1000), // Limit to recent 1000 for performance
        getFuelTanks(),
        getFuelTransfers(1000), // Limit to recent 1000
        getAllTransactions(),
        getSiteLogEntries()
    ]);

    // Serialize Data (Handle Dates/Decimals for Client Component)
    const fuelLogs = serializeData(fuelLogsRes.data || []);
    const fuelTanks = serializeData(fuelTanksRes.data || []);
    const fuelTransfers = serializeData(fuelTransfersRes.data || []);
    const cashTransactions = serializeData(transactionsRes.data || []);
    const siteLogEntries = serializeData(siteLogsRes.data || []);

    return (
        <DashboardPageClient
            fuelLogs={fuelLogs}
            fuelTanks={fuelTanks}
            fuelTransfers={fuelTransfers}
            cashTransactions={cashTransactions}
            siteLogEntries={siteLogEntries}
        />
    );
}
