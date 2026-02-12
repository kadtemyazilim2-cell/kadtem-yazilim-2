import { getFuelLogs, getFuelTanks, getFuelTransfers } from '@/actions/fuel';
import { FuelPageClient } from './FuelPageClient';
import { serializeData } from '@/lib/serializer';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function FuelPage() {
    const session = await auth();
    if (!session || !session.user) {
        redirect('/login');
    }

    // [PERF] select optimization reduces payload ~7MB → ~500KB, no need for server-side date limit
    // Client-side date filters handle date scoping in FuelList / FuelConsumptionReport
    const [fuelLogsRes, fuelTanksRes, fuelTransfersRes] = await Promise.all([
        getFuelLogs(),
        getFuelTanks(),
        getFuelTransfers(),
    ]);

    return (
        <FuelPageClient
            fuelLogs={serializeData(fuelLogsRes.data || [])}
            fuelTanks={serializeData(fuelTanksRes.data || [])}
            fuelTransfers={serializeData(fuelTransfersRes.data || [])}
        />
    );
}
