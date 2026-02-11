'use server';

import { prisma } from '@/lib/db';
import { VehicleAttendance } from '@prisma/client';
import { revalidatePath, revalidateTag } from 'next/cache';
import { auth as getSession } from '@/auth';

// NOTE: Save operations now use the API route at /api/vehicle-attendance/save
// This server action is kept as a reference but is no longer called from the client.
export async function addVehicleAttendance(data: Partial<VehicleAttendance>) {
    try {
        const session = await getSession();
        let finalUserId = session?.user?.id;
        if (data.createdByUserId) finalUserId = data.createdByUserId;

        if (!data.vehicleId || !data.date) {
            return { success: false, error: 'Eksik veri: Araç veya Tarih yok.' };
        }

        const inputDate = typeof data.date === 'string' ? new Date(data.date) : new Date(data.date as Date);

        const startOfDay = new Date(inputDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(inputDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        const targetDateNoon = new Date(inputDate);
        targetDateNoon.setUTCHours(12, 0, 0, 0);

        const existingRecord = await prisma.vehicleAttendance.findFirst({
            where: {
                vehicleId: data.vehicleId!,
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        let result;
        if (existingRecord) {
            result = await prisma.vehicleAttendance.update({
                where: { id: existingRecord.id },
                data: {
                    date: targetDateNoon,
                    status: data.status,
                    siteId: data.siteId,
                    hours: parseFloat(data.hours?.toString() || '0'),
                    note: data.note,
                    createdByUserId: finalUserId,
                }
            });
        } else {
            result = await prisma.vehicleAttendance.create({
                data: {
                    vehicleId: data.vehicleId!,
                    siteId: data.siteId!,
                    date: targetDateNoon,
                    status: data.status || 'WORK',
                    hours: parseFloat(data.hours?.toString() || '0'),
                    note: data.note,
                    createdByUserId: finalUserId,
                }
            });
        }

        const plainResult = {
            id: result.id,
            vehicleId: result.vehicleId,
            siteId: result.siteId || '',
            date: result.date instanceof Date ? result.date.toISOString() : String(result.date),
            status: result.status,
            hours: Number(result.hours) || 0,
            note: result.note || null,
            createdByUserId: result.createdByUserId || null,
        };

        return { success: true as const, data: plainResult };

    } catch (error: any) {
        console.error('addVehicleAttendance error:', error);
        return { success: false as const, error: 'Kayıt başarısız: ' + (error?.message || 'unknown') };
    }
}

export async function deleteVehicleAttendance(vehicleId: string, date: Date | string) {
    try {
        const inputDate = new Date(date);

        const startOfDay = new Date(inputDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(inputDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const result = await prisma.vehicleAttendance.deleteMany({
            where: {
                vehicleId: vehicleId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        if (result.count === 0) {
            return { success: false, error: 'Silinecek kayıt bulunamadı.' };
        }

        revalidatePath('/dashboard/vehicle-attendance');
        revalidateTag('vehicle-attendance');
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
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);

            whereClause.date = {
                gte: start,
                lte: end
            };
        } else {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - 2);
            whereClause.date = { gte: cutoffDate };
        }

        const records = await prisma.vehicleAttendance.findMany({
            take: 2000,
            where: whereClause,
            include: {
                vehicle: {
                    select: {
                        id: true,
                        plate: true,
                        brand: true,
                        type: true,
                        status: true,
                        assignedSiteId: true,
                    }
                },
            },
            orderBy: {
                date: 'desc'
            }
        });

        // Full serialization: convert ALL Date fields to ISO strings
        // This prevents Next.js server action serialization failures
        const serializedRecords = JSON.parse(JSON.stringify(records, (key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        }));

        return { success: true, data: serializedRecords };
    } catch (error: any) {
        console.error('getVehicleAttendanceList Error:', error);
        return { success: false, error: 'Araç puantaj listesi alınamadı.' };
    }
}
