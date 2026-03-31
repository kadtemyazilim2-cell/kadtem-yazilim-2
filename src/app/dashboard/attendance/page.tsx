import { getVehicleAttendanceList } from '@/actions/vehicle-attendance';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { serializeData } from '@/lib/serializer';
import { AttendancePageClient } from './AttendancePageClient';

export default async function AttendancePage() {
    const [res, sitesRes, vehiclesRes] = await Promise.all([
        getVehicleAttendanceList(),
        getSites(),
        getVehicles()
    ]);

    const vehicleAttendanceData = serializeData(res.data || []);
    const sites = serializeData(sitesRes.data || []);
    const vehicles = serializeData(vehiclesRes.data || []);

    return (
        <AttendancePageClient 
            vehicleAttendanceData={vehicleAttendanceData} 
            sites={sites} 
            vehicles={vehicles} 
        />
    );
}

