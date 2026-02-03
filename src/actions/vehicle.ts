'use server';

import { prisma } from '@/lib/db';
import { Vehicle } from '@prisma/client';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

// [PERFORMANCE] Cached vehicles query
// [PERFORMANCE] Cached vehicles query
const getVehiclesFromDb = unstable_cache(
    async () => {
        return await prisma.vehicle.findMany({
            orderBy: { plate: 'asc' },
            select: {
                id: true,
                companyId: true,
                plate: true,
                brand: true,
                model: true,
                year: true,
                type: true,
                ownership: true,
                status: true,
                meterType: true,
                currentKm: true,
                insuranceExpiry: true,
                kaskoExpiry: true,
                vehicleCardExpiry: true,
                assignedSiteId: true,
                rentalCompanyName: true,
                rentalContact: true,
                engineNumber: true,
                chassisNumber: true,
                fuelType: true,
                lastInspectionDate: true,
                // licenseFile: false, // EXCLUDED to prevent 2MB cache limit error

                // Relations
                company: true,
                assignedSite: true,
                assignedSites: { select: { id: true } },

                // History fields (if they exist in schema and act as scalars/small json)
                // Assuming these are not huge if they exist as separate columns or are small
                // If they are not in schema, this select will fail.
                // Based on types/index.ts, these seem to be possibly computed or separate.
                // Let's stick to what was in 'createVehicle' + relations.
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
                // [FIX] Fetch current state BEFORE updating
                const currentVehicle = await tx.vehicle.findUnique({
                    where: { id },
                    include: { assignedSites: true }
                });
                const currentSiteIds = currentVehicle?.assignedSites.map(s => s.id) || [];

                // 2. Update Relation
                await tx.vehicle.update({
                    where: { id },
                    data: {
                        ...cleanData,
                        assignedSites: {
                            set: newSiteIds.map(sid => ({ id: sid }))
                        }
                    }
                });

                // 3. Handle History
                const activeHistories = await tx.vehicleAssignmentHistory.findMany({
                    where: { vehicleId: id, endDate: null }
                });

                // Identify changes
                const removedSiteIds = currentSiteIds.filter(sid => !newSiteIds.includes(sid));
                const addedSiteIds = newSiteIds.filter(sid => !currentSiteIds.includes(sid));
                const keptSiteIds = newSiteIds.filter(sid => currentSiteIds.includes(sid));

                // A. Close History for Removed Sites
                for (const rSid of removedSiteIds) {
                    const history = activeHistories.find(h => h.siteId === rSid);
                    if (history) {
                        await tx.vehicleAssignmentHistory.update({
                            where: { id: history.id },
                            data: { endDate: new Date() }
                        });
                    } else {
                        // Legacy Close
                        const fallbackDate = new Date();
                        fallbackDate.setFullYear(fallbackDate.getFullYear() - 1);
                        await tx.vehicleAssignmentHistory.create({
                            data: {
                                vehicleId: id,
                                siteId: rSid,
                                startDate: fallbackDate,
                                endDate: new Date()
                            }
                        });
                    }
                }

                // B. Open History for Added Sites
                if (addedSiteIds.length > 0) {
                    await tx.vehicleAssignmentHistory.createMany({
                        data: addedSiteIds.map(sId => ({
                            vehicleId: id,
                            siteId: sId,
                            startDate: new Date(),
                            endDate: null
                        }))
                    });
                }

                // C. Ensure History for Kept Sites (Legacy Fix)
                for (const kSid of keptSiteIds) {
                    const history = activeHistories.find(h => h.siteId === kSid);
                    if (!history) {
                        const fallbackDate = new Date();
                        fallbackDate.setFullYear(fallbackDate.getFullYear() - 1);
                        await tx.vehicleAssignmentHistory.create({
                            data: {
                                vehicleId: id,
                                siteId: kSid,
                                startDate: fallbackDate,
                                endDate: null
                            }
                        });
                    }
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
            for (const vId of vehicleIds) {
                // [FIX] Fetch current state BEFORE updating to handle legacy assignments
                const vehicle = await tx.vehicle.findUnique({
                    where: { id: vId },
                    include: { assignedSites: true }
                });

                if (!vehicle) continue;

                const currentSiteIds = vehicle.assignedSites.map(s => s.id);
                const activeHistories = await tx.vehicleAssignmentHistory.findMany({
                    where: { vehicleId: vId, endDate: null }
                });

                // 1. Update Relation
                await tx.vehicle.update({
                    where: { id: vId },
                    data: {
                        assignedSites: {
                            set: siteIds.map(sid => ({ id: sid }))
                        }
                    }
                });

                // 2. Handle History

                // Identify sites being removed (Left)
                const removedSiteIds = currentSiteIds.filter(id => !siteIds.includes(id));

                // Identify sites being added (Joined)
                const addedSiteIds = siteIds.filter(id => !currentSiteIds.includes(id));

                // Identify sites staying (Remained) - Ensure they have open history
                const keptSiteIds = siteIds.filter(id => currentSiteIds.includes(id));

                // A. Close History for Removed Sites
                for (const rSid of removedSiteIds) {
                    const history = activeHistories.find(h => h.siteId === rSid);
                    if (history) {
                        // Normal close
                        await tx.vehicleAssignmentHistory.update({
                            where: { id: history.id },
                            data: { endDate: new Date() }
                        });
                    } else {
                        // Legacy Close: Was assigned but no history. Create backward entry then close.
                        // We set startDate to beginning of year or fallback to ensure it appears in past.
                        const fallbackDate = new Date();
                        fallbackDate.setFullYear(fallbackDate.getFullYear() - 1); // 1 year back

                        await tx.vehicleAssignmentHistory.create({
                            data: {
                                vehicleId: vId,
                                siteId: rSid,
                                startDate: fallbackDate,
                                endDate: new Date()
                            }
                        });
                    }
                }

                // B. Open History for Added Sites
                if (addedSiteIds.length > 0) {
                    await tx.vehicleAssignmentHistory.createMany({
                        data: addedSiteIds.map(sId => ({
                            vehicleId: vId,
                            siteId: sId,
                            startDate: new Date(),
                            endDate: null
                        }))
                    });
                }

                // C. Ensure History for Kept Sites (Legacy Fix)
                for (const kSid of keptSiteIds) {
                    const history = activeHistories.find(h => h.siteId === kSid);
                    if (!history) {
                        // Was assigned, is still assigned, but no history. Create it.
                        const fallbackDate = new Date();
                        fallbackDate.setFullYear(fallbackDate.getFullYear() - 1);

                        await tx.vehicleAssignmentHistory.create({
                            data: {
                                vehicleId: vId,
                                siteId: kSid,
                                startDate: fallbackDate,
                                endDate: null
                            }
                        });
                    }
                }
            }
        });

        revalidateTag('vehicles');
        revalidatePath('/dashboard/vehicles');
        return { success: true };
    } catch (error: any) {
        console.error('bulkAssignVehicles Error:', error);
        return { success: false, error: 'Toplu atama yapılamadı: ' + (error.message || error) };
    }
}

// [NEW] Bulk Unassignment Action with History
export async function bulkUnassignVehicles(vehicleIds: string[], siteIds: string[]) {
    try {
        await prisma.$transaction(async (tx) => {
            for (const vId of vehicleIds) {
                // [FIX] Fetch current state BEFORE updating
                const vehicle = await tx.vehicle.findUnique({
                    where: { id: vId },
                    include: { assignedSites: true }
                });

                if (!vehicle) continue;

                // 1. Update Relation
                await tx.vehicle.update({
                    where: { id: vId },
                    data: {
                        assignedSites: {
                            disconnect: siteIds.map(sid => ({ id: sid }))
                        }
                    }
                });

                // 2. Handle History
                const currentSiteIds = vehicle.assignedSites.map(s => s.id);
                // We are only removing specific siteIds.
                // Check if the sites being removed had history.

                const activeHistories = await tx.vehicleAssignmentHistory.findMany({
                    where: {
                        vehicleId: vId,
                        siteId: { in: siteIds },
                        endDate: null
                    }
                });

                for (const sId of siteIds) {
                    // Only process if the vehicle WAS assigned to this site
                    if (currentSiteIds.includes(sId)) {
                        const history = activeHistories.find(h => h.siteId === sId);
                        if (history) {
                            await tx.vehicleAssignmentHistory.update({
                                where: { id: history.id },
                                data: { endDate: new Date() }
                            });
                        } else {
                            // Legacy Close
                            const fallbackDate = new Date();
                            fallbackDate.setFullYear(fallbackDate.getFullYear() - 1);

                            await tx.vehicleAssignmentHistory.create({
                                data: {
                                    vehicleId: vId,
                                    siteId: sId,
                                    startDate: fallbackDate,
                                    endDate: new Date()
                                }
                            });
                        }
                    }
                }
            }
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
