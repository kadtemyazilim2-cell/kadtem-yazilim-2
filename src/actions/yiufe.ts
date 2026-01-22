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

// Real implementation
import * as cheerio from 'cheerio';

export async function syncYiUfeRates() {
    try {
        console.log('Starting Yi-UFE Synchronization...');
        const response = await fetch('https://www.hakedis.org/endeksler/yi-ufe-yurtici-uretici-fiyat-endeksi', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            next: { revalidate: 0 } // No cache
        });

        const html = await response.text();
        const $ = cheerio.load(html);
        const rates: { year: number; month: number; index: number }[] = [];

        $('table').each((_, table) => {
            const headers = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
            if (!headers.includes('yıl') && !headers.includes('yil')) return;

            let rows = $(table).find('tbody tr');
            if (rows.length === 0) rows = $(table).find('tr');

            rows.each((_, tr) => {
                const cols = $(tr).find('td');
                if (cols.length >= 13) {
                    const yearStr = $(cols[0]).text().trim();
                    const year = parseInt(yearStr);

                    if (!isNaN(year)) {
                        for (let m = 1; m <= 12; m++) {
                            const valStr = $(cols[m]).text().trim();
                            // Handle Turkish format: 3.456,78 -> 3456.78
                            const cleanValStr = valStr.replace(/\./g, '').replace(',', '.');
                            const val = parseFloat(cleanValStr);

                            if (!isNaN(val)) {
                                rates.push({ year, month: m, index: val });
                            }
                        }
                    }
                }
            });
        });

        console.log(`Found ${rates.length} rates.`);

        // Save to DB
        let addedCount = 0;
        let updatedCount = 0;

        for (const rate of rates) {
            const existing = await prisma.yiUfeRate.findUnique({
                where: { year_month: { year: rate.year, month: rate.month } }
            });

            if (!existing) {
                await prisma.yiUfeRate.create({
                    data: { year: rate.year, month: rate.month, index: rate.index }
                });
                addedCount++;
            } else if (existing.index !== rate.index) {
                await prisma.yiUfeRate.update({
                    where: { id: existing.id },
                    data: { index: rate.index }
                });
                updatedCount++;
            }
        }

        revalidatePath('/dashboard/admin');
        return { success: true, message: `Senkronizasyon tamamlandı. ${addedCount} yeni kayıt eklendi, ${updatedCount} kayıt güncellendi.` };
    } catch (error: any) {
        console.error('Yi-UFE Sync Error:', error);
        return { success: false, error: 'Senkronizasyon hatası: ' + error.message };
    }
}
