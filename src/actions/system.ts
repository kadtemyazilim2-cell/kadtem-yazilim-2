'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

/**
 * Resets the database by deleting all operational data.
 * Keeps only the 'admin' user.
 */
export async function resetDatabase() {
    try {
        console.log("!!! DATABASE RESET INITIATED !!!");

        await prisma.$transaction(async (tx) => {
            // 1. Delete Leafs (Logs, Transactions, etc.)
            await tx.fuelLog.deleteMany({});
            await tx.fuelTransfer.deleteMany({});
            await tx.cashTransaction.deleteMany({});
            await tx.correspondence.deleteMany({});
            await tx.siteLogEntry.deleteMany({});
            await tx.personnelAttendance.deleteMany({});
            await tx.vehicleAttendance.deleteMany({});

            // 2. Delete Assets (Foreign Keys to Sites/Companies)
            // Note: FuelTanks depend on Sites. Vehicles depend on Companies. Personnel on Sites.
            await tx.fuelTank.deleteMany({});
            await tx.personnel.deleteMany({});

            // Vehicles have self-relations (transfers) but we deleted transfers first.
            await tx.vehicle.deleteMany({});

            // 3. Delete Structure
            await tx.site.deleteMany({});
            await tx.company.deleteMany({});
            await tx.yiUfeRate.deleteMany({});
            await tx.institution.deleteMany({});

            // 4. Delete Users (Except Admin)
            await tx.user.deleteMany({
                where: {
                    username: {
                        not: 'admin'
                    }
                }
            });

            // 5. Reset Admin User Permissions/Defaults if needed? 
            // For now, we trust the admin user record stays as is.
        });

        console.log("!!! DATABASE RESET COMPLETED !!!");

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("DATABASE RESET FAILED:", error);
        return { success: false, error: 'Sıfırlama işlemi başarısız oldu.' };
    }
}
