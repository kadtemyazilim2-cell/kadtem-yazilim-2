'use server';

import { prisma } from '@/lib/db';
import { VehicleAttendance } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function addVehicleAttendance(data: Partial<VehicleAttendance>) {
    try {
        // Check for existing record to avoid duplicates (upsert logic or check-then-create)
        // Since ID is generated on client as UUID, we might use upsert if we trust the ID,
        // but robustly we should match by vehicleId + date + siteId?
        // User logic allows same day different site? No, checking logic in client: `existingRecord && existingRecord.siteId !== selectedSiteId`.
        // So uniqueness constraint is typically Vehicle + Date.

        if (!data.vehicleId || !data.date || !data.siteId) {
            return { success: false, error: 'Eksik bilgi.' };
        }

        // Check if record exists for this vehicle on this date
        const existing = await prisma.vehicleAttendance.findFirst({
            where: {
                vehicleId: data.vehicleId,
                date: data.date
            }
        });

        let attendance;
        if (existing) {
            // Update
            attendance = await prisma.vehicleAttendance.update({
                where: { id: existing.id },
                data: {
                    status: data.status,
                    siteId: data.siteId, // Allow moving site
                    hours: data.hours || 8,
                    note: data.note,
                    createdByUserId: data.createdByUserId
                }
            });
        } else {
            // Create
            attendance = await prisma.vehicleAttendance.create({
                data: {
                    vehicleId: data.vehicleId,
                    siteId: data.siteId,
                    date: data.date,
                    status: data.status || 'WORK',
                    hours: data.hours || 8,
                    note: data.note,
                    createdByUserId: data.createdByUserId
                }
            });
        }

        revalidatePath('/dashboard/vehicle-attendance');
        revalidatePath('/dashboard/admin'); // In case it affects reports
        return { success: true, data: attendance };
    } catch (error: any) {
        console.error('addVehicleAttendance Error:', error);
        return { success: false, error: 'Puantaj kaydedilemedi: ' + error.message };
    }
}

export async function deleteVehicleAttendance(vehicleId: string, date: string) {
    try {
        const result = await prisma.vehicleAttendance.deleteMany({
            where: {
                vehicleId: vehicleId,
                date: date
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
