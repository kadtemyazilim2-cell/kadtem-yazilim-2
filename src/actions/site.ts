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
        const { id, company, ...rest } = data as any;

        // Helper to ensure dates are Date objects (Server Actions receive them as strings)
        const dateFields = [
            'announcementDate', 'tenderDate', 'contractDate', 'siteDeliveryDate',
            'completionDate', 'extendedDate', 'provisionalAcceptanceDate',
            'finalAcceptanceDate'
        ];

        const processedData = { ...rest };

        for (const field of dateFields) {
            if (processedData[field] && typeof processedData[field] === 'string') {
                processedData[field] = new Date(processedData[field]);
            }
        }

        console.log('Creating Site with processed data:', processedData);

        const site = await prisma.site.create({
            data: {
                ...processedData,
                name: data.name!,
                companyId: data.companyId,
                status: data.status || 'ACTIVE',
            }
        });
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
