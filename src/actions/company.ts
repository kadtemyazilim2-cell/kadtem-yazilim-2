'use server';

import { prisma } from '@/lib/db';
import { Company } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function getCompanies() {
    try {
        // [PERF] stamp ve letterhead base64 alanları hariç tutuluyor
        // Bu alanlar her biri MB'larca büyüklükte olabilir ve
        // her sayfa yüklemesinde RSC payload'a gömülüyordu
        const companies = await prisma.company.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                logoUrl: true,
                address: true,
                status: true,
                taxNumber: true,
                phone: true,
                smtpHost: true,
                smtpPort: true,
                smtpSecure: true,
                smtpUser: true,
                smtpPass: true,
                smtpFromEmail: true,
                smtpFromName: true,
                currentDocumentNumber: true,
                shortName: true,
                // stamp: EXCLUDED (base64, ~1-5MB)
                // letterhead: EXCLUDED (base64, ~1-5MB)
            }
        });
        return { success: true, data: companies };
    } catch (error) {
        console.error('getCompanies Error:', error);
        return { success: false, error: 'Firmalar getirilirken hata oluştu.' };
    }
}

// [NEW] Stamp ve letterhead dahil tam firma verisi (Admin sayfası ve PDF üretimi için)
export async function getCompanyFull(id: string) {
    try {
        const company = await prisma.company.findUnique({
            where: { id }
        });
        return { success: true, data: company };
    } catch (error) {
        console.error('getCompanyFull Error:', error);
        return { success: false, error: 'Firma detayları getirilemedi.' };
    }
}

// [NEW] Admin sayfası için tüm alanlarla birlikte firmalar
export async function getCompaniesFull() {
    try {
        const companies = await prisma.company.findMany({
            orderBy: { name: 'asc' }
        });
        return { success: true, data: companies };
    } catch (error) {
        console.error('getCompaniesFull Error:', error);
        return { success: false, error: 'Firmalar getirilirken hata oluştu.' };
    }
}

export async function createCompany(data: Partial<Company>) {
    try {
        const session = await auth();
        if (session?.user?.role !== 'ADMIN') {
            return { success: false, error: 'Yetkiniz yok' };
        }

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
        const session = await auth();
        if (session?.user?.role !== 'ADMIN') {
            return { success: false, error: 'Yetkiniz yok' };
        }

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
        const session = await auth();
        if (session?.user?.role !== 'ADMIN') {
            return { success: false, error: 'Yetkiniz yok' };
        }

        // Strict Dependency Check
        const siteCount = await prisma.site.count({ where: { companyId: id } });
        if (siteCount > 0) return { success: false, error: `Bu firmaya bağlı ${siteCount} adet şantiye/iş bulunmaktadır. Önce bunları siliniz veya başka firmaya aktarınız.` };

        const userCount = await prisma.user.count({ where: { assignedCompanies: { some: { id } } } });
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

// [NEW] Check Dependencies for Deletion Safety
export async function checkCompanyDependencies(id: string) {
    try {
        const session = await auth();
        if (session?.user?.role !== 'ADMIN') {
            return { success: false, error: 'Yetkiniz yok' };
        }

        const [sites, vehicles, correspondences, partners] = await Promise.all([
            prisma.site.count({ where: { companyId: id } }),
            prisma.vehicle.count({ where: { companyId: id } }),
            prisma.correspondence.count({ where: { companyId: id } }),
            prisma.sitePartner.count({ where: { companyId: id } })
        ]);

        return {
            success: true,
            counts: {
                sites,
                vehicles,
                correspondences,
                partners
            }
        };
    } catch (error) {
        console.error("Dependency check failed:", error);
        return { success: false, error: 'Bağımlılık kontrolü yapılamadı' };
    }
}
