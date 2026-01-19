'use server';

import { prisma } from '@/lib/db';
import { Institution } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function createInstitution(data: Omit<Institution, 'id'>) {
    try {
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
                contactPerson: data.contactPerson
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
