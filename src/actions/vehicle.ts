'use server';

import { prisma } from '@/lib/db';
import { Vehicle } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getVehicles() {
    try {
        const vehicles = await prisma.vehicle.findMany({
            orderBy: { plate: 'asc' },
            include: {
                company: true,
                assignedSite: true
            }
        });
        return { success: true, data: vehicles };
    } catch (error) {
        console.error('getVehicles Error:', error);
        return { success: false, error: 'Araçlar getirilirken hata oluştu.' };
    }
}

export async function createVehicle(data: Partial<Vehicle> & { companyId: string }) {
    try {
        const vehicle = await prisma.vehicle.create({
            data: {
                id: data.id, // Optional, usually auto-generated but might be passed
                companyId: data.companyId,
                plate: data.plate!,
                brand: data.brand!,
                model: data.model!,
                year: data.year!,
                type: data.type!,
                ownership: data.ownership || 'OWNED',
                currentKm: data.currentKm || 0,
                status: data.status || 'ACTIVE',
                meterType: data.meterType || 'KM',
                insuranceExpiry: data.insuranceExpiry,
                kaskoExpiry: data.kaskoExpiry,
                assignedSiteId: data.assignedSiteId
            }
        });
        revalidatePath('/dashboard/vehicles');
        return { success: true, data: vehicle };
    } catch (error) {
        console.error('createVehicle Error:', error);
        return { success: false, error: 'Araç eklenemedi.' };
    }
}

export async function updateVehicle(id: string, data: Partial<Vehicle>) {
    try {
        const vehicle = await prisma.vehicle.update({
            where: { id },
            data: {
                ...data
            }
        });
        revalidatePath('/dashboard/vehicles');
        return { success: true, data: vehicle };
    } catch (error) {
        console.error('updateVehicle Error:', error);
        return { success: false, error: 'Araç güncellenemedi.' };
    }
}
