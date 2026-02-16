import { getVehicleAttendanceList } from '@/actions/vehicle-attendance';
import { serializeData } from '@/lib/serializer';
import { AttendancePageClient } from './AttendancePageClient';

export default async function AttendancePage() {
    // Pre-fetch vehicle attendance data (server-side)
    const res = await getVehicleAttendanceList();
    const vehicleAttendanceData = serializeData(res.data || []);

    return <AttendancePageClient vehicleAttendanceData={vehicleAttendanceData} />;
}
