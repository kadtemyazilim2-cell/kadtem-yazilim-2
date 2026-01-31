'use server';

import { prisma } from '@/lib/db';
import { Vehicle } from '@prisma/client';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

// [PERFORMANCE] Cached vehicles query
const getVehiclesFromDb = unstable_cache(
    async () => {
        return await prisma.vehicle.findMany({
            orderBy: { plate: 'asc' },
            include: {
                company: true,
                assignedSite: true
            }
        });
    },
    ['get-vehicles-data'],
    { tags: ['vehicles'], revalidate: 3600 }
);

export async function getVehicles() {
    try {
        const vehicles = await getVehiclesFromDb();
        return { success: true, data: vehicles };
    } catch (error) {
        console.error('getVehicles Error:', error);
        return { success: false, error: 'Araçlar getirilirken hata oluştu.' };
    }
}

export async function createVehicle(data: Partial<Vehicle>) {
    try {
        // [FIX] For RENTAL, if companyId is missing, try to derive from assignedSiteId
        if (data.ownership === 'RENTAL' && !data.companyId && data.assignedSiteId) {
            const site = await prisma.site.findUnique({ where: { id: data.assignedSiteId } });
            if (site) {
                data.companyId = site.companyId;
            }
        }

        // Ensure constraints
        if (!data.plate || !data.brand || !data.model || !data.companyId) {
            // If still missing after backup check
            return { success: false, error: 'Eksik bilgi (Plaka, Marka, Model veya Firma). Kiralık araçlar için Şantiye seçimi zorunludur (Firma tespiti için).' };
        }

        // [FIX] Convert date strings to Date objects
        const dateFields = [
            'insuranceExpiry', 'kaskoExpiry', 'inspectionExpiry', 'vehicleCardExpiry',
            'insuranceStartDate', 'kaskoStartDate', 'rentalLastUpdate', 'lastInspectionDate'
        ];

        dateFields.forEach(field => {
            if ((data as any)[field] && typeof (data as any)[field] === 'string') {
                (data as any)[field] = new Date((data as any)[field]);
            }
        });

        const vehicle = await prisma.vehicle.create({
            data: {
                // Mandatory fields with fallbacks or strict checks
                plate: data.plate,
                brand: data.brand,
                model: data.model,
                year: data.year || new Date().getFullYear(),
                type: data.type || 'CAR',
                ownership: data.ownership || 'OWNED',
                status: data.status || 'ACTIVE',
                meterType: data.meterType || 'KM',
                currentKm: data.currentKm || 0,

                // Optional fields
                insuranceExpiry: data.insuranceExpiry,
                kaskoExpiry: data.kaskoExpiry,
                vehicleCardExpiry: data.vehicleCardExpiry,
                assignedSiteId: data.assignedSiteId || null,
                companyId: data.companyId!, // Checked above

                // Other fields just in case
                rentalCompanyName: data.rentalCompanyName,
                rentalContact: data.rentalContact,
                engineNumber: data.engineNumber,
                chassisNumber: data.chassisNumber,
                fuelType: data.fuelType,
                lastInspectionDate: data.lastInspectionDate,
                licenseFile: data.licenseFile
            }
        });
        revalidateTag('vehicles');
        revalidateTag('vehicles');
        revalidatePath('/dashboard/vehicles');
        return { success: true, data: vehicle };
    } catch (error: any) {
        console.error('createVehicle Error:', error);
        return { success: false, error: 'Araç eklenemedi: ' + (error.message || error) };
    }
}

export async function updateVehicle(id: string, data: Partial<Vehicle>) {
    try {
        // Remove undefined keys
        let cleanData: any = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                cleanData[key] = value;
            }
        }

        // [FIX] Handle assignedSiteIds (Virtual field from client for many-to-many)
        if ('assignedSiteIds' in cleanData) {
            const ids = cleanData.assignedSiteIds as string[];
            delete cleanData.assignedSiteIds; // Remove scalar field that doesn't exist

            // Add relation update logic
            cleanData.assignedSites = {
                set: ids.map(id => ({ id }))
            };
        }

        // [FIX] Convert date strings to Date objects for Prisma
        const dateFields = [
            'insuranceExpiry', 'kaskoExpiry', 'inspectionExpiry', 'vehicleCardExpiry',
            'insuranceStartDate', 'kaskoStartDate', 'rentalLastUpdate', 'lastInspectionDate'
        ];

        dateFields.forEach(field => {
            if (cleanData[field] && typeof cleanData[field] === 'string') {
                cleanData[field] = new Date(cleanData[field]);
            }
        });

        const vehicle = await prisma.vehicle.update({
            where: { id },
            data: cleanData
        });
        revalidateTag('vehicles');
        revalidateTag('vehicles');
        revalidatePath('/dashboard/vehicles');
        return { success: true, data: vehicle };
    } catch (error: any) {
        console.error('updateVehicle Error:', error);
        return { success: false, error: error.message || 'Araç güncellenemedi.' };
    }
}

// [NEW] Bulk Assignment Action
export async function bulkAssignVehicles(vehicleIds: string[], siteIds: string[]) {
    try {
        await prisma.$transaction(
            vehicleIds.map(id =>
                prisma.vehicle.update({
                    where: { id },
                    data: {
                        assignedSites: {
                            set: siteIds.map(sid => ({ id: sid }))
                        }
                    }
                })
            )
        );

        revalidateTag('vehicles');
        revalidatePath('/dashboard/vehicles');
        return { success: true };
    } catch (error) {
        console.error('bulkAssignVehicles Error:', error);
        return { success: false, error: 'Toplu atama yapılamadı.' };
    }
}

export async function deleteVehicle(id: string) {
    try {
        const fuelLogCount = await prisma.fuelLog.count({ where: { vehicleId: id } });
        if (fuelLogCount > 0) return { success: false, error: `Bu araca ait ${fuelLogCount} adet yakıt kaydı bulunmaktadır. Silinemez.` };

        const attendanceCount = await prisma.vehicleAttendance.count({ where: { vehicleId: id } });
        if (attendanceCount > 0) return { success: false, error: `Bu araca ait ${attendanceCount} adet puantaj kaydı bulunmaktadır. Silinemez.` };

        const transferInCount = await prisma.fuelTransfer.count({ where: { toVehicleId: id } });
        const transferOutCount = await prisma.fuelTransfer.count({ where: { fromVehicleId: id } });
        if (transferInCount > 0 || transferOutCount > 0) return { success: false, error: `Bu araca ait yakıt transfer işlemi bulunmaktadır. Silinemez.` };

        await prisma.vehicle.delete({
            where: { id }
        });
        revalidateTag('vehicles');
        revalidatePath('/dashboard/vehicles');
        return { success: true };
    } catch (error) {
        console.error('deleteVehicle Error:', error);
        return { success: false, error: 'Araç silinemedi.' };
    }
}
