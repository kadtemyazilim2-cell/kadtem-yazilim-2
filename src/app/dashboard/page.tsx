import { DashboardPageClient } from './DashboardPageClient';
import { getFuelLogs, getFuelTanks, getFuelTransfers } from '@/actions/fuel';
import { getAllTransactions } from '@/actions/transaction';
import { getSiteLogEntries } from '@/actions/site-log';
import { serializeData } from '@/lib/serializer';
import { unstable_cache } from 'next/cache';

// [NOTE] Fuel cache'leri kaldırıldı — toplam ~7MB, 2MB limitini aşıyor
// Sadece site-logs cache'lenir (küçük veri)
const getCachedSiteLogs = unstable_cache(
    async () => serializeData((await getSiteLogEntries()).data || []),
    ['dashboard-site-logs'],
    { revalidate: 30, tags: ['site-logs'] }
);

export default async function DashboardPage() {
    const [fuelLogsRes, fuelTanksRes, fuelTransfersRes, transactionsRes, siteLogs] = await Promise.all([
        getFuelLogs(1000),
        getFuelTanks(),
        getFuelTransfers(1000),
        getAllTransactions(),
        getCachedSiteLogs(),
    ]);

    return (
        <DashboardPageClient
            fuelLogs={serializeData(fuelLogsRes.data || [])}
            fuelTanks={serializeData(fuelTanksRes.data || [])}
            fuelTransfers={serializeData(fuelTransfersRes.data || [])}
            cashTransactions={serializeData(transactionsRes.data || [])}
            siteLogEntries={siteLogs}
        />
    );
}
