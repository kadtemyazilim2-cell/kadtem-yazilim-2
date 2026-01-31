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
                assignedSite: true,
                assignedSites: { select: { id: true } }
            }
        });
    },
    ['get-vehicles-data'],
    { tags: ['vehicles'], revalidate: 3600 }
);

export async function getVehicles() {
    try {
        const vehicles = await getVehiclesFromDb();
        // Transform the result to include assignedSiteIds as array of strings
        const transformedVehicles = vehicles.map((v: any) => ({
            ...v,
            assignedSiteIds: v.assignedSites ? v.assignedSites.map((s: any) => s.id) : []
        }));
        return { success: true, data: transformedVehicles };
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
        let cleanData: any = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                cleanData[key] = value;
            }
        }

        // Handle assignedSiteIds history logic
        if ('assignedSiteIds' in cleanData) {
            const newSiteIds = cleanData.assignedSiteIds as string[];
            delete cleanData.assignedSiteIds;

            await prisma.$transaction(async (tx) => {
                // 1. Update Relation
                await tx.vehicle.update({
                    where: { id },
                    data: {
                        ...cleanData,
                        assignedSites: {
                            set: newSiteIds.map(sid => ({ id: sid }))
                        }
                    }
                });

                // 2. Update History
                const activeHistories = await tx.vehicleAssignmentHistory.findMany({
                    where: { vehicleId: id, endDate: null }
                });

                // Close removed
                const toClose = activeHistories.filter(h => !newSiteIds.includes(h.siteId));
                if (toClose.length > 0) {
                    await tx.vehicleAssignmentHistory.updateMany({
                        where: { id: { in: toClose.map(h => h.id) } },
                        data: { endDate: new Date() }
                    });
                }

                // Open new
                const activeSiteIds = activeHistories.map(h => h.siteId);
                const toOpen = newSiteIds.filter(sId => !activeSiteIds.includes(sId));
                if (toOpen.length > 0) {
                    await tx.vehicleAssignmentHistory.createMany({
                        data: toOpen.map(sId => ({
                            vehicleId: id,
                            siteId: sId,
                            startDate: new Date()
                        }))
                    });
                }
            });
        } else {
            // Normal update
            // [FIX] Convert date strings (duplicated logic but simplified for brevity in diff)
            const dateFields = [
                'insuranceExpiry', 'kaskoExpiry', 'inspectionExpiry', 'vehicleCardExpiry',
                'insuranceStartDate', 'kaskoStartDate', 'rentalLastUpdate', 'lastInspectionDate'
            ];
            dateFields.forEach(field => {
                if (cleanData[field] && typeof cleanData[field] === 'string') {
                    cleanData[field] = new Date(cleanData[field]);
                }
            });

            await prisma.vehicle.update({
                where: { id },
                data: cleanData
            });
        }

        revalidateTag('vehicles');
        revalidatePath('/dashboard/vehicles');
        return { success: true };
    } catch (error: any) {
        console.error('updateVehicle Error:', error);
        return { success: false, error: error.message || 'Araç güncellenemedi.' };
    }
}

// [NEW] Get Assignment History for Validation
export async function getVehicleAssignmentHistory(siteId: string, startDate: Date, endDate: Date) {
    try {
        const history = await prisma.vehicleAssignmentHistory.findMany({
            where: {
                siteId,
                OR: [
                    // Overlap logic
                    { startDate: { lte: endDate }, endDate: { gte: startDate } },
                    { startDate: { lte: endDate }, endDate: null }
                ]
            },
            select: {
                vehicleId: true,
                startDate: true,
                endDate: true
            }
        });
        return { success: true, data: history };
    } catch (error) {
        console.error('getVehicleAssignmentHistory Error:', error);
        return { success: false, error: 'Geçmiş verisi alınamadı.' };
    }
}

// [NEW] Bulk Assignment Action
// [NEW] Bulk Assignment Action with History
export async function bulkAssignVehicles(vehicleIds: string[], siteIds: string[]) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Update actual relation
            await Promise.all(vehicleIds.map(id =>
                tx.vehicle.update({
                    where: { id },
                    data: {
                        assignedSites: {
                            set: siteIds.map(sid => ({ id: sid }))
                        }
                    }
                })
            ));

            // 2. Update History
            for (const vId of vehicleIds) {
                const activeHistories = await tx.vehicleAssignmentHistory.findMany({
                    where: { vehicleId: vId, endDate: null }
                });
                const activeSiteIds = activeHistories.map(h => h.siteId);

                // Close removed sites
                const toClose = activeHistories.filter(h => !siteIds.includes(h.siteId));
                if (toClose.length > 0) {
                    await tx.vehicleAssignmentHistory.updateMany({
                        where: { id: { in: toClose.map(h => h.id) } },
                        data: { endDate: new Date() }
                    });
                }

                // Open new sites
                const toOpen = siteIds.filter(sId => !activeSiteIds.includes(sId));
                if (toOpen.length > 0) {
                    await tx.vehicleAssignmentHistory.createMany({
                        data: toOpen.map(sId => ({
                            vehicleId: vId,
                            siteId: sId,
                            startDate: new Date()
                        }))
                    });
                }
            }
        });

        revalidateTag('vehicles');
        revalidatePath('/dashboard/vehicles');
        return { success: true };
    } catch (error) {
        console.error('bulkAssignVehicles Error:', error);
        return { success: false, error: 'Toplu atama yapılamadı.' };
    }
}

// [NEW] Bulk Unassignment Action with History
export async function bulkUnassignVehicles(vehicleIds: string[], siteIds: string[]) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Update Relation
            await Promise.all(vehicleIds.map(id =>
                tx.vehicle.update({
                    where: { id },
                    data: {
                        assignedSites: {
                            disconnect: siteIds.map(sid => ({ id: sid }))
                        }
                    }
                })
            ));

            // 2. Close History
            await tx.vehicleAssignmentHistory.updateMany({
                where: {
                    vehicleId: { in: vehicleIds },
                    siteId: { in: siteIds },
                    endDate: null
                },
                data: { endDate: new Date() }
            });
        });

        revalidateTag('vehicles');
        revalidatePath('/dashboard/vehicles');
        return { success: true };
    } catch (error) {
        console.error('bulkUnassignVehicles Error:', error);
        return { success: false, error: 'Şantiyeden çıkarma işlemi yapılamadı.' };
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
