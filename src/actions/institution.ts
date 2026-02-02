'use server';

import { prisma } from '@/lib/db';
import { Institution } from '@/lib/types';
import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';

export async function createInstitution(data: Omit<Institution, 'id'>) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        // Permission Check
        const user = session.user;
        if (user.role !== 'ADMIN') {
            const perms = user.permissions?.['correspondence.contacts'] || [];
            if (!perms.includes('CREATE')) {
                return { success: false, error: 'Muhatap ekleme yetkiniz bulunmamaktadır.' };
            }
        }

        // Check if name exists to prevent duplicates
        const existing = await prisma.institution.findFirst({
            where: { name: { equals: data.name, mode: 'insensitive' } }
        });

        if (existing) {
            return { success: true, data: existing }; // Return existing if match
        }

        const institution = await prisma.institution.create({
            data: {
                name: data.name,
                category: data.category || 'INSTITUTION',
                alignment: data.alignment || 'center',
                email: data.email,
                phone: data.phone,
                mobile: data.mobile,
                contactPerson: data.contactPerson,
                shortName: data.shortName
            }
        });
        // Often institutions are loaded in various forms, so might need to revalidate multiple paths or just rely on new fetch
        revalidatePath('/dashboard');
        return { success: true, data: institution };
    } catch (error) {
        console.error('createInstitution Error:', error);
        return { success: false, error: 'Kurum eklenemedi.' };
    }
}

export async function updateInstitution(id: string, data: Partial<Institution>) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        // Permission Check
        const user = session.user;
        if (user.role !== 'ADMIN') {
            const perms = user.permissions?.['correspondence.contacts'] || [];
            if (!perms.includes('EDIT')) {
                return { success: false, error: 'Muhatap düzenleme yetkiniz bulunmamaktadır.' };
            }
        }

        const institution = await prisma.institution.update({
            where: { id },
            data: {
                ...data
            }
        });
        revalidatePath('/dashboard');
        return { success: true, data: institution };
    } catch (error) {
        console.error('updateInstitution Error:', error);
        return { success: false, error: 'Kurum güncellenemedi.' };
    }
}

export async function deleteInstitution(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmamış.' };

        // Permission Check
        const user = session.user;
        // Check DELETE permission if it exists or fallback to EDIT
        if (user.role !== 'ADMIN') {
            const perms = user.permissions?.['correspondence.contacts'] || [];
            if (!perms.includes('DELETE') && !perms.includes('EDIT')) {
                return { success: false, error: 'Muhatap silme yetkiniz bulunmamaktadır.' };
            }
        }

        const institution = await prisma.institution.findUnique({ where: { id } });
        if (!institution) {
            return { success: false, error: 'Muhatap bulunamadı.' };
        }

        // Check for existing usages in Correspondence
        const usageCount = await prisma.correspondence.count({
            where: {
                senderReceiver: {
                    equals: institution.name,
                    mode: 'insensitive' // Optional: Match case-insensitively to be safe
                },
                status: 'ACTIVE' // Only check active ones? Or all? Usually all.
            }
        });

        if (usageCount > 0) {
            return { success: false, error: 'Bu muhatap ile yapılmış yazışmalar mevcut. Silinemez.' };
        }

        await prisma.institution.delete({ where: { id } });
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('deleteInstitution Error:', error);
        return { success: false, error: 'Kurum silinemedi.' };
    }
}

export async function getInstitutions() {
    try {
        const list = await prisma.institution.findMany({
            orderBy: { name: 'asc' }
        });
        return { success: true, data: list };
    } catch (error) {
        console.error('getInstitutions Error:', error);
        return { success: false, error: 'Kurumlar alınamadı.', data: [] };
    }
}
