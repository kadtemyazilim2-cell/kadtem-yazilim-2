'use server';

import { prisma } from '@/lib/db';
import { Site } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function getSites() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        let whereClause: any = {};

        // [SCOPING] If not Admin, filter by assigned sites
        if (session.user.role !== 'ADMIN') {
            // Fetch fresh user data to get assigned sites
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                include: { assignedSites: true }
            });

            if (user) {
                const assignedSiteIds = user.assignedSites.map((s: { id: string }) => s.id);
                whereClause.id = { in: assignedSiteIds };
                // Also restrict to active if needed, but usually users see their inactive sites too?
                // Let's keep it broad for now, UI filters status.
            } else {
                return { success: false, error: 'Kullanıcı bulunamadı.' };
            }
        }

        const sites = await prisma.site.findMany({
            orderBy: { name: 'asc' },
            include: { company: true, partners: true, similarWorks: true },
            where: whereClause
        });
        return { success: true, data: sites };
    } catch (error) {
        console.error('getSites Error:', error);
        return { success: false, error: 'Şantiyeler getirilirken hata oluştu.' };
    }
}

export async function createSite(data: Partial<Site> & { companyId: string }) {
    try {
        // Exclude fields that are not in Site model or need special handling
        const {
            id,
            partners, // [NEW] Extract partners
            // Exclude relations prevents "NestedInput" errors if dirty object passed
            company,
            users,
            personnel,
            vehicles,
            activeVehicles,
            fuelTanks,
            fuelLogs,
            transactions,
            logs,
            correspondences,

            // Exclude fields not in Prisma schema
            currentUfeDate,
            remainingAmount,
            contractToCurrentUfeRatio,
            currentWorkExperienceAmount,
            priceDifference,
            completionPercentage,
            // personnelCount, // [KEPT] Now in schema
            // note, // [KEPT] Now in schema
            ...rest
        } = data as any;

        // Helper to ensure dates are Date objects
        const dateFields = [
            'announcementDate', 'tenderDate', 'contractDate', 'siteDeliveryDate',
            'completionDate', 'extendedDate', 'provisionalAcceptanceDate',
            'finalAcceptanceDate'
        ];

        const processedData = { ...rest };

        for (const field of dateFields) {
            const val = processedData[field];
            if (val === '' || val === null || val === undefined) {
                processedData[field] = null;
            } else if (typeof val === 'string') {
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                    processedData[field] = d;
                } else {
                    processedData[field] = null;
                }
            }
        }

        // Automated Status Logic
        if (processedData.provisionalAcceptanceDate) {
            processedData.status = 'COMPLETED';
        } else if (!processedData.status) {
            processedData.status = 'ACTIVE';
        }

        console.log('Creating Site with processed data:', processedData);

        // Duplicate Check
        const existingSite = await prisma.site.findFirst({
            where: {
                name: data.name!,
                companyId: data.companyId
            }
        });

        if (existingSite) {
            console.log('Duplicate Site creation attempted. Returning existing site:', existingSite.id);
            return { success: true, data: existingSite };
        }

        // Prepare Partners logic
        const partnersToCreate = (partners || []).map((p: any) => ({
            companyId: p.companyId,
            percentage: Number(p.percentage)
        })).filter((p: any) => p.companyId && p.percentage);

        const site = await prisma.site.create({
            data: {
                ...processedData,
                name: data.name!,
                companyId: data.companyId,
                partners: {
                    create: partnersToCreate
                },
                similarWorks: {
                    create: (data.similarWorks || []).map((w: any) => ({
                        group: w.group,
                        code: w.code,
                        amount: Number(w.amount)
                    })).filter((w: any) => w.group)
                }
            }
        });

        console.log('Site Created:', { id: site.id, name: site.name, companyId: site.companyId });
        revalidatePath('/dashboard/admin');
        revalidatePath('/dashboard/sites');
        return { success: true, data: site };
    } catch (error: any) {
        console.error('createSite Error:', error);
        return { success: false, error: 'Şantiye oluşturulamadı: ' + (error.message || String(error)) };
    }
}

export async function updateSite(id: string, data: Partial<Site>) {
    try {
        const {
            partners,
            // Exclude relations to prevent nested write errors
            company,
            users,
            personnel,
            vehicles,
            activeVehicles,
            fuelTanks,
            fuelLogs,
            transactions,
            logs,
            correspondences,

            // Exclude computed/extra fields
            currentUfeDate,
            contractToCurrentUfeRatio,
            currentWorkExperienceAmount,
            priceDifference,
            completionPercentage,
            // personnelCount,
            // note,

            ...rest
        } = data as any;

        // Date processing helper
        const dateFields = [
            'announcementDate', 'tenderDate', 'contractDate', 'siteDeliveryDate',
            'completionDate', 'extendedDate', 'provisionalAcceptanceDate',
            'finalAcceptanceDate'
        ];

        const processedData = { ...rest };

        for (const field of dateFields) {
            if (field in processedData) {
                const val = processedData[field];
                if (val === '' || val === null || val === undefined) {
                    processedData[field] = null;
                } else if (typeof val === 'string') {
                    const d = new Date(val);
                    processedData[field] = !isNaN(d.getTime()) ? d : null;
                }
            }
        }

        // Automated Status Logic based on Dates
        if (processedData.provisionalAcceptanceDate) {
            processedData.status = 'COMPLETED';
        }

        // Handle Partners: Delete all and re-create for simplicity
        // Note: In production, might want 'upsert' to preserve IDs, but here simpler.
        const partnerOperations = partners ? {
            partners: {
                deleteMany: {},
                create: partners.map((p: any) => ({
                    companyId: p.companyId,
                    percentage: Number(p.percentage)
                })).filter((p: any) => p.companyId && p.percentage)
            }
        } : {};

        // Similar Works Update Logic
        const similarWorksOperations = data.similarWorks ? {
            similarWorks: {
                deleteMany: {},
                create: data.similarWorks.map((w: any) => ({
                    group: w.group,
                    code: w.code,
                    amount: Number(w.amount)
                })).filter((w: any) => w.group)
            }
        } : {};

        // MAIN UPDATE
        const site = await prisma.site.update({
            where: { id },
            data: {
                ...processedData,
                ...partnerOperations,
                ...similarWorksOperations
            }
        });

        // [NEW] Cascade Status to Fuel Tanks
        if (data.status) {
            await prisma.fuelTank.updateMany({
                where: { siteId: id },
                data: { status: data.status }
            });
        }

        revalidatePath('/dashboard/admin');
        revalidatePath('/dashboard/sites');
        return { success: true, data: site };
    } catch (error: any) {
        console.error('updateSite Error:', error);
        return { success: false, error: 'Şantiye güncellenemedi: ' + (error.message || String(error)) };
    }
}


export async function fixSiteStatuses() {
    try {
        const session = await auth();
        if (session?.user?.role !== 'ADMIN') return { success: false, error: 'Yetkisiz işlem.' };

        const result = await prisma.site.updateMany({
            where: {
                provisionalAcceptanceDate: { not: null },
                status: 'ACTIVE'
            },
            data: {
                status: 'INACTIVE'
            }
        });

        revalidatePath('/dashboard/admin');
        revalidatePath('/dashboard/sites');
        return { success: true, count: result.count };
    } catch (error) {
        console.error('fixSiteStatuses Error:', error);
        return { success: false, error: 'Toplu güncelleme hatası.' };
    }
}

export async function deleteSite(id: string) {
    try {
        const fuelLogCount = await prisma.fuelLog.count({ where: { siteId: id } });
        if (fuelLogCount > 0) return { success: false, error: `Bu şantiyeye ait ${fuelLogCount} adet yakıt kaydı bulunmaktadır.` };

        const transactionCount = await prisma.cashTransaction.count({ where: { siteId: id } });
        if (transactionCount > 0) return { success: false, error: `Bu şantiyeye ait ${transactionCount} adet kasa hareketi bulunmaktadır.` };

        // [FIX] Exclude soft-deleted correspondences
        const correspondenceCount = await prisma.correspondence.count({
            where: {
                siteId: id,
                status: { not: 'DELETED' }
            }
        });
        if (correspondenceCount > 0) return { success: false, error: `Bu şantiyeye ait ${correspondenceCount} adet aktif yazışma bulunmaktadır.` };

        const fuelTankCount = await prisma.fuelTank.count({ where: { siteId: id } });
        if (fuelTankCount > 0) return { success: false, error: `Bu şantiyede tanımlı ${fuelTankCount} adet yakıt deposu bulunmaktadır.` };

        const vehicleCount = await prisma.vehicle.count({
            where: {
                assignedSiteId: id,
                status: { not: 'MAINTENANCE' } // Or strict check? Usually just existence.
                // Vehicles are important, usually require explicit unassignment.
            }
        });
        if (vehicleCount > 0) return { success: false, error: `Bu şantiyeye atanmış ${vehicleCount} adet araç bulunmaktadır.` };

        const personnelCount = await prisma.personnel.count({
            where: {
                siteId: id,
                status: 'ACTIVE' // Only active personnel block? Or all? Let's say Active.
            }
        });
        if (personnelCount > 0) return { success: false, error: `Bu şantiyede çalışan ${personnelCount} adet aktif personel bulunmaktadır.` };

        await prisma.site.delete({ where: { id } });
        revalidatePath('/dashboard/admin');
        revalidatePath('/dashboard/sites');
        return { success: true };
    } catch (error) {
        console.error('deleteSite Error:', error);
        return { success: false, error: 'Şantiye silinemedi.' };
    }
}
