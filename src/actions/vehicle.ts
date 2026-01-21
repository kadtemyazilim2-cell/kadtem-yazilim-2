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

export async function createVehicle(data: Partial<Vehicle>) {
    try {
        // Ensure constraints
        if (!data.plate || !data.brand || !data.model || !data.companyId) {
            return { success: false, error: 'Eksik bilgi (Plaka, Marka, Model veya Firma).' };
        }

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
                assignedSiteId: data.assignedSiteId || null,
                companyId: data.companyId!, // Checked above or enforced by types now

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
                plate: data.plate,
                brand: data.brand,
                model: data.model,
                year: data.year,
                type: data.type,
                ownership: data.ownership,
                status: data.status,
                meterType: data.meterType,
                currentKm: data.currentKm,

                insuranceExpiry: data.insuranceExpiry,
                kaskoExpiry: data.kaskoExpiry,
                inspectionExpiry: data.inspectionExpiry,
                lastInspectionDate: data.lastInspectionDate,

                insuranceCost: data.insuranceCost,
                kaskoCost: data.kaskoCost,
                insuranceAgency: data.insuranceAgency,
                kaskoAgency: data.kaskoAgency, // Ensure these schema fields are mapped if they exist in Partial<Vehicle>

                assignedSiteId: data.assignedSiteId || null,
                companyId: data.companyId, // companyId is required, must be valid

                rentalCompanyName: data.rentalCompanyName,
                rentalContact: data.rentalContact,
                monthlyRentalFee: data.monthlyRentalFee,

                engineNumber: data.engineNumber,
                chassisNumber: data.chassisNumber,
                fuelType: data.fuelType,
                licenseFile: data.licenseFile
            }
        });
        revalidatePath('/dashboard/vehicles');
        return { success: true, data: vehicle };
    } catch (error: any) {
        console.error('updateVehicle Error:', error);
        return { success: false, error: error.message || 'Araç güncellenemedi.' };
    }
}

export async function deleteVehicle(id: string) {
    try {
        await prisma.vehicle.delete({
            where: { id }
        });
        revalidatePath('/dashboard/vehicles');
        return { success: true };
    } catch (error) {
        console.error('deleteVehicle Error:', error);
        return { success: false, error: 'Araç silinemedi.' };
    }
}
