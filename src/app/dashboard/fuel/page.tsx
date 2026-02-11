import { getFuelLogs, getFuelTanks, getFuelTransfers } from '@/actions/fuel';
import { FuelPageClient } from './FuelPageClient';
import { serializeData } from '@/lib/serializer';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

// [NOTE] Cache kaldırıldı — fuel logs (1000 kayıt + include) toplam ~7MB,
// unstable_cache 2MB limitini aşıyor. Doğrudan DB fetch kullanılıyor.

export default async function FuelPage() {
    const session = await auth();
    if (!session || !session.user) {
        redirect('/login');
    }

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
