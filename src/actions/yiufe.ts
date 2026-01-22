'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getYiUfeRates() {
    try {
        const rates = await prisma.yiUfeRate.findMany({
            orderBy: [
                { year: 'desc' },
                { month: 'desc' }
            ]
        });
        return { success: true, data: rates };
    } catch (error) {
        console.error('Yi-UFE fetch error:', error);
        return { success: false, error: 'Veriler alınamadı.' };
    }
}

export async function addYiUfeRate(year: number, month: number, index: number) {
    try {
        const rate = await prisma.yiUfeRate.upsert({
            where: {
                year_month: {
                    year,
                    month
                }
            },
            update: {
                index
            },
            create: {
                year,
                month,
                index
            }
        });
        revalidatePath('/dashboard/admin');
        return { success: true, data: rate };
    } catch (error) {
        console.error('Yi-UFE add error:', error);
        return { success: false, error: 'Kayıt başarısız.' };
    }
}

export async function deleteYiUfeRate(id: string) {
    try {
        await prisma.yiUfeRate.delete({ where: { id } });
        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Silme başarısız.' };
    }
}

// Placeholder for automatic fetching
// In a real scenario, this would fetch from TCMB or TUIK API.
// For now, we can seed some recent data if empty.
export async function syncYiUfeRates() {
    try {
        // Example recent data (approximate for demo/fallback)
        // Users should really update this via UI or a real cron job
        const recentRates = [
            { year: 2024, month: 1, index: 2976.33 }, // Example
            { year: 2023, month: 12, index: 2915.02 },
            // ... more data
        ];

        // This function is currently manual entry focused.
        // We return success to indicate "Check Complete"
        return { success: true, message: 'Senkronizasyon tamamlandı (Demo).' };
    } catch (error) {
        return { success: false, error: 'Senkronizasyon hatası.' };
    }
}
