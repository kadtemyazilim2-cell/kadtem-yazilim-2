import { getFuelLogs, getFuelTanks, getFuelTransfers } from '@/actions/fuel';
import { FuelPageClient } from './FuelPageClient';
import { serializeData } from '@/lib/serializer';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';

// [PERF] Her veri kaynağı ayrı cache'te
const getCachedFuelLogs = unstable_cache(
    async () => serializeData((await getFuelLogs()).data || []),
    ['fuel-page-logs'],
    { revalidate: 30, tags: ['fuel-logs'] }
);

const getCachedFuelTanks = unstable_cache(
    async () => serializeData((await getFuelTanks()).data || []),
    ['fuel-page-tanks'],
    { revalidate: 30, tags: ['fuel-tanks'] }
);

const getCachedFuelTransfers = unstable_cache(
    async () => serializeData((await getFuelTransfers()).data || []),
    ['fuel-page-transfers'],
    { revalidate: 30, tags: ['fuel-transfers'] }
);

export default async function FuelPage() {
    const session = await auth();
    if (!session || !session.user) {
        redirect('/login');
    }

    const [fuelLogs, fuelTanks, fuelTransfers] = await Promise.all([
        getCachedFuelLogs(),
        getCachedFuelTanks(),
        getCachedFuelTransfers(),
    ]);

    return (
        <FuelPageClient
            fuelLogs={fuelLogs}
            fuelTanks={fuelTanks}
            fuelTransfers={fuelTransfers}
        />
    );
}
