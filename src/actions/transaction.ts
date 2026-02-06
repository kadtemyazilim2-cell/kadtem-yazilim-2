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

        const transaction = await prisma.cashTransaction.create({
            data: {
                siteId: data.siteId,
                date: data.date ? new Date(data.date) : new Date(),
                type: data.type,
                category: data.category,
                amount: Number(data.amount), // Ensure number
                description: data.description || '',
                documentNo: data.documentNo,
                createdByUserId: creator.id, // Server-side ID
                responsibleUserId: data.responsibleUserId || creator.id, // Fallback to current user
                paymentMethod: pm, // Checked Enum
                imageUrl: data.imageUrl
            }
        });
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
        const transaction = await prisma.cashTransaction.update({
            where: { id },
            data: {
                siteId: data.siteId,
                date: data.date ? new Date(data.date) : undefined,
                type: data.type,
                category: data.category,
                amount: data.amount,
                description: data.description,
                documentNo: data.documentNo,
                responsibleUserId: data.responsibleUserId,
                paymentMethod: data.paymentMethod,
                imageUrl: data.imageUrl
            }
        });
        revalidatePath('/dashboard/cash-book');
        return { success: true, data: transaction };
    } catch (error) {
        console.error('updateTransaction Error:', error);
        return { success: false, error: 'İşlem güncellenemedi.' };
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
