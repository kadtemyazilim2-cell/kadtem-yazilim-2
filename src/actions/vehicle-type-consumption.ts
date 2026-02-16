'use server';

import prisma from '@/lib/prisma';
import { VehicleType } from '@prisma/client';

export async function getVehicleTypeConsumptions() {
    try {
        const data = await prisma.vehicleTypeConsumption.findMany();
        return { success: true, data };
    } catch (error) {
        console.error('[getVehicleTypeConsumptions] Error:', error);
        return { success: false, error: 'Veriler alınamadı.', data: [] };
    }
}

export async function upsertVehicleTypeConsumption(
    vehicleType: string,
    field: 'consumptionMin' | 'consumptionMax',
    value: number | null
) {
    try {
        const updateData = { [field]: value };

        const result = await prisma.vehicleTypeConsumption.upsert({
            where: { vehicleType: vehicleType as VehicleType },
            update: updateData,
            create: {
                vehicleType: vehicleType as VehicleType,
                ...updateData
            }
        });

        return { success: true, data: result };
    } catch (error) {
        console.error('[upsertVehicleTypeConsumption] Error:', error);
        return { success: false, error: 'Güncelleme başarısız.' };
    }
}
