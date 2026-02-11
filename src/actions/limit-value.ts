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
