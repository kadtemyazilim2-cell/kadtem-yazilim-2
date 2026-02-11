import { VehicleAttendancePageClient } from './VehicleAttendancePageClient';
import { getVehicleAttendanceList } from '@/actions/vehicle-attendance';
import { serializeData } from '@/lib/serializer';

// [NOTE] Cache kaldırıldı — veri 26MB, unstable_cache 2MB limitini aşıyor
// Gelecekte: client-side fetch + pagination ile optimize edilebilir

export default async function VehicleAttendancePage() {
    const res = await getVehicleAttendanceList();
    const data = serializeData(res.data || []);
    return <VehicleAttendancePageClient initialData={data} />;
}
