import { VehicleAttendancePageClient } from './VehicleAttendancePageClient';
import { getVehicleAttendanceList } from '@/actions/vehicle-attendance';
import { serializeData } from '@/lib/serializer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VehicleAttendancePage() {
    // Fetch default range (last 2 months handled in action if args missing)
    const res = await getVehicleAttendanceList();
    const data = serializeData(res.data || []);

    return <VehicleAttendancePageClient initialData={data} />;
}
