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
            include: { company: true },
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
        // Exclude id if present (let DB generate it) and any relation objects
        // Exclude id and known non-schema fields
        const {
            id,
            company,
            // Exclude fields not in Prisma schema to avoid Unknown Argument Error
            currentUfeDate,
            remainingAmount,
            contractToCurrentUfeRatio,
            currentWorkExperienceAmount,
            priceDifference,
            completionPercentage,
            personnelCount,
            note,
            ...rest
        } = data as any;

        // Helper to ensure dates are Date objects (Server Actions receive them as strings)
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
                    processedData[field] = null; // invalid date string
                }
            }
        }

        console.log('Creating Site with processed data:', processedData);

        // [FIX] Duplicate Prevention: Check if site already exists
        const existingSite = await prisma.site.findFirst({
            where: {
                name: data.name!,
                companyId: data.companyId
            }
        });

        if (existingSite) {
            console.log('Duplicate Site creation attempted. Returning existing site:', existingSite.id);
            // Return success but with existing site. This handles double-clicks gracefully.
            return { success: true, data: existingSite };
        }

        const site = await prisma.site.create({
            data: {
                ...processedData,
                // Explicitly ensure 'name' is what we expect and no 'id' was passed (processedData has id removed?)
                name: data.name!,
                companyId: data.companyId,
                status: data.status || 'ACTIVE',
            }
        });

        console.log('Site Created:', { id: site.id, name: site.name, companyId: site.companyId });
        revalidatePath('/dashboard/admin');
        revalidatePath('/dashboard/sites');
        return { success: true, data: site };
    } catch (error) {
        console.error('createSite Error:', error);
        return { success: false, error: 'Şantiye oluşturulamadı.' };
    }
}

export async function updateSite(id: string, data: Partial<Site>) {
    try {
        // [AUTOMATION] If Provisional Acceptance Date is set, force status to INACTIVE
        if (data.provisionalAcceptanceDate) {
            data.status = 'INACTIVE';
        }

        const site = await prisma.site.update({
            where: { id },
            data: {
                ...data
            }
        });
        revalidatePath('/dashboard/admin');
        revalidatePath('/dashboard/sites');
        return { success: true, data: site };
    } catch (error) {
        console.error('updateSite Error:', error);
        return { success: false, error: 'Şantiye güncellenemedi.' };
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
        await prisma.site.delete({ where: { id } });
        revalidatePath('/dashboard/admin');
        revalidatePath('/dashboard/sites');
        return { success: true };
    } catch (error) {
        console.error('deleteSite Error:', error);
        return { success: false, error: 'Şantiye silinemedi.' };
    }
}
