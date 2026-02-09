
'use server';

import { prisma } from '@/lib/db';
import { unstable_noStore } from 'next/cache';

export async function debugFetchPersonnel(siteId?: string) {
    unstable_noStore();
    try {
        // 1. Count Total Personnel
        const total = await prisma.personnel.count();

        // 2. Count for Site (Simple)
        const siteCount = siteId ? await prisma.personnel.count({
            where: { siteId: siteId }
        }) : 0;

        // 3. Fetch up to 3 for this site
        const sample = siteId ? await prisma.personnel.findMany({
            where: { siteId: siteId },
            take: 3,
            select: { fullName: true, status: true }
        }) : [];

        return {
            success: true,
            total,
            siteCount,
            sample,
            receivedSiteId: siteId,
            envUrl: process.env.DATABASE_URL ? 'Defined' : 'Undefined'
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
