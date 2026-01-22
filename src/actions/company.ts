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
                shortName: data.shortName // [NEW]
            }
        });
        revalidatePath('/dashboard/admin');
        return { success: true, data: company };
    } catch (error) {
        console.error('createCompany Error:', error);
        return { success: false, error: 'Firma oluşturulurken hata oluştu.' };
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
                shortName: data.shortName, // [NEW]
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
        // Strict Dependency Check
        const siteCount = await prisma.site.count({ where: { companyId: id } });
        if (siteCount > 0) return { success: false, error: `Bu firmaya bağlı ${siteCount} adet şantiye/iş bulunmaktadır. Önce bunları siliniz veya başka firmaya aktarınız.` };

        const userCount = await prisma.user.count({ where: { assignedCompanies: { some: { id } } } });
        // NOTE: assignedCompanies is a many-to-many. But usually users are linked via other means? 
        // Let's check schema: User has assignedCompanies.
        if (userCount > 0) return { success: false, error: `Bu firmaya atanmış ${userCount} adet kullanıcı bulunmaktadır.` };

        const vehicleCount = await prisma.vehicle.count({ where: { companyId: id } });
        if (vehicleCount > 0) return { success: false, error: `Bu firmaya kayıtlı ${vehicleCount} adet araç bulunmaktadır.` };

        const correspondenceCount = await prisma.correspondence.count({ where: { companyId: id } });
        if (correspondenceCount > 0) return { success: false, error: `Bu firmaya ait ${correspondenceCount} adet evrak/yazışma kaydı bulunmaktadır.` };

        // Also check if Partner in other sites
        const partnerCount = await prisma.sitePartner.count({ where: { companyId: id } });
        if (partnerCount > 0) return { success: false, error: `Bu firma ${partnerCount} adet iş ortaklığına sahiptir.` };

        await prisma.company.delete({ where: { id } });
        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (error) {
        console.error('deleteCompany Error:', error);
        return { success: false, error: 'Firma silinemedi.' };
    }
}
