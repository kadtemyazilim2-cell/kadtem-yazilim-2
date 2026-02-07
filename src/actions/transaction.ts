'use server';

import { prisma } from '@/lib/db';
import { CashTransaction, PaymentMethod } from '@prisma/client'; // [FIX] Import Enum
import { revalidatePath } from 'next/cache';

// [CONFIG] Increase duration for Vercel (if applicable)
// [CONFIG] Increase duration for Vercel (if applicable) -> Moved to Page


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

export async function getTransaction(id: string) {
    try {
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) return { success: false, error: 'Oturum bulunamadı.' };

        const transaction = await prisma.cashTransaction.findUnique({
            where: { id }
        });

        if (!transaction) return { success: false, error: 'Kayıt bulunamadı.' };

        // Permission Check (Optional but good)
        // For now, if they have ID, let them fetch, but UI hides button usually.
        // We can add strict check if needed.

        return { success: true, data: transaction };
    } catch (error) {
        console.error('getTransaction Error:', error);
        return { success: false, error: 'İşlem detayları alınamadı.' };
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
        const perms = (user.permissions as any) || {};
        const canViewAll = isAdmin ||
            (perms['cash-book.admin-view']?.includes('VIEW')) ||
            (perms['cash-book.reports']?.includes('VIEW')) ||
            (perms['cash-book']?.includes('EXPORT'));

        const where: any = {};
        if (!canViewAll) {
            // Restriction: Only see transactions where user is responsible (or created)
            // Added createdByUserId to be safe so they see what they entered even if assigned to someone else (rare)
            where.OR = [
                { responsibleUserId: user.id },
                { createdByUserId: user.id }
            ];
        }

        // [OPTIMIZATION] Removed Date Filter to allow full history visibility
        // [OPTIMIZATION] Select specific fields to EXCLUDE imageUrl (Base64 strings are heavy)
        const transactions = await prisma.cashTransaction.findMany({
            where: { ...where },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                siteId: true,
                date: true,
                type: true,
                category: true,
                amount: true,
                description: true,
                documentNo: true,
                responsibleUserId: true,
                createdByUserId: true,
                paymentMethod: true,
                createdAt: true
                // imageUrl excluded
            }
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

        // [TIMEOUT] Removed manual race, relying on Prisma timeout
        const transaction = await prisma.cashTransaction.create({
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
        });

        console.log('[createTransaction] Success:', transaction.id);

        // Revalidate safely - [OPTIMIZATION] Removed to prevent blocking since UI updates optimistically
        /*
        try {
            revalidatePath('/dashboard/cash-book');
        } catch (e) {
            console.error('Revalidate failed but transaction created:', e);
        }
        */

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

        // [TIMEOUT] Removed manual race
        const transaction = await prisma.cashTransaction.update({
            where: { id },
            data: updateData
        });

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
