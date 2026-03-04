'use server';

import { prisma } from '@/lib/db';
import { Correspondence } from '@/lib/types';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
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

            // Increment Document Number for OUTGOING (Used for Reference Number Sequence)
            if (data.direction === 'OUTGOING') {
                const company = await tx.company.findUnique({
                    where: { id: data.companyId }
                });

                if (company) {
                    const nextNum = company.currentDocumentNumber || 1;

                    // User requested Manual Entry for Registration Number.
                    // We only increment the counter for the Reference Number generation logic.

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
        revalidateTag('correspondence');
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
            if ((user as any).editLookbackDays !== undefined) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const target = new Date(existing.date);
                target.setHours(0, 0, 0, 0);
                const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

                if (diff > (user as any).editLookbackDays) {
                    return { success: false, error: `Geriye dönük en fazla ${(user as any).editLookbackDays} gün işlem yapabilirsiniz.` };
                }
            }
        }

        // Explicitly pick only valid Prisma fields to prevent unknown field errors
        const payload: any = {};
        if (data.companyId !== undefined) payload.companyId = data.companyId;
        if (data.date !== undefined) payload.date = new Date(data.date);
        if (data.direction !== undefined) payload.direction = data.direction;
        if (data.type !== undefined) payload.type = data.type;
        if (data.subject !== undefined) payload.subject = data.subject;
        if (data.description !== undefined) payload.description = data.description;
        if (data.referenceNumber !== undefined) payload.referenceNumber = data.referenceNumber;
        if (data.senderReceiver !== undefined) payload.senderReceiver = data.senderReceiver;
        if (data.senderReceiverAlignment !== undefined) payload.senderReceiverAlignment = data.senderReceiverAlignment;
        if (data.registrationNumber !== undefined) payload.registrationNumber = data.registrationNumber;
        if (data.includeStamp !== undefined) payload.includeStamp = data.includeStamp;
        if (data.interest !== undefined) payload.interest = data.interest;
        if (data.appendices !== undefined) payload.appendices = data.appendices;
        if (data.attachmentUrls !== undefined) payload.attachmentUrls = data.attachmentUrls;

        // Handle siteId: empty string or 'none' should be null (optional FK)
        if (data.siteId !== undefined) {
            payload.siteId = (data.siteId && data.siteId !== 'none') ? data.siteId : null;
        }

        const correspondence = await prisma.correspondence.update({
            where: { id },
            data: payload
        });
        revalidateTag('correspondence');
        return { success: true, data: correspondence };
    } catch (error: any) {
        console.error('updateCorrespondence Error:', error);
        return { success: false, error: error.message || 'Yazışma güncellenemedi.' };
    }
}

export async function deleteCorrespondence(id: string, reason?: string, userId?: string) {
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
            if (!perms.includes('EDIT')) {
                return { success: false, error: 'Bu işlem için silme yetkiniz bulunmamaktadır.' };
            }

            // Date Restriction
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

            // Outgoing with Reg No check
            if (existing.direction === 'OUTGOING' && existing.registrationNumber) {
                return { success: false, error: 'Evrak kayıt numarası girilmiş giden evrakları silemezsiniz.' };
            }
        }

        // Soft Delete
        await prisma.correspondence.update({
            where: { id },
            data: {
                status: 'DELETED',
                deletionReason: reason || 'Kullanıcı tarafından silindi',
                deletedByUserId: userId || session.user.id,
                deletionDate: new Date()
            }
        });

        revalidateTag('correspondence');
        return { success: true };
    } catch (error: any) {
        console.error('deleteCorrespondence Error:', error);
        return { success: false, error: error.message || 'Yazışma silinemedi.' };
    }
}

// [PERFORMANCE] Cached correspondence query
const getCorrespondenceListFromDb = unstable_cache(
    async (role: string, userId: string) => {
        let whereClause: any = {};

        if (role !== 'ADMIN') {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { assignedSites: true }
            });

            if (user) {
                const assignedSiteIds = user.assignedSites.map((s: { id: string }) => s.id);
                whereClause.siteId = { in: assignedSiteIds };
            } else {
                return [];
            }
        }

        return await prisma.correspondence.findMany({
            orderBy: { date: 'desc' },
            where: whereClause
        });
    },
    ['get-correspondence-data'],
    { tags: ['correspondence'], revalidate: 3600 }
);

export async function getCorrespondenceList() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        const list = await getCorrespondenceListFromDb(session.user.role, session.user.id);
        return { success: true, data: list };
    } catch (error) {
        console.error('getCorrespondenceList Error:', error);
        return { success: false, error: 'Yazışmalar alınamadı.', data: [] };
    }
}
