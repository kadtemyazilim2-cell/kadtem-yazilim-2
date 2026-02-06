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
        const transactions = await prisma.cashTransaction.findMany({
            orderBy: { date: 'desc' },
            include: {
                createdByUser: true,
                responsibleUser: true,
                site: true
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
        console.log('[createTransaction] Started with data:', JSON.stringify(data));

        // [DEBUG] Bypass auth() check to debug hang
        // const session = await import('@/auth').then(m => m.auth());
        // if (!session?.user?.id) {
        //    return { success: false, error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' };
        // }

        const creatorId = data.createdByUserId; // Use client-provided ID for debug
        if (!creatorId) {
            return { success: false, error: 'Kullanıcı ID (createdByUserId) eksik.' };
        }

        // [SECURITY] Verify user exists in DB to prevent FK errors
        const creator = await prisma.user.findUnique({ where: { id: creatorId } });
        if (!creator) {
            return { success: false, error: 'Kullanıcı kaydı bulunamadı.' };
        }

        // Validation
        if (!data.siteId) return { success: false, error: 'Şantiye seçimi zorunludur.' };
        if (!data.amount) return { success: false, error: 'Tutar zorunludur.' };
        if (!data.type) return { success: false, error: 'İşlem tipi zorunludur.' };
        if (!data.category) return { success: false, error: 'Kategori zorunludur.' };

        // [FIX] Strict Enum Mapping
        let pm: PaymentMethod = PaymentMethod.CASH;
        if (data.paymentMethod === 'CREDIT_CARD' || data.paymentMethod === PaymentMethod.CREDIT_CARD) {
            pm = PaymentMethod.CREDIT_CARD;
        }

        // [DEBUG] Log payload size (approx)
        if (data.imageUrl) {
            console.log('[createTransaction] Image present, length:', data.imageUrl.length);
        }

        // [TIMEOUT] Wrap DB call in race
        const transaction = await Promise.race([
            prisma.cashTransaction.create({
                data: {
                    siteId: data.siteId,
                    date: data.date ? new Date(data.date) : new Date(),
                    type: data.type,
                    category: data.category,
                    amount: Number(data.amount),
                    description: data.description || '',
                    documentNo: data.documentNo,
                    createdByUserId: creator.id,
                    responsibleUserId: data.responsibleUserId || creator.id,
                    paymentMethod: pm,
                    imageUrl: data.imageUrl
                }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout (10s)')), 10000))
        ]) as CashTransaction;

        console.log('[createTransaction] DB Create Success:', transaction.id);
        revalidatePath('/dashboard/cash-book');
        return { success: true, data: transaction };
    } catch (error: any) {
        console.error('createTransaction Error:', error);
        return { success: false, error: `İşlem eklenemedi: ${error.message || String(error)}` };
    }
}

export async function updateTransaction(id: string, data: Partial<CashTransaction>) {
    try {
        console.log('[updateTransaction] Started for ID:', id, 'Data:', JSON.stringify(data));

        // 1. Auth Check
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) {
            return { success: false, error: 'Oturum bulunamadı.' };
        }

        // 2. Fetch existing to check permission
        const existing = await prisma.cashTransaction.findUnique({ where: { id } });
        if (!existing) {
            return { success: false, error: 'Kayıt bulunamadı.' };
        }

        // 3. Permission: Admin or Owner or Responsible
        // If Admin, can edit anything.
        // If User, can only edit if within time limit (frontend check mainly) and own record.
        const isAdmin = session.user.role === 'ADMIN';
        const isOwner = existing.createdByUserId === session.user.id || existing.responsibleUserId === session.user.id;

        if (!isAdmin && !isOwner) {
            return { success: false, error: 'Bu kaydı düzenleme yetkiniz yok.' };
        }

        // 4. Data Preparation & Enum Fix
        let pm: PaymentMethod | undefined;
        if (data.paymentMethod) {
            if (data.paymentMethod === 'CREDIT_CARD' || data.paymentMethod === PaymentMethod.CREDIT_CARD) {
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
            new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout (10s)')), 10000))
        ]) as CashTransaction;

        console.log('[updateTransaction] Success:', transaction.id);
        revalidatePath('/dashboard/cash-book');
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
        revalidatePath('/dashboard/cash-book');
        return { success: true };
    } catch (error: any) {
        console.error('deleteTransaction Error:', error);
        return { success: false, error: `İşlem silinemedi: ${error.message}` };
    }
}
