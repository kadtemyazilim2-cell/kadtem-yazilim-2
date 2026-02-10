'use server';

import { prisma } from '@/lib/db';
import { VehicleAttendance } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auth as getSession } from '@/auth'; // Ensure this import exists or use correct auth method

export async function addVehicleAttendance(data: Partial<VehicleAttendance>) {
    try {
        console.log('Server Action: addVehicleAttendance called with:', JSON.stringify(data, null, 2));

        if (!data.vehicleId || !data.date || !data.siteId) {
            console.error('addVehicleAttendance Missing Data:', data);
            return { success: false, error: 'Eksik bilgi (Araç, Tarih veya Şantiye).' };
        }

        // Ensure date is treated as UTC Noon to avoid timezone boundary shifts
        const startOfDay = new Date(data.date);
        startOfDay.setUTCHours(12, 0, 0, 0);

        console.log('Server Action: Normalized Date:', startOfDay.toISOString());

        // Validate createdByUserId if present
        let finalUserId = data.createdByUserId;
        if (finalUserId) {
            const userExists = await prisma.user.findUnique({ where: { id: finalUserId } });
            if (!userExists) {
                console.warn(`Server Action: User ${finalUserId} not found, stripping ID.`);
                finalUserId = null; // or undefined, to avoid FK error
            }
        }

        // Use manual upsert to be robust against stale Prisma Client definitions
        // (i.e., if 'vehicleId_date' is not yet known to the client)
        console.log(`Server Action: Checking existence for Vehicle: ${data.vehicleId}, Date: ${startOfDay.toISOString()}`);

        const existingRecord = await prisma.vehicleAttendance.findFirst({
            where: {
                vehicleId: data.vehicleId!,
                date: startOfDay
            }
        });

        let result;
        if (existingRecord) {
            console.log('Server Action: Updating existing record:', existingRecord.id);
            result = await prisma.vehicleAttendance.update({
                where: { id: existingRecord.id },
                data: {
                    status: data.status,
                    siteId: data.siteId,
                    hours: parseFloat(data.hours?.toString() || '0'),
                    note: data.note,
                    createdByUserId: finalUserId,
                }
            });
        } else {
            console.log('Server Action: Creating new record');
            result = await prisma.vehicleAttendance.create({
                data: {
                    vehicleId: data.vehicleId!,
                    siteId: data.siteId!,
                    date: startOfDay,
                    status: data.status || 'WORK',
                    hours: parseFloat(data.hours?.toString() || '0'),
                    note: data.note,
                    createdByUserId: finalUserId,
                }
            });
        }

        console.log('Server Action: Saved successfully:', result.id);

        revalidatePath('/dashboard/vehicle-attendance');
        return { success: true, data: result };

    } catch (error: any) {
        console.error('addVehicleAttendance Error:', error);
        return { success: false, error: 'Kayıt sırasında bir hata oluştu: ' + (error.message || error) };
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
    console.log('Server Action: getVehicleAttendanceList called', { siteId, startDate, endDate });
    try {
        const whereClause: any = {};

        if (siteId) {
            whereClause.siteId = siteId;
        }

        if (startDate && endDate) {
            // Ensure inputs are Dates (Next.js serialization sometimes passes strings)
            const start = new Date(startDate);
            const end = new Date(endDate);
            console.log('Server Action: Query Date Range:', { start: start.toISOString(), end: end.toISOString() });

            whereClause.date = {
                gte: start,
                lte: end
            };
        } else {
            // Default to recent if no details provided, as a fallback
            const cutoffDate = new Date('2025-01-01');
            whereClause.date = { gte: cutoffDate };
        }

        console.log('Server Action: Querying with where clause:', JSON.stringify(whereClause, null, 2));

        const records = await prisma.vehicleAttendance.findMany({
            take: 2000,
            where: whereClause,
            include: {
                vehicle: true,
            },
            orderBy: {
                date: 'desc'
            }
        });

        console.log(`Server Action: Found ${records.length} records`);

        // Convert Date objects to strings for client consumption
        const serializedRecords = records.map(record => ({
            ...record,
            date: record.date.toISOString(),
        }));

        return { success: true, data: serializedRecords };
    } catch (error: any) {
        console.error('getVehicleAttendanceList Error:', error);
        return { success: false, error: 'Araç puantaj listesi alınamadı.' };
    }
}
