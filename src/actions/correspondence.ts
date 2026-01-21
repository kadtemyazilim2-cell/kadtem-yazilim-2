'use server';

import { prisma } from '@/lib/db';
import { Correspondence } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function createCorrespondence(data: Omit<Correspondence, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        // Permission Check
        const user = session.user;
        if (user.role !== 'ADMIN') {
            let requiredModule = '';
            if (data.type === 'BANK') requiredModule = 'correspondence.bank';
            else if (data.direction === 'INCOMING') requiredModule = 'correspondence.incoming';
            else requiredModule = 'correspondence.outgoing';

            const perms = user.permissions?.[requiredModule] || [];
            if (!perms.includes('CREATE')) {
                return { success: false, error: 'Bu işlem için yetkiniz bulunmamaktadır.' };
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            let regNum = data.registrationNumber;

            // Auto-Generate Document Number for OUTGOING if empty
            if (data.direction === 'OUTGOING' && !regNum) {
                const company = await tx.company.findUnique({
                    where: { id: data.companyId }
                });

                if (company) {
                    const nextNum = company.currentDocumentNumber || 1;
                    // Format: YYYY/Number - Standard business practice
                    // or just Number. User asked for "Sequential Numbering" matching the input "Start Number".
                    // If I input 100, I expect 100, 101.
                    // I will use just the number to match the input exactly.
                    regNum = String(nextNum);

                    await tx.company.update({
                        where: { id: data.companyId },
                        data: { currentDocumentNumber: nextNum + 1 }
                    });
                }
            }

            return await tx.correspondence.create({
                data: {
                    companyId: data.companyId,
                    siteId: data.siteId || null,
                    date: new Date(data.date),
                    direction: data.direction,
                    type: data.type,
                    subject: data.subject,
                    description: data.description,
                    referenceNumber: data.referenceNumber,
                    senderReceiver: data.senderReceiver,
                    senderReceiverAlignment: data.senderReceiverAlignment,
                    registrationNumber: regNum,
                    interest: data.interest || [],
                    appendices: data.appendices || [],
                    attachmentUrls: data.attachmentUrls || [],
                    createdByUserId: data.createdByUserId,
                    includeStamp: data.includeStamp || false,
                    status: 'ACTIVE',
                }
            });
        });
        const correspondence = result;
        revalidatePath('/dashboard/correspondence');
        return { success: true, data: correspondence };
    } catch (error: any) {
        console.error('createCorrespondence Error:', error);
        return { success: false, error: error.message || 'Yazışma eklenemedi.' };
    }
}

export async function updateCorrespondence(id: string, data: Partial<Correspondence>) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        // 1. Fetch existing to determine module
        const existing = await prisma.correspondence.findUnique({ where: { id } });
        if (!existing) return { success: false, error: 'Kayıt bulunamadı.' };

        // Permission Check
        const user = session.user;
        if (user.role !== 'ADMIN') {
            let requiredModule = '';
            // Use existing data to verify type/direction
            if (existing.type === 'BANK') requiredModule = 'correspondence.bank';
            else if (existing.direction === 'INCOMING') requiredModule = 'correspondence.incoming';
            else requiredModule = 'correspondence.outgoing';

            const perms = user.permissions?.[requiredModule] || [];
            if (!perms.includes('EDIT')) {
                return { success: false, error: 'Bu işlem için düzenleme yetkiniz bulunmamaktadır.' };
            }

            // Date Restriction Check (Backend Enforcement)
            if (user.editLookbackDays !== undefined) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const target = new Date(existing.date);
                target.setHours(0, 0, 0, 0);
                const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

                if (diff > user.editLookbackDays) {
                    return { success: false, error: `Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.` };
                }
            }
        }

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
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        // 1. Fetch existing
        const existing = await prisma.correspondence.findUnique({ where: { id } });
        if (!existing) return { success: false, error: 'Kayıt bulunamadı.' };

        // Permission Check
        const user = session.user;
        if (user.role !== 'ADMIN') {
            let requiredModule = '';
            if (existing.type === 'BANK') requiredModule = 'correspondence.bank';
            else if (existing.direction === 'INCOMING') requiredModule = 'correspondence.incoming';
            else requiredModule = 'correspondence.outgoing';

            const perms = user.permissions?.[requiredModule] || [];
            if (!perms.includes('EDIT')) { // Using EDIT as proxy for Delete per user request
                return { success: false, error: 'Bu işlem için silme yetkiniz bulunmamaktadır.' };
            }

            // Date Restriction Check (Backend Enforcement)
            if (user.editLookbackDays !== undefined) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const target = new Date(existing.date);
                target.setHours(0, 0, 0, 0);
                const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

                if (diff > user.editLookbackDays) {
                    return { success: false, error: `Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.` };
                }
            }

            // Outgoing with Reg No - Admin Only
            if (existing.direction === 'OUTGOING' && existing.registrationNumber) {
                return { success: false, error: 'Evrak kayıt numarası girilmiş giden evrakları silemezsiniz.' };
            }
        }

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
