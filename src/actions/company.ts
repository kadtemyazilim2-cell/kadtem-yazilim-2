'use server';

import { prisma } from '@/lib/db';
import { Company } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getCompanies() {
    try {
        const companies = await prisma.company.findMany({
            orderBy: { name: 'asc' }
        });
        return { success: true, data: companies };
    } catch (error) {
        console.error('getCompanies Error:', error);
        return { success: false, error: 'Firmalar getirilirken hata oluştu.' };
    }
}

export async function createCompany(data: Partial<Company>) {
    try {
        const company = await prisma.company.create({
            data: {
                name: data.name!,
                logoUrl: data.logoUrl,
                address: data.address,
                smtpHost: data.smtpHost,
                smtpPort: data.smtpPort,
                smtpUser: data.smtpUser,
                smtpPass: data.smtpPass,
                smtpFromEmail: data.smtpFromEmail,
                smtpFromName: data.smtpFromName,
                smtpSecure: data.smtpSecure,
                currentDocumentNumber: data.currentDocumentNumber,
                taxNumber: data.taxNumber,
                phone: data.phone,
                stamp: data.stamp,
                letterhead: data.letterhead,
            }
        });
        revalidatePath('/dashboard/admin');
        return { success: true, data: company };
    } catch (error) {
        console.error('createCompany Error:', error);
    }
}

export async function updateCompany(id: string, data: Partial<Company>) {
    try {
        const company = await prisma.company.update({
            where: { id },
            data: {
                name: data.name,
                taxNumber: data.taxNumber,
                address: data.address,
                phone: data.phone,
                stamp: data.stamp,
                letterhead: data.letterhead,
                smtpHost: data.smtpHost,
                smtpPort: data.smtpPort,
                smtpUser: data.smtpUser,
                smtpPass: data.smtpPass,
                smtpFromEmail: data.smtpFromEmail,
                smtpFromName: data.smtpFromName,
                smtpSecure: data.smtpSecure,
                currentDocumentNumber: data.currentDocumentNumber,
                status: data.status,
            }
        });
        revalidatePath('/dashboard/admin');
        return { success: true, data: company };
    } catch (error) {
        console.error('updateCompany Error:', error);
        return { success: false, error: 'Firma güncellenemedi.' };
    }
}

export async function deleteCompany(id: string) {
    try {
        await prisma.company.delete({ where: { id } });
        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (error) {
        console.error('deleteCompany Error:', error);
        return { success: false, error: 'Firma silinemedi.' };
    }
}
