'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function saveCalculation(data: {
    tenderName?: string;
    tenderRegisterNo?: string;
    administration?: string;
    tenderDate?: Date; // or string if passed as ISO
    approxCost: number;
    nCoefficient: number;
    limitValue: number;
    likelyWinner?: string;
    likelyWinnerDiscount?: number;
    businessGroup?: string;
    hasManualEdits?: boolean;
    fullResultData: any; // JSON
}) {
    try {
        await prisma.limitValueCalculation.create({
            data: {
                tenderName: data.tenderName,
                tenderRegisterNo: data.tenderRegisterNo,
                administration: data.administration,
                tenderDate: data.tenderDate,
                approxCost: data.approxCost,
                nCoefficient: data.nCoefficient,
                limitValue: data.limitValue,
                likelyWinner: data.likelyWinner,
                likelyWinnerDiscount: data.likelyWinnerDiscount,
                businessGroup: data.businessGroup,
                hasManualEdits: data.hasManualEdits || false,
                fullResultData: data.fullResultData,
            },
        });

        revalidatePath('/dashboard/limit-value');
        return { success: true };
    } catch (error) {
        console.error('Error saving calculation:', error);
        return { success: false, error: 'Kayıt başarısız: ' + (error instanceof Error ? error.message : String(error)) };
    }
}

export async function getCalculations() {
    try {
        const calculations = await prisma.limitValueCalculation.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: calculations };
    } catch (error) {
        console.error('Error fetching calculations:', error);
        return { success: false, error: 'Kayıtlar getirilemedi.' };
    }
}

export async function deleteCalculation(id: string) {
    try {
        await prisma.limitValueCalculation.delete({
            where: { id },
        });
        revalidatePath('/dashboard/limit-value');
        return { success: true };
    } catch (error) {
        console.error('Error deleting calculation:', error);
        return { success: false, error: 'Silme işlemi başarısız.' };
    }
}

// -----------------------------------------------------------------------------
// BUSINESS GROUP ACTIONS
// -----------------------------------------------------------------------------

export async function getBusinessGroups() {
    try {
        const groups = await prisma.businessGroup.findMany({
            orderBy: { name: 'asc' },
        });
        return { success: true, data: groups };
    } catch (error) {
        console.error('Error fetching business groups:', error);
        return { success: false, error: 'İş grupları getirilemedi.' };
    }
}

export async function addBusinessGroup(name: string) {
    try {
        // Check duplicate
        const existing = await prisma.businessGroup.findUnique({
            where: { name },
        });

        if (existing) {
            return { success: false, error: 'Bu isimde bir iş grubu zaten var.' };
        }

        await prisma.businessGroup.create({
            data: { name },
        });

        revalidatePath('/dashboard/limit-value');
        return { success: true };
    } catch (error) {
        console.error('Error adding business group:', error);
        return { success: false, error: 'İş grubu eklenemedi.' };
    }
}

export async function deleteBusinessGroup(id: string) {
    try {
        // Find group name first
        const group = await prisma.businessGroup.findUnique({
            where: { id },
        });

        if (!group) {
            return { success: false, error: 'Grup bulunamadı.' };
        }

        // Check usage
        const usageCount = await prisma.limitValueCalculation.count({
            where: { businessGroup: group.name },
        });

        if (usageCount > 0) {
            return { success: false, error: `Bu iş grubu ${usageCount} adet hesaplamada kullanılmış. Silinemez.` };
        }

        await prisma.businessGroup.delete({
            where: { id },
        });

        revalidatePath('/dashboard/limit-value');
        return { success: true };
    } catch (error) {
        console.error('Error deleting business group:', error);
        return { success: false, error: 'İş grubu silinemedi.' };
    }
}
