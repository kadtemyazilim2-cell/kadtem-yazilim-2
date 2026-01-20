'use server';

import { prisma } from '@/lib/db';
import { Correspondence } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function createCorrespondence(data: Omit<Correspondence, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        const correspondence = await prisma.correspondence.create({
            data: {
                companyId: data.companyId,
                siteId: data.siteId || null,
                date: new Date(data.date), // Ensure it's Date object for Prisma
                direction: data.direction,
                type: data.type,
                subject: data.subject,
                description: data.description,
                referenceNumber: data.referenceNumber,
                senderReceiver: data.senderReceiver,
                senderReceiverAlignment: data.senderReceiverAlignment,
                registrationNumber: data.registrationNumber,
                interest: data.interest || [],
                appendices: data.appendices || [],
                attachmentUrls: data.attachmentUrls || [],
                createdByUserId: data.createdByUserId,
                status: 'ACTIVE',
            }
        });
        revalidatePath('/dashboard/correspondence');
        return { success: true, data: correspondence };
    } catch (error: any) {
        console.error('createCorrespondence Error:', error);
        return { success: false, error: error.message || 'Yazışma eklenemedi.' };
    }
}

export async function updateCorrespondence(id: string, data: Partial<Correspondence>) {
    try {
        const payload: any = { ...data };
        if (payload.date) payload.date = new Date(payload.date);

        const correspondence = await prisma.correspondence.update({
            where: { id },
            data: payload
        });
        revalidatePath('/dashboard/correspondence');
        return { success: true, data: correspondence };
    } catch (error) {
        console.error('updateCorrespondence Error:', error);
        return { success: false, error: 'Yazışma güncellenemedi.' };
    }
}

export async function deleteCorrespondence(id: string) {
    try {
        await prisma.correspondence.delete({
            where: { id }
        });
        revalidatePath('/dashboard/correspondence');
        return { success: true };
    } catch (error) {
        console.error('deleteCorrespondence Error:', error);
        return { success: false, error: 'Yazışma silinemedi.' };
    }
}

export async function getCorrespondenceList() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        let whereClause: any = { status: 'ACTIVE' };

        // [SCOPING] If not Admin, filter by assigned sites
        if (session.user.role !== 'ADMIN') {
            // Fetch fresh user data to get assigned sites
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                include: { assignedSites: true }
            });

            if (user) {
                const assignedSiteIds = user.assignedSites.map((s: { id: string }) => s.id);
                // Filter: Must be in assigned sites. 
                // Determine policy for "Company General" (siteId=null). 
                // Usually restricted users only see their sites. 
                // If they need generic ones, we'd add 'OR siteId is null'. 
                // Sticking to strict site scoping for now.
                whereClause.siteId = { in: assignedSiteIds };
            } else {
                return { success: false, error: 'Kullanıcı bulunamadı.' };
            }
        }

        const list = await prisma.correspondence.findMany({
            orderBy: { date: 'desc' },
            where: whereClause
        });
        return { success: true, data: list };
    } catch (error) {
        console.error('getCorrespondenceList Error:', error);
        return { success: false, error: 'Yazışmalar alınamadı.', data: [] };
    }
}
