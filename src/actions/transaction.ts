'use server';

import { prisma } from '@/lib/db';
import { CashTransaction } from '@prisma/client';
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
        const transaction = await prisma.cashTransaction.create({
            data: {
                siteId: data.siteId!,
                date: new Date(data.date!),
                type: data.type!,
                category: data.category!,
                amount: data.amount!,
                description: data.description!,
                documentNo: data.documentNo,
                createdByUserId: data.createdByUserId!,
                responsibleUserId: data.responsibleUserId
            }
        });
        revalidatePath('/dashboard/cash-book');
        return { success: true, data: transaction };
    } catch (error) {
        console.error('createTransaction Error:', error);
        return { success: false, error: 'İşlem eklenemedi.' };
    }
}

export async function deleteTransaction(id: string) {
    try {
        await prisma.cashTransaction.delete({
            where: { id }
        });
        revalidatePath('/dashboard/cash-book');
        return { success: true };
    } catch (error) {
        console.error('deleteTransaction Error:', error);
        return { success: false, error: 'İşlem silinemedi.' };
    }
}
