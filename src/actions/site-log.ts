'use server';

import { prisma } from '@/lib/db';
import { SiteLogEntry } from '@prisma/client';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

export async function getSiteLogEntries() {
    try {
        const entries = await prisma.siteLogEntry.findMany({
            orderBy: { date: 'desc' },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        return { success: true, data: entries };
    } catch (error) {
        console.error('getSiteLogEntries Error:', error);
        return { success: false, error: 'Şantiye defteri kayıtları alınamadı.' };
    }
}

export async function createSiteLogEntry(data: Partial<SiteLogEntry>) {
    try {
        if (!data.siteId || !data.date || !data.content || !data.authorId) {
            return { success: false, error: 'Eksik bilgi: Şantiye, Tarih, İçerik ve Yazar zorunludur.' };
        }

        const inputDate = new Date(data.date);
        const startOfDay = new Date(inputDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(inputDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Check for existing entry
        const existingEntry = await prisma.siteLogEntry.findFirst({
            where: {
                siteId: data.siteId,
                authorId: data.authorId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        let entry;

        if (existingEntry) {
            // Append content
            const newContent = `${existingEntry.content}\n\n${data.content}`;
            const mergedTags = Array.from(new Set([...(existingEntry.tags || []), ...(data.tags || [])]));
            const mergedImages = Array.from(new Set([...(existingEntry.images || []), ...(data.images || [])]));

            entry = await prisma.siteLogEntry.update({
                where: { id: existingEntry.id },
                data: {
                    content: newContent,
                    tags: mergedTags,
                    images: mergedImages
                }
            });
        } else {
            // Create new
            entry = await prisma.siteLogEntry.create({
                data: {
                    siteId: data.siteId,
                    date: inputDate,
                    weather: data.weather,
                    content: data.content,
                    authorId: data.authorId,
                    tags: data.tags || [],
                    images: data.images || []
                }
            });
        }

        revalidateTag('site-logs');
        revalidatePath('/dashboard/site-log');
        return { success: true, data: entry };
    } catch (error) {
        console.error('createSiteLogEntry Error:', error);
        return { success: false, error: 'Kayıt oluşturulamadı.' };
    }
}

export async function updateSiteLogEntry(id: string, data: Partial<SiteLogEntry>) {
    try {
        const entry = await prisma.siteLogEntry.update({
            where: { id },
            data: {
                siteId: data.siteId,
                date: data.date ? new Date(data.date) : undefined,
                weather: data.weather,
                content: data.content,
                tags: data.tags,
                images: data.images
            }
        });

        revalidateTag('site-logs');
        revalidatePath('/dashboard/site-log');
        return { success: true, data: entry };
    } catch (error) {
        console.error('updateSiteLogEntry Error:', error);
        return { success: false, error: 'Kayıt güncellenemedi.' };
    }
}

export async function deleteSiteLogEntry(id: string) {
    try {
        await prisma.siteLogEntry.delete({ where: { id } });
        revalidateTag('site-logs');
        revalidatePath('/dashboard/site-log');
        return { success: true };
    } catch (error) {
        console.error('deleteSiteLogEntry Error:', error);
        return { success: false, error: 'Kayıt silinemedi.' };
    }
}
