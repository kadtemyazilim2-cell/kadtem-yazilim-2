'use server';

import { prisma } from '@/lib/db';
import { VehicleAttendance } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auth as getSession } from '@/auth';

export async function addVehicleAttendance(data: Partial<VehicleAttendance>) {
    const logs: string[] = [];
    const log = (msg: string, ...args: any[]) => {
        const line = msg + ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
        console.log(line);
        logs.push(line);
    };

    log('--- Server Action: addVehicleAttendance START ---');
    log('Payload:', data);

    try {
        const session = await getSession();
        log('Session User:', session?.user?.id);

        let finalUserId = session?.user?.id;
        if (data.createdByUserId) finalUserId = data.createdByUserId;

        // Validation
        if (!data.vehicleId || !data.date) {
            console.error('❌ Missing required fields: vehicleId or date');
            return { success: false, error: 'Eksik veri: Araç veya Tarih yok.', logs };
        }

        // Normalize Date
        let startOfDay;
        if (typeof data.date === 'string') {
            startOfDay = new Date(data.date);
        } else {
            startOfDay = new Date(data.date as Date);
        }

        // Force UTC Noon
        startOfDay.setUTCHours(12, 0, 0, 0);

        log('Normalized Date (UTC Noon):', startOfDay.toISOString());

        // Use manual upsert
        log(`Checking existence for Vehicle: ${data.vehicleId}, Date: ${startOfDay.toISOString()}`);

        const existingRecord = await prisma.vehicleAttendance.findFirst({
            where: {
                vehicleId: data.vehicleId!,
                date: startOfDay
            }
        });

        let result;
        if (existingRecord) {
            log('✅ Found existing record:', existingRecord.id, '-> UPDATING');
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
            log('Update Result ID:', result.id);
        } else {
            log('🆕 New record -> CREATING');

            if (!data.siteId) {
                log('⚠️ Creating without Site ID! This might cause display issues.');
            }

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
            log('Create Result ID:', result.id);
        }

        revalidatePath('/dashboard/vehicle-attendance');
        log('--- Server Action: addVehicleAttendance SUCCESS ---');
        return { success: true, data: result, logs };

    } catch (error: any) {
        console.error('❌ addVehicleAttendance EXCEPTION:', error);
        log('EXCEPTION:', error.message);
        return { success: false, error: 'Kayıt başarısız: ' + error.message, logs };
    }
}

export async function deleteVehicleAttendance(vehicleId: string, date: Date | string) {
    try {
        const targetDate = new Date(date);
        targetDate.setUTCHours(12, 0, 0, 0);

        console.log(`Server Action: Deleting for ${vehicleId} at ${targetDate.toISOString()}`);

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
    const logs: string[] = [];
    const log = (msg: string, ...args: any[]) => {
        const line = msg + ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
        console.log(line);
        logs.push(line);
    };

    log('Server Action: getVehicleAttendanceList called', { siteId, startDate, endDate });
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

            log('Server Action: Normalized Query Date Range:', { start: start.toISOString(), end: end.toISOString() });

            whereClause.date = {
                gte: start,
                lte: end
            };
        } else {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - 2);
            whereClause.date = { gte: cutoffDate };
        }

        log('Server Action: Executing Query with:', JSON.stringify(whereClause, null, 2));

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

        log(`Server Action: Query Result Count: ${records.length}`);

        // [DEBUG] Check if our specific target record is in the results
        const targetId = 'cmlgglqr1000bfadb5dpg95gx';
        const foundTarget = records.find(r => r.id === targetId);
        if (foundTarget) {
            log('✅ TARGET RECORD FOUND IN RESULTS:', targetId);
        } else {
            log('❌ TARGET RECORD NOT FOUND IN RESULTS:', targetId);
            // Double check if it exists at all with a direct query
            const directCheck = await prisma.vehicleAttendance.findUnique({ where: { id: targetId } });
            if (directCheck) {
                log('⚠️ Record exists in DB but missed by query filter!', directCheck);
                log('Reason check -> Record Date:', directCheck.date.toISOString());
                const s = new Date(startDate || ''); s.setUTCHours(0, 0, 0, 0);
                const e = new Date(endDate || ''); e.setUTCHours(23, 59, 59, 999);
                log('Compare: ', {
                    recordDate: directCheck.date.getTime(),
                    start: s.getTime(),
                    end: e.getTime(),
                    inRange: directCheck.date.getTime() >= s.getTime() && directCheck.date.getTime() <= e.getTime()
                });
            }
        }

        const serializedRecords = records.map(record => ({
            ...record,
            date: record.date.toISOString(),
        }));

        return { success: true, data: serializedRecords, logs };
    } catch (error: any) {
        console.error('getVehicleAttendanceList Error:', error);
        return { success: false, error: 'Araç puantaj listesi alınamadı.', logs };
    }
}
