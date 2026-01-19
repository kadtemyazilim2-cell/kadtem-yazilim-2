'use server';

import { prisma } from '@/lib/db';
import { FuelLog, FuelTank } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getFuelLogs() {
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

export async function createFuelLog(data: Partial<FuelLog>) {
    try {
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

        // Update Tank Level if internal tank used
        if (data.tankId) {
            await prisma.fuelTank.update({
                where: { id: data.tankId },
                data: {
                    currentLevel: { decrement: data.liters }
                }
            });
        }

        revalidatePath('/dashboard/fuel');
        return { success: true, data: log };
    } catch (error) {
        console.error('createFuelLog Error:', error);
        return { success: false, error: 'Yakıt kaydı eklenemedi.' };
    }
}

export async function getFuelTanks() {
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
