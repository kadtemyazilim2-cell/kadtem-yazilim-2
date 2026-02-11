import { VehicleAttendancePageClient } from './VehicleAttendancePageClient';
import { getVehicleAttendanceList } from '@/actions/vehicle-attendance';
import { serializeData } from '@/lib/serializer';
import { unstable_cache } from 'next/cache';

// [PERF] Araç puantaj verisi 30sn cache
const getCachedVehicleAttendance = unstable_cache(
    async () => {
        const res = await getVehicleAttendanceList();
        return serializeData(res.data || []);
    },
    ['vehicle-attendance-page-data'],
    { revalidate: 30, tags: ['vehicle-attendance'] }
);

export default async function VehicleAttendancePage() {
    const data = await getCachedVehicleAttendance();
    return <VehicleAttendancePageClient initialData={data} />;
}
