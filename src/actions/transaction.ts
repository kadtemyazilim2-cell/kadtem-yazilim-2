'use server';

import { prisma } from '@/lib/db';
import { CashTransaction, PaymentMethod } from '@prisma/client'; // [FIX] Import Enum
import { revalidatePath } from 'next/cache';

export async function getTransactionsBySite(siteId: string) {
    try {
        const transactions = await prisma.cashTransaction.findMany({
            where: { siteId },
            orderBy: { date: 'desc' },
            include: {
                createdByUser: true,
                responsibleUser: true,
                site: true
            }
        });
        return { success: true, data: transactions };
    } catch (error) {
        console.error('getTransactions Error:', error);
        return { success: false, error: 'İşlemler alınamadı.' };
    }
}

export async function getAllTransactions() {
    try {
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) {
            return { success: false, error: 'Oturum bulunamadı.' };
        }

        const user = session.user;
        const isAdmin = user.role === 'ADMIN';
        // Check for Admin View permission
        // permissions is typed as any in session mostly, casting or optional chaining
        const perms = (user.permissions as any) || {};
        const canViewAll = isAdmin || (perms['cash-book.admin-view'] && perms['cash-book.admin-view'].includes('VIEW'));

        const where: any = {};
        if (!canViewAll) {
            // Restriction: Only see transactions where user is responsible
            where.responsibleUserId = user.id;
        }

        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, 0, 1); // Jan 1st of current year

        const transactions = await prisma.cashTransaction.findMany({
            where: {
                ...where,
                date: {
                    gte: startDate
                }
            },
            orderBy: { date: 'desc' },
            // [OPTIMIZATION] Removed includes to reduce payload size.
            // Helper functions in UI (getUserName, getSiteName) use the stores, so we don't need relations here.
        });
        return { success: true, data: transactions };
    } catch (error) {
        console.error('getAllTransactions Error:', error);
        return { success: false, error: 'İşlemler alınamadı.' };
    }
}

export async function createTransaction(data: Partial<CashTransaction>) {
    try {
        // [AUTH] Strict Session Check
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) {
            return { success: false, error: 'Oturum süreniz dolmuş. Lütfen sayfayı yenileyip tekrar giriş yapın.' };
        }

        const creatorId = session.user.id;

        // Validation
        if (!data.siteId) return { success: false, error: 'Şantiye seçimi zorunludur.' };
        if (!data.amount) return { success: false, error: 'Tutar zorunludur.' };
        if (!data.type) return { success: false, error: 'İşlem tipi zorunludur.' };
        if (!data.category) return { success: false, error: 'Kategori zorunludur.' };

        // [FIX] Strict Enum Mapping
        let pm: PaymentMethod = PaymentMethod.CASH;
        if (String(data.paymentMethod) === 'CREDIT_CARD' || data.paymentMethod === PaymentMethod.CREDIT_CARD) {
            pm = PaymentMethod.CREDIT_CARD;
        }

        // [TIMEOUT] Wrap DB call in race
        const transaction = await Promise.race([
            prisma.cashTransaction.create({
                data: {
                    siteId: data.siteId,
                    // [FIX] Handle string or Date
                    date: data.date ? new Date(data.date) : new Date(),
                    type: data.type,
                    category: data.category,
                    amount: Number(data.amount),
                    description: data.description || '',
                    documentNo: data.documentNo,
                    createdByUserId: creatorId,
                    // If responsibleUserId is not provided, fallback to creator
                    responsibleUserId: data.responsibleUserId || creatorId,
                    paymentMethod: pm,
                    imageUrl: data.imageUrl
                }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Veritabanı zaman aşımı (10s)')), 10000))
        ]) as CashTransaction;

        console.log('[createTransaction] Success:', transaction.id);

        // Revalidate safely
        try {
            revalidatePath('/dashboard/cash-book');
        } catch (e) {
            console.error('Revalidate failed but transaction created:', e);
        }

        return { success: true, data: transaction };
    } catch (error: any) {
        console.error('createTransaction Error:', error);
        return { success: false, error: `İşlem eklenemedi: ${error.message || String(error)}` };
    }
}

export async function updateTransaction(id: string, data: Partial<CashTransaction>) {
    try {
        console.log('[updateTransaction] Started for ID:', id);

        // 1. Auth Check
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) {
            return { success: false, error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' };
        }

        // 2. Fetch existing to check permission
        const existing = await prisma.cashTransaction.findUnique({ where: { id } });
        if (!existing) {
            return { success: false, error: 'Kayıt bulunamadı.' };
        }

        // 3. Permission: Admin or Owner or Responsible
        const isAdmin = session.user.role === 'ADMIN';
        // Check if user is creator OR responsible
        const isOwner = existing.createdByUserId === session.user.id || existing.responsibleUserId === session.user.id;

        if (!isAdmin && !isOwner) {
            return { success: false, error: 'Bu kaydı düzenleme yetkiniz yok.' };
        }

        // 4. Data Preparation & Enum Fix
        let pm: PaymentMethod | undefined;
        if (data.paymentMethod) {
            if (String(data.paymentMethod) === 'CREDIT_CARD' || data.paymentMethod === PaymentMethod.CREDIT_CARD) {
                pm = PaymentMethod.CREDIT_CARD;
            } else {
                pm = PaymentMethod.CASH;
            }
        }

        const updateData: any = {
            siteId: data.siteId,
            date: data.date ? new Date(data.date) : undefined,
            type: data.type,
            category: data.category,
            amount: data.amount ? Number(data.amount) : undefined,
            description: data.description,
            documentNo: data.documentNo,
            paymentMethod: pm, // Enum mapped
            imageUrl: data.imageUrl
        };

        // Only update responsibleUserId if provided
        if (data.responsibleUserId) {
            updateData.responsibleUserId = data.responsibleUserId;
        }

        // [TIMEOUT] Wrap DB call
        const transaction = await Promise.race([
            prisma.cashTransaction.update({
                where: { id },
                data: updateData
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Güncelleme zaman aşımı (10s)')), 10000))
        ]) as CashTransaction;

        console.log('[updateTransaction] Success:', transaction.id);

        try {
            revalidatePath('/dashboard/cash-book');
        } catch (e) {
            console.error('Revalidate failed (Update):', e);
        }

        return { success: true, data: transaction };
    } catch (error: any) {
        console.error('updateTransaction Error:', error);
        return { success: false, error: `Güncelleme başarısız: ${error.message}` };
    }
}

export async function deleteTransaction(id: string) {
    try {
        await prisma.cashTransaction.delete({
            where: { id }
        });

        try {
            revalidatePath('/dashboard/cash-book');
        } catch (e) {
            console.error('Revalidate failed (Delete):', e);
        }

        return { success: true };
    } catch (error: any) {
        console.error('deleteTransaction Error:', error);
        return { success: false, error: `İşlem silinemedi: ${error.message}` };
    }
}
