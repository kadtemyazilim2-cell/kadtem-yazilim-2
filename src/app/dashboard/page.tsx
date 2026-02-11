import { DashboardPageClient } from './DashboardPageClient';
import { getFuelLogs, getFuelTanks, getFuelTransfers } from '@/actions/fuel';
import { getAllTransactions } from '@/actions/transaction';
import { getSiteLogEntries } from '@/actions/site-log';
import { serializeData } from '@/lib/serializer';
import { unstable_cache } from 'next/cache';

// [PERF] Her veri kaynağı ayrı cache'te — 2MB limitini aşmamak için
const getCachedFuelLogs = unstable_cache(
    async () => serializeData((await getFuelLogs(1000)).data || []),
    ['dashboard-fuel-logs'],
    { revalidate: 30, tags: ['fuel-logs'] }
);

const getCachedFuelTanks = unstable_cache(
    async () => serializeData((await getFuelTanks()).data || []),
    ['dashboard-fuel-tanks'],
    { revalidate: 30, tags: ['fuel-tanks'] }
);

const getCachedFuelTransfers = unstable_cache(
    async () => serializeData((await getFuelTransfers(1000)).data || []),
    ['dashboard-fuel-transfers'],
    { revalidate: 30, tags: ['fuel-transfers'] }
);

// NOT cached: getAllTransactions uses auth() internally (user-specific data)
// NOT cached: getSiteLogEntries is small enough to fetch fresh

const getCachedSiteLogs = unstable_cache(
    async () => serializeData((await getSiteLogEntries()).data || []),
    ['dashboard-site-logs'],
    { revalidate: 30, tags: ['site-logs'] }
);

export default async function DashboardPage() {
    // Parallel fetch: cached + uncached
    const [fuelLogs, fuelTanks, fuelTransfers, transactionsRes, siteLogs] = await Promise.all([
        getCachedFuelLogs(),
        getCachedFuelTanks(),
        getCachedFuelTransfers(),
        getAllTransactions(), // Not cached — uses auth() for user-specific filtering
        getCachedSiteLogs(),
    ]);

    const cashTransactions = serializeData(transactionsRes.data || []);

    return (
        <DashboardPageClient
            fuelLogs={fuelLogs}
            fuelTanks={fuelTanks}
            fuelTransfers={fuelTransfers}
            cashTransactions={cashTransactions}
            siteLogEntries={siteLogs}
        />
    );
}
