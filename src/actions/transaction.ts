'use server';

import { prisma } from '@/lib/db';
import { CashTransaction, PaymentMethod } from '@prisma/client';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(process.cwd(), 'debug_transactions.txt');

function logToDebug(message: string) {
    try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
    } catch (e) {
        // ignore
    }
}

// ...

export async function getAllTransactions() {
    noStore();
    try {
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) {
            return { success: false, error: 'Oturum bulunamadı.' };
        }

        // [SECURE] Fetch Fresh Permissions from DB instead of relying on stale Session
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, permissions: true, status: true }
        });

        if (!dbUser) {
            return { success: false, error: 'Kullanıcı bulunamadı.' };
        }

        if (dbUser.status !== 'ACTIVE') {
            return { success: false, error: 'Hesabınız pasif durumdadır.' };
        }

        const isAdmin = dbUser.role === 'ADMIN';
        const perms: any = dbUser.permissions || {};

        const canViewAll = isAdmin ||
            (perms['cash-book.admin-view']?.includes('VIEW')) ||
            (perms['cash-book.reports']?.includes('VIEW')) ||
            (perms['cash-book']?.includes('EXPORT'));

        console.log(`[getAllTransactions] User: ${dbUser.role}, ID: ${session.user.id}`);
        console.log(`[getAllTransactions] Perms: ${JSON.stringify(perms['cash-book.admin-view'])}`);
        console.log(`[getAllTransactions] canViewAll: ${canViewAll}`);

        const where: any = {};
        if (!canViewAll) {
            // Restriction: Only see transactions where user is responsible (or created)
            // Added createdByUserId to be safe so they see what they entered even if assigned to someone else (rare)
            where.OR = [
                { responsibleUserId: session.user.id },
                { createdByUserId: session.user.id }
            ];
        }

        console.log(`[getAllTransactions] Where Clause:`, JSON.stringify(where));

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

        console.log(`[getAllTransactions] Found ${transactions.length} transactions.`);
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

        // [SECURE] Validate User Status
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { status: true, role: true, editLookbackDays: true }
        });

        if (!dbUser || dbUser.status !== 'ACTIVE') {
            return { success: false, error: 'Hesabınız aktif durumda değildir.' };
        }

        // [SECURE] Date Restriction Check

        // Strict Check: If NOT ADMIN, enforce restriction. Treat null/undefined as 0.
        if (dbUser.role !== 'ADMIN') {
            const limit = dbUser.editLookbackDays ?? 0;
            const targetDate = data.date ? new Date(data.date) : new Date();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const target = new Date(targetDate);
            target.setHours(0, 0, 0, 0);

            // Calculate diff in days
            const diffTime = today.getTime() - target.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > limit) {
                const msg = limit === 0 ? 'Bugünden eski tarihe işlem giremezsiniz.' : `Geriye dönük en fazla ${limit} gün işlem yapabilirsiniz. (Seçilen: ${diffDays} gün önce)`;
                return { success: false, error: msg };
            }
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

        // [SECURE] Fetch Fresh Role & Status
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, status: true, permissions: true, editLookbackDays: true }
        });

        if (!dbUser || dbUser.status !== 'ACTIVE') {
            return { success: false, error: 'Hesabınız aktif değil veya bulunamadı.' };
        }

        // [DEBUG] FORCE STOP FOR EVERYONE
        return {
            success: false,
            error: `[DEBUG STOP] ID: ${session.user.id} | Role: ${dbUser.role} | Lookback: ${dbUser.editLookbackDays}`
        };

        // [SECURE] Date Restriction Check (Check NEW date if provided, OR existing date if not changing?)
        // Usually we check if we can EDIT this record (so existing date check) AND if we can move it to new date (new date check).
        // Check 1: Can I touch this OLD record?

        // Strict Check: If NOT ADMIN, enforce restriction. Treat null/undefined as 0.
        if (dbUser.role !== 'ADMIN') {
            const limit = dbUser.editLookbackDays ?? 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Check Existing Date
            const existingDate = new Date(existing.date);
            existingDate.setHours(0, 0, 0, 0);
            const diffExisting = Math.floor((today.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24));

            console.log(`[UpdateCheck] User: ${dbUser.role}, Limit: ${limit}, DiffExisting: ${diffExisting}`);
            logToDebug(`[UpdateCheck] User: ${dbUser.role}, Limit: ${limit}, DiffExisting: ${diffExisting}`);

            if (diffExisting > limit) {
                const msg = limit === 0 ? 'Bugünden eski kayıtları düzenleyemezsiniz.' : `Bu kayıt ${limit} günden eski olduğu için düzenlenemez.`;
                return { success: false, error: msg };
            }

            // Check New Date (if changing)
            if (data.date) {
                const newDate = new Date(data.date);
                newDate.setHours(0, 0, 0, 0);
                const diffNew = Math.floor((today.getTime() - newDate.getTime()) / (1000 * 60 * 60 * 24));

                console.log(`[UpdateCheck] DiffNew: ${diffNew}`);
                logToDebug(`[UpdateCheck] DiffNew: ${diffNew}`);

                if (diffNew > limit) {
                    const msg = limit === 0 ? 'Bugünden eski tarihe işlem taşıyamazsınız.' : `Geriye dönük en fazla ${limit} gün işlem yapabilirsiniz. (Seçilen: ${diffNew} gün önce)`;
                    return { success: false, error: msg };
                }
            }
        }

        // 3. Permission: Admin or Owner or Responsible or Full Admin View
        const isAdmin = dbUser.role === 'ADMIN';
        const hasAdminView = (dbUser.permissions as any)?.['cash-book.admin-view']?.includes('VIEW');

        // Check if user is creator OR responsible
        const isOwner = existing.createdByUserId === session.user.id || existing.responsibleUserId === session.user.id;

        if (!isAdmin && !hasAdminView && !isOwner) {
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
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) {
            return { success: false, error: 'Oturum bulunamadı.' };
        }

        const existing = await prisma.cashTransaction.findUnique({ where: { id } });
        if (!existing) {
            return { success: false, error: 'Kayıt bulunamadı.' };
        }

        // [SECURE] Permission Check
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, permissions: true, editLookbackDays: true }
        });

        // [SECURE] Date Restriction Check
        if (dbUser?.role !== 'ADMIN' && dbUser?.editLookbackDays !== null && dbUser?.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const existingDate = new Date(existing.date);
            existingDate.setHours(0, 0, 0, 0);

            const diff = Math.floor((today.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diff > dbUser.editLookbackDays) {
                return { success: false, error: `Bu kayıt ${dbUser.editLookbackDays} günden eski olduğu için silinemez.` };
            }
        }

        const isAdmin = dbUser?.role === 'ADMIN';
        const hasAdminView = (dbUser?.permissions as any)?.['cash-book.admin-view']?.includes('VIEW');
        const isOwner = existing.createdByUserId === session.user.id || existing.responsibleUserId === session.user.id;

        if (!isAdmin && !hasAdminView && !isOwner) {
            return { success: false, error: 'Bu kaydı silme yetkiniz yok.' };
        }

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

export async function getTransaction(id: string) {
    try {
        const transaction = await prisma.cashTransaction.findUnique({
            where: { id }
        });

        if (!transaction) {
            return { success: false, error: 'Kayıt bulunamadı.' };
        }

        return { success: true, data: transaction };
    } catch (error: any) {
        console.error('getTransaction Error:', error);
        return { success: false, error: 'İşlem detayları alınamadı.' };
    }
}
