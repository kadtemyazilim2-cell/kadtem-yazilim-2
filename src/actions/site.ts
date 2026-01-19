'use server';

import { prisma } from '@/lib/db';
import { Site } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getSites() {
    try {
        const sites = await prisma.site.findMany({
            orderBy: { name: 'asc' },
            include: { company: true }
        });
        return { success: true, data: sites };
    } catch (error) {
        console.error('getSites Error:', error);
        return { success: false, error: 'Şantiyeler getirilirken hata oluştu.' };
    }
}

export async function createSite(data: Partial<Site> & { companyId: string }) {
    try {
        const site = await prisma.site.create({
            data: {
                name: data.name!,
                companyId: data.companyId,
                location: data.location,
                status: data.status || 'ACTIVE',
                contractPrice: data.contractPrice,
                // Add other fields as necessary
                partnershipPercentage: data.partnershipPercentage
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
