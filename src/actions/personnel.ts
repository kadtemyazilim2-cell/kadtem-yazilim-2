'use server';

import { prisma } from '@/lib/db';
import { Personnel } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getPersonnel() {
    try {
        const personnel = await prisma.personnel.findMany({
            orderBy: { fullName: 'asc' },
            include: { site: true }
        });
        return { success: true, data: personnel };
    } catch (error) {
        console.error('getPersonnel Error:', error);
        return { success: false, error: 'Personel listesi alınamadı.' };
    }
}

export async function createPersonnel(data: Partial<Personnel>) {
    try {
        const person = await prisma.personnel.create({
            data: {
                fullName: data.fullName!,
                role: data.role || 'Worker',
                tcNumber: data.tcNumber,
                profession: data.profession,
                salary: data.salary,
                siteId: data.siteId,
                category: data.category || 'FIELD',
                status: 'ACTIVE'
            }
        });
        revalidatePath('/dashboard/personnel');
        return { success: true, data: person };
    } catch (error) {
        console.error('createPersonnel Error:', error);
        return { success: false, error: 'Personel eklenemedi.' };
    }
}

export async function updatePersonnel(id: string, data: Partial<Personnel>) {
    try {
        const person = await prisma.personnel.update({
            where: { id },
            data: { ...data }
        });
        revalidatePath('/dashboard/personnel');
        return { success: true, data: person };
    } catch (error) {
        console.error('updatePersonnel Error:', error);
        return { success: false, error: 'Personel güncellenemedi.' };
    }
}
export async function deletePersonnel(id: string) {
    try {
        const person = await prisma.personnel.delete({
            where: { id }
        });
        revalidatePath('/dashboard/personnel');
        return { success: true, data: person };
    } catch (error) {
        console.error('deletePersonnel Error:', error);
        return { success: false, error: 'Personel silinemedi.' };
    }
}
