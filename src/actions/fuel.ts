'use server';

import { prisma } from '@/lib/db';
import { FuelLog, FuelTank, FuelTransfer } from '@prisma/client';
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from 'next/cache';

// [PERFORMANCE] Cached fuel logs query - CACHE ABORTED FOR DEBUGGING
// const getFuelLogsFromDb = unstable_cache(...)

export async function getFuelLogs() {
    noStore(); // [CRITICAL] Opt out of static caching
    console.log('[getFuelLogs] Fetching fresh fuel logs at', new Date().toISOString());
    try {
        const logs = await prisma.fuelLog.findMany({
            orderBy: { date: 'desc' },
            include: {
                vehicle: true,
                site: true,
                filledByUser: true,
                tank: true
            }
        });
        return { success: true, data: logs };
    } catch (error) {
        console.error('getFuelLogs Error:', error);
        return { success: false, error: 'Yakıt kayıtları alınamadı.' };
    }
}

// ... createFuelLog ...
export async function createFuelLog(data: Partial<FuelLog>) {
    try {
        // [NEW] Duplication Check
        const cutoff = new Date(Date.now() - 60 * 1000); // 1 minute safety
        const duplicate = await prisma.fuelLog.findFirst({
            where: {
                vehicleId: data.vehicleId,
                liters: data.liters,
                filledByUserId: data.filledByUserId,
                date: { gt: cutoff }
            }
        });

        if (duplicate) {
            return { success: false, error: 'Bu kayıt zaten eklenmiş (Çift giriş engellendi).' };
        }

        const log = await prisma.fuelLog.create({
            data: {
                vehicleId: data.vehicleId!,
                siteId: data.siteId!,
                tankId: data.tankId,
                date: new Date(data.date!),
                liters: data.liters!,
                cost: data.cost!,
                unitPrice: data.unitPrice,
                mileage: data.mileage!, // Ensure this matches schema type (Float)
                fullTank: data.fullTank || false,
                filledByUserId: data.filledByUserId!,
                description: data.description
            }
        });

        if (data.tankId) {
            await prisma.fuelTank.update({
                where: { id: data.tankId },
                data: {
                    currentLevel: { decrement: data.liters }
                }
            });
        }

        // [NEW] Auto-update Vehicle KM if new mileage is higher
        if (data.mileage) {
            const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
            if (vehicle && data.mileage > (vehicle.currentKm || 0)) {
                await prisma.vehicle.update({
                    where: { id: data.vehicleId },
                    data: { currentKm: data.mileage }
                });
            }
        }

        revalidateTag('fuel-logs');
        revalidateTag('fuel-tanks'); // Tank level changed
        revalidateTag('vehicles'); // Vehicle KM changed
        revalidatePath('/dashboard/fuel', 'page');
        revalidatePath('/dashboard/fuel/movement', 'page'); // [FIX]
        revalidatePath('/dashboard/vehicles', 'page'); // Update vehicle list
        return { success: true, data: log };
    } catch (error) {
        console.error('createFuelLog Error:', error);
        return { success: false, error: 'Yakıt kaydı eklenemedi.' };
    }
}

export async function updateFuelLog(id: string, data: Partial<FuelLog>) {
    try {
        const session = await import('@/auth').then(m => m.auth()); // Simple auth check
        if (!session?.user) return { success: false, error: 'Yetkisiz işlem.' };

        console.log('updateFuelLog: Starting update for ID:', id, 'Payload:', JSON.stringify(data)); // [DEBUG] Log Payload

        // Execute Updates Sequentially (No Transaction to avoid serverless timeout)
        const existing = await prisma.fuelLog.findUnique({ where: { id } });
        if (!existing) throw new Error('Kayıt bulunamadı.');

        // 1. Revert Old Tank Level
        if (existing.tankId) {
            await prisma.fuelTank.update({
                where: { id: existing.tankId },
                data: { currentLevel: { increment: existing.liters } }
            });
        }

        // 2. Update Log
        const updatedLog = await prisma.fuelLog.update({
            where: { id },
            data: {
                vehicleId: data.vehicleId,
                siteId: data.siteId,
                tankId: data.tankId,
                date: data.date ? new Date(data.date) : undefined,
                liters: data.liters,
                cost: data.cost,
                unitPrice: data.unitPrice,
                mileage: data.mileage,
                fullTank: data.fullTank,
                description: data.description,
            },
            include: { // [NEW] Return full object with relations to update Store immediately
                vehicle: true,
                site: true,
                filledByUser: true,
                tank: true
            }
        });

        // 3. Apply New Tank Level
        if (data.tankId && data.liters !== undefined) {
            await prisma.fuelTank.update({
                where: { id: data.tankId },
                data: {
                    currentLevel: { decrement: data.liters }
                }
            });
        }

        // [NEW] Update Vehicle KM if mileage increased
        if (data.mileage) {
            const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId || existing.vehicleId } });
            if (vehicle && data.mileage > (vehicle.currentKm || 0)) {
                await prisma.vehicle.update({
                    where: { id: vehicle.id },
                    data: { currentKm: data.mileage }
                });
            }
        }

        console.log('[updateFuelLog] Transaction committed:', updatedLog.id);

        // Server Revalidation - TEMPORARILY DISABLED
        // We will rely on router.refresh() from client for now to avoid Vercel Timeouts
        try {
            /*
            console.log('[updateFuelLog] Starting revalidation...');
            revalidateTag('fuel-logs');
            revalidateTag('fuel-tanks');
            // revalidatePath('/dashboard/fuel', 'page');
            // revalidatePath('/dashboard/fuel/movement', 'page');
            console.log('[updateFuelLog] Revalidation complete.');
            */
        } catch (revalError) {
            console.error('[updateFuelLog] Revalidation failed:', revalError);
        }

        return { success: true, data: updatedLog };

    } catch (error: any) {
        console.error('updateFuelLog FATAL ERROR:', error);
        return { success: false, error: error.message || 'Güncelleme yapılamadı (Sunucu Hatası).' };
    }
}

// [PERFORMANCE] Cached fuel tanks query - CACHE ABORTED FOR DEBUGGING

// [PERFORMANCE] Cached fuel tanks query - CACHE ABORTED FOR DEBUGGING
// const getFuelTanksFromDb = unstable_cache(...)

export async function getFuelTanks() {
    noStore(); // [CRITICAL]
    try {
        const tanks = await prisma.fuelTank.findMany({
            include: { site: true }
        });
        return { success: true, data: tanks };
    } catch (error) {
        console.error('getFuelTanks Error:', error);
        return { success: false, error: 'Depolar alınamadı.' };
    }
}

// ... createFuelTank ...
export async function createFuelTank(data: Partial<FuelTank>) {
    try {
        if (!data.siteId || !data.name || !data.capacity) {
            throw new Error('Eksik bilgi: Şantiye, Ad ve Kapasite zorunludur.');
        }

        const tank = await prisma.fuelTank.create({
            data: {
                siteId: data.siteId,
                name: data.name,
                capacity: data.capacity,
                currentLevel: data.currentLevel || 0
            }
        });
        revalidateTag('fuel-tanks');
        revalidatePath('/dashboard/fuel', 'page');
        revalidatePath('/dashboard/fuel/movement', 'page'); // [FIX]
        return { success: true, data: tank };
    } catch (error: any) {
        console.error('createFuelTank Error:', error);
        return { success: false, error: 'Depo oluşturulamadı: ' + (error.message || error) };
    }
}

export async function deleteFuelTank(id: string) {
    try {
        await prisma.fuelTank.delete({ where: { id } });
        revalidateTag('fuel-tanks');
        revalidatePath('/dashboard/fuel', 'page');
        revalidatePath('/dashboard/fuel/movement', 'page'); // [FIX]
        return { success: true };
    } catch (error) {
        console.error('deleteFuelTank Error:', error);
        return { success: false, error: 'Depo silinemedi.' };
    }
}

// [PERFORMANCE] Cached fuel transfers query - CACHE ABORTED FOR DEBUGGING

// [PERFORMANCE] Cached fuel transfers query - CACHE ABORTED FOR DEBUGGING
// const getFuelTransfersFromDb = unstable_cache(...)

export async function getFuelTransfers() {
    noStore(); // [CRITICAL]
    try {
        const transfers = await prisma.fuelTransfer.findMany({
            orderBy: { date: 'desc' },
        });
        return { success: true, data: transfers };
    } catch (error) {
        console.error('getFuelTransfers Error:', error);
        return { success: false, error: 'Transferler alınamadı.' };
    }
}

export async function createFuelTransfer(data: Partial<FuelTransfer>) {
    try {
        // [NEW] Duplication Check
        const cutoff = new Date(Date.now() - 60 * 1000);
        const duplicate = await prisma.fuelTransfer.findFirst({
            where: {
                fromType: data.fromType,
                fromId: data.fromId,
                toType: data.toType,
                toId: data.toId,
                amount: data.amount,
                createdByUserId: data.createdByUserId,
                date: { gt: cutoff }
            }
        });

        if (duplicate) {
            return { success: false, error: 'Bu transfer zaten işlenmiş (Çift giriş engellendi).' };
        }

        const transfer = await prisma.fuelTransfer.create({
            data: {
                fromType: data.fromType!,
                fromId: data.fromId!,
                fromTankId: data.fromType === 'TANK' ? data.fromId : null,
                fromVehicleId: data.fromType === 'VEHICLE' ? data.fromId : null,

                toType: data.toType!,
                toId: data.toId!,
                toTankId: data.toType === 'TANK' ? data.toId : null,
                toVehicleId: data.toType === 'VEHICLE' ? data.toId : null,

                amount: data.amount!,
                date: new Date(data.date!),
                createdByUserId: data.createdByUserId!,
                description: data.description,
                unitPrice: data.unitPrice,
                totalCost: data.totalCost
            }
        });

        // Update Tank Levels
        // 1. Decrease From Tank
        if (data.fromType === 'TANK') {
            await prisma.fuelTank.update({
                where: { id: data.fromId },
                data: { currentLevel: { decrement: data.amount } }
            });
        }

        // 2. Increase To Tank
        if (data.toType === 'TANK') {
            await prisma.fuelTank.update({
                where: { id: data.toId },
                data: { currentLevel: { increment: data.amount } }
            });
        }

        revalidateTag('fuel-transfers');
        revalidateTag('fuel-tanks'); // Levels changed, logs might depend on it
        revalidatePath('/dashboard/fuel', 'page');
        revalidatePath('/dashboard/fuel/movement', 'page'); // [FIX]
        return { success: true, data: transfer };
    } catch (error) {
        console.error('createFuelTransfer Error:', error);
        return { success: false, error: 'Transfer oluşturulamadı.' };
    }
}

export async function updateFuelTransfer(id: string, data: Partial<FuelTransfer>) {
    try {
        console.log('updateFuelTransfer: Starting transaction for ID:', id);
        // Execute Updates Sequentially (No Transaction to avoid serverless timeout)
        console.log('updateFuelTransfer: Starting update for ID:', id);

        const existing = await prisma.fuelTransfer.findUnique({ where: { id } });
        if (!existing) throw new Error('Transfer bulunamadı.');

        // 1. Revert Old Tank Levels
        // Revert From (Increment back what was taken)
        if (existing.fromType === 'TANK') {
            await prisma.fuelTank.update({
                where: { id: existing.fromId },
                data: { currentLevel: { increment: existing.amount } }
            });
        }
        // Revert To (Decrement back what was added)
        if (existing.toType === 'TANK') {
            await prisma.fuelTank.update({
                where: { id: existing.toId },
                data: { currentLevel: { decrement: existing.amount } }
            });
        }

        // 2. Update Transfer
        const transfer = await prisma.fuelTransfer.update({
            where: { id },
            data: {
                amount: data.amount,
                date: data.date ? new Date(data.date) : undefined,
                unitPrice: data.unitPrice,
                totalCost: data.totalCost,
                description: data.description,
                fromType: data.fromType,
                fromId: data.fromId,
                fromTankId: data.fromType === 'TANK' ? data.fromId : null,
                fromVehicleId: data.fromType === 'VEHICLE' ? data.fromId : null,
                toType: data.toType,
                toId: data.toId,
                toTankId: data.toType === 'TANK' ? data.toId : null,
                toVehicleId: data.toType === 'VEHICLE' ? data.toId : null,
            }
        });

        console.log('updateFuelTransfer: Transfer record updated', transfer.id);

        // 3. Apply New Tank Levels
        if (transfer.fromType === 'TANK') {
            await prisma.fuelTank.update({
                where: { id: transfer.fromId },
                data: { currentLevel: { decrement: transfer.amount } }
            });
        }

        if (transfer.toType === 'TANK') {
            await prisma.fuelTank.update({
                where: { id: transfer.toId },
                data: { currentLevel: { increment: transfer.amount } }
            });
        }

        return { success: true, data: transfer };
    } catch (error: any) {
        console.error('updateFuelTransfer Error:', error);
        return { success: false, error: error.message || 'Güncelleme yapılamadı.' };
    } finally {
        /*
        revalidateTag('fuel-transfers');
        revalidateTag('fuel-tanks');
        revalidateTag('fuel-logs'); // [NEW] Ensure logs updated
        // revalidatePath('/dashboard', 'layout'); // [FIX] Removed heavy layout revalidation
        revalidatePath('/dashboard/fuel', 'page');
        revalidatePath('/dashboard/fuel/movement', 'page');
        */
    }
}

export async function deleteFuelLog(id: string) {
    try {
        const log = await prisma.fuelLog.findUnique({ where: { id } });
        if (!log) return { success: false, error: 'Kayıt bulunamadı.' };

        // Revert Tank Level
        if (log.tankId) {
            await prisma.fuelTank.update({
                where: { id: log.tankId },
                data: { currentLevel: { increment: log.liters } }
            });
        }

        await prisma.fuelLog.delete({ where: { id } });
        revalidateTag('fuel-logs');
        revalidateTag('fuel-tanks');
        revalidatePath('/dashboard/fuel', 'page');
        revalidatePath('/dashboard/fuel/movement', 'page'); // [FIX]
        return { success: true };
    } catch (error) {
        console.error('deleteFuelLog Error:', error);
        return { success: false, error: 'Silme işlemi başarısız.' };
    }
}


export async function deleteFuelTransfer(id: string) {
    try {
        const transfer = await prisma.fuelTransfer.findUnique({ where: { id } });
        if (!transfer) return { success: false, error: 'Transfer bulunamadı.' };

        // Revert From Tank (It was decremented, so increment back)
        if (transfer.fromType === 'TANK') {
            await prisma.fuelTank.update({
                where: { id: transfer.fromId },
                data: { currentLevel: { increment: transfer.amount } }
            });
        }

        // Revert To Tank (It was incremented, so decrement back)
        if (transfer.toType === 'TANK') {
            await prisma.fuelTank.update({
                where: { id: transfer.toId },
                data: { currentLevel: { decrement: transfer.amount } }
            });
        }

        await prisma.fuelTransfer.delete({ where: { id } });
        revalidateTag('fuel-transfers');
        revalidateTag('fuel-tanks');
        revalidatePath('/dashboard/fuel', 'page');
        revalidatePath('/dashboard/fuel/movement', 'page'); // [FIX]
        return { success: true };
    } catch (error) {
        console.error('deleteFuelTransfer Error:', error);
        return { success: false, error: 'Transfer silinemedi.' };
    }
}

export async function markFuelLogsAsFull(ids: string[]) {
    try {
        if (!ids || ids.length === 0) return { success: false, error: 'Kayıt seçilmedi.' };

        await prisma.fuelLog.updateMany({
            where: {
                id: { in: ids }
            },
            data: {
                fullTank: true
            }
        });


        revalidateTag('fuel-logs');
        revalidatePath('/dashboard/fuel', 'page');
        revalidatePath('/dashboard/fuel/movement', 'page'); // [FIX]
        return { success: true, count: ids.length };
    } catch (error) {
        console.error('markFuelLogsAsFull Error:', error);
        return { success: false, error: 'İşlem başarısız.' };
    }
}

