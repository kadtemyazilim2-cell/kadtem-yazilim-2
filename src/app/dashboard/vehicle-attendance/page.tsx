import { VehicleAttendancePageClient } from './VehicleAttendancePageClient';
import { getVehicleAttendanceList } from '@/actions/vehicle-attendance';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { serializeData } from '@/lib/serializer';

export default async function VehicleAttendancePage() {
    const [res, sitesRes, vehiclesRes] = await Promise.all([
        getVehicleAttendanceList(),
        getSites(),
        getVehicles()
    ]);

    const data = serializeData(res.data || []);
    const sites = serializeData(sitesRes.data || []);
    const vehicles = serializeData(vehiclesRes.data || []);

    return <VehicleAttendancePageClient initialData={data} sites={sites} vehicles={vehicles} />;
}
