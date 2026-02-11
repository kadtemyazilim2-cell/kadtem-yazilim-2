import { getFuelLogs, getFuelTanks, getFuelTransfers } from '@/actions/fuel';
import { FuelPageClient } from './FuelPageClient';
import { serializeData } from '@/lib/serializer';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function FuelPage() {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    // Fetch local data for this page
    const [fuelLogsRes, fuelTanksRes, fuelTransfersRes] = await Promise.all([
        getFuelLogs(),
        getFuelTanks(),
        getFuelTransfers(),
    ]);

    const fuelLogs = serializeData(fuelLogsRes.data || []);
    const fuelTanks = serializeData(fuelTanksRes.data || []);
    const fuelTransfers = serializeData(fuelTransfersRes.data || []);

    return (
        <FuelPageClient
            fuelLogs={fuelLogs}
            fuelTanks={fuelTanks}
            fuelTransfers={fuelTransfers}
        />
    );
}
