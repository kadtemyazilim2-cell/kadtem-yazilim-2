'use server';

import { prisma } from '@/lib/db';
import { VehicleAttendance } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function addVehicleAttendance(data: Partial<VehicleAttendance>) {
    try {
        if (!data.vehicleId || !data.date || !data.siteId) {
            console.error('addVehicleAttendance Missing Data:', data);
            return { success: false, error: 'Eksik bilgi (Araç, Tarih veya Şantiye).' };
        }

        // Ensure date is treated as UTC Noon to avoid timezone boundary shifts
        // (e.g. Midnight UTC might be Previous Day 21:00 in some contexts, but Noon is safe)
        const startOfDay = new Date(data.date);
        startOfDay.setUTCHours(12, 0, 0, 0);

        // Check for existing record
        const existing = await prisma.vehicleAttendance.findFirst({
            where: {
                vehicleId: data.vehicleId,
                date: startOfDay
            }
        });

        let attendance;
        const payload = {
            vehicleId: data.vehicleId,
            siteId: data.siteId,
            date: startOfDay,
            status: data.status || 'WORK',
            hours: data.hours || 8,
            note: data.note,
            createdByUserId: data.createdByUserId
        };

        if (existing) {
            // Update
            attendance = await prisma.vehicleAttendance.update({
                where: { id: existing.id },
                data: {
                    status: payload.status,
                    siteId: payload.siteId,
                    hours: payload.hours,
                    note: payload.note,
                    createdByUserId: payload.createdByUserId
                }
            });
        } else {
            // Create
            attendance = await prisma.vehicleAttendance.create({
                data: payload
            });
        }

        revalidatePath('/dashboard/vehicle-attendance');
        revalidatePath('/dashboard/admin');
        return { success: true, data: attendance };
    } catch (error: any) {
        console.error('addVehicleAttendance Error:', error);
        return { success: false, error: 'Kayıt hatası: ' + (error.message || error) };
    }
}

export async function deleteVehicleAttendance(vehicleId: string, date: string) {
    try {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        const result = await prisma.vehicleAttendance.deleteMany({
            where: {
                vehicleId: vehicleId,
                date: targetDate
            }
        });

        if (result.count === 0) {
            return { success: false, error: 'Silinecek kayıt bulunamadı.' };
        }

        revalidatePath('/dashboard/vehicle-attendance');
        return { success: true };
    } catch (error: any) {
        console.error('deleteVehicleAttendance Error:', error);
        return { success: false, error: 'Silme işlemi başarısız: ' + error.message };
    }
}

export async function getVehicleAttendanceList(siteId?: string, startDate?: Date, endDate?: Date) {
    try {
        const whereClause: any = {};

        if (siteId) {
            whereClause.siteId = siteId;
        }

        if (startDate && endDate) {
            // Ensure inputs are Dates (Next.js serialization sometimes passes strings)
            const start = new Date(startDate);
            const end = new Date(endDate);

            whereClause.date = {
                gte: start,
                lte: end
            };
        } else {
            // Default to recent if no details provided, as a fallback
            const cutoffDate = new Date('2025-01-01');
            whereClause.date = { gte: cutoffDate };
        }

        const records = await prisma.vehicleAttendance.findMany({
            take: 2000,
            where: whereClause,
            orderBy: { date: 'desc' }
        });

        // Convert Date objects to strings for client consumption
        const serializedRecords = records.map(record => ({
            ...record,
            date: record.date.toISOString(),
            // Ensure other potential dates are stringified if needed, 
            // but VehicleAttendance only has 'date' as per schema usually.
        }));

        return { success: true, data: serializedRecords };
    } catch (error: any) {
        console.error('getVehicleAttendanceList Error:', error);
        return { success: false, error: 'Araç puantaj listesi alınamadı.' };
    }
}
