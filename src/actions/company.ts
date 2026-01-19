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
                smtpSecure: data.smtpSecure,
            }
        });
        revalidatePath('/dashboard/admin');
        return { success: true, data: company };
    } catch (error) {
        console.error('createCompany Error:', error);
        return { success: false, error: 'Firma oluşturulamadı.' };
    }
}
