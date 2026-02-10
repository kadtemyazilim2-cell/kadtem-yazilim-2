'use server';

import { prisma } from '@/lib/db';
import { Personnel } from '@prisma/client';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';


// [PERFORMANCE] Cached personnel query
const getPersonnelFromDb = unstable_cache(
    async () => {
        return await prisma.personnel.findMany({
            orderBy: { fullName: 'asc' },
            include: { site: true, assignedSites: true }
        });
    },
    ['get-personnel-data'],
    { tags: ['personnel'], revalidate: 3600 }
);

export async function getPersonnel() {
    try {
        const personnel = await getPersonnelFromDb();
        return { success: true, data: personnel };
    } catch (error) {
        console.error('getPersonnel Error:', error);
        return { success: false, error: 'Personel listesi alınamadı.' };
    }
}

export async function createPersonnel(data: Partial<Personnel>) {
    try {
        const { assignedSiteIds, ...rest } = data as any;

        const person = await prisma.personnel.create({
            data: {
                fullName: data.fullName!,
                role: data.role || 'Worker',
                tcNumber: data.tcNumber,
                profession: data.profession,
                salary: data.salary,
                siteId: data.siteId,
                category: data.category || 'FIELD',
                status: 'ACTIVE',
                startDate: data.startDate,
                note: data.note,
                salaryHistory: data.salaryHistory, // [NEW]
                leaveAllowance: data.leaveAllowance,
                hasOvertime: data.hasOvertime || false,
                assignedSites: assignedSiteIds ? {
                    connect: assignedSiteIds.map((id: string) => ({ id }))
                } : undefined
            }
        });
        // Check if start date is provided to auto-create 'WORK' attendance
        // [MODIFIED] Auto-create 'FULL' (Tam Gün Çalıştı) as requested
        if (data.startDate && data.siteId) {
            const startDate = new Date(data.startDate);
            startDate.setHours(0, 0, 0, 0);

            await prisma.personnelAttendance.create({
                data: {
                    personnelId: person.id,
                    siteId: data.siteId,
                    date: startDate,
                    status: 'FULL', // Worked (Tam Gün)
                    hours: 11,
                    note: 'İşe Giriş - İlk Gün'
                }
            });
        }

        revalidateTag('personnel');
        revalidatePath('/dashboard/personnel');
        revalidatePath('/dashboard/new-tab'); // Revalidate the new attendance page
        return { success: true, data: person };
    } catch (error) {
        console.error('createPersonnel Error:', error);
        return { success: false, error: 'Personel eklenemedi.' };
    }
}

// [DEPRECATED] Use API Route instead
// due to Next.js Server Action Timeout/Hang issues with large payloads/connections
/*
export async function upsertPersonnelAttendance(...) { ... }
*/


// [NEW] Get Personnel WITH Attendance (For the Grid)
export async function getPersonnelWithAttendance(month: Date | string, siteId?: string) {
    try {
        const monthDate = new Date(month);
        const startOfMonth = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1));
        const endOfMonth = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999));

        console.log(`[READ_ATTENDANCE] Input Month: ${month}, Queries: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);

        const stablePersonnel = await prisma.personnel.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { status: 'ACTIVE' },
                            { leftDate: { gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1) } },
                            {
                                attendance: {
                                    some: {
                                        date: {
                                            gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
                                            lte: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    (siteId && siteId !== 'all') ? {
                        OR: [
                            { siteId },
                            { assignedSites: { some: { id: siteId } } }
                        ]
                    } : {}
                ]
            },
            include: {
                attendance: {
                    where: {
                        date: {
                            gte: new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1)), // Start of Month (UTC)
                            lte: new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)) // End of Month (UTC)
                        }
                    }
                },
                salaryAdjustments: {
                    where: {
                        year: monthDate.getFullYear(),
                        month: monthDate.getMonth() + 1
                    }
                }
            },
            orderBy: { fullName: 'asc' }
        });

        return {
            success: true,
            data: stablePersonnel,
            queryDebug: {
                receivedMonth: month,
                start: startOfMonth.toISOString(),
                end: endOfMonth.toISOString(),
                siteId: siteId,
                count: stablePersonnel.length
            }
        };
    } catch (error) {
        console.error('getPersonnelWithAttendance Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown Error',
            debugStack: error instanceof Error ? error.stack : undefined
        };
    }
}

export async function updatePersonnel(id: string, data: Partial<Personnel>) {
    try {
        const { assignedSiteIds, ...rest } = data as any; // [FIX] Extract non-Prisma fields

        const person = await prisma.personnel.update({
            where: { id },
            data: {
                ...rest,
                assignedSites: assignedSiteIds ? {
                    set: assignedSiteIds.map((id: string) => ({ id }))
                } : undefined
            }
        });
        revalidateTag('personnel');
        revalidatePath('/dashboard/personnel');
        revalidatePath('/dashboard/new-tab');
        return { success: true, data: person };
    } catch (error) {
        console.error('updatePersonnel Error:', error);
        return { success: false, error: 'Personel güncellenemedi.' };
    }
}
export async function deletePersonnel(id: string) {
    try {
        // [MODIFIED] Cascade Delete: Delete attendance history first
        await prisma.personnelAttendance.deleteMany({ where: { personnelId: id } });

        const person = await prisma.personnel.delete({
            where: { id }
        });
        revalidateTag('personnel');
        revalidateTag('personnel');
        revalidateTag('personnel');
        revalidatePath('/dashboard/personnel');
        return { success: true, data: person };
    } catch (error) {
        console.error('deletePersonnel Error:', error);
        return { success: false, error: 'Personel silinemedi.' };
    }
}

// [NEW] Upsert Salary Adjustment
export async function upsertSalaryAdjustment(
    personnelId: string,
    date: Date,
    field: 'bonus' | 'deduction',
    value: number | null
) {
    try {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        const existing = await prisma.salaryAdjustment.findUnique({
            where: {
                personnelId_year_month: {
                    personnelId,
                    year,
                    month
                }
            }
        });

        if (existing) {
            await prisma.salaryAdjustment.update({
                where: { id: existing.id },
                data: {
                    [field]: value
                }
            });
        } else {
            // Create new with default 0s for others
            await prisma.salaryAdjustment.create({
                data: {
                    personnelId,
                    year,
                    month,
                    [field]: value,
                    // If creating new, other field defaults to null/0 effectively
                }
            });
        }

        revalidatePath('/dashboard/new-tab');
        return { success: true };
    } catch (error) {
        console.error('upsertSalaryAdjustment Error:', error);
        return { success: false, error: 'Maaş düzeltmesi kaydedilemedi.' };
    }
}

// [NEW] Add Personnel to Site (Additive)
export async function addPersonnelToSite(personnelIds: string[], siteId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            for (const pId of personnelIds) {
                const person = await tx.personnel.findUnique({
                    where: { id: pId },
                    select: { assignedSites: { select: { id: true } } }
                });

                if (!person) continue;

                const currentSiteIds = person.assignedSites.map(s => s.id);
                if (currentSiteIds.includes(siteId)) continue; // Already assigned

                await tx.personnel.update({
                    where: { id: pId },
                    data: {
                        assignedSites: {
                            connect: { id: siteId }
                        },
                        // Optionally update primary siteId if it's the first one or logic dictates
                        // siteId: siteId 
                    }
                });
            }
        });
        revalidateTag('personnel');
        revalidatePath('/dashboard/personnel');
        return { success: true };
    } catch (error: any) {
        console.error('addPersonnelToSite Error:', error);
        return { success: false, error: 'Ekleme işlemi yapılamadı: ' + (error.message || error) };
    }
}

export async function removePersonnelFromSite(personnelIds: string[], siteId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            for (const pId of personnelIds) {
                await tx.personnel.update({
                    where: { id: pId },
                    data: {
                        assignedSites: {
                            disconnect: { id: siteId }
                        }
                    }
                });
            }
        });
        revalidateTag('personnel');
        revalidatePath('/dashboard/personnel');
        return { success: true };
    } catch (error: any) {
        console.error('removePersonnelFromSite Error:', error);
        return { success: false, error: 'Çıkarma işlemi yapılamadı: ' + (error.message || error) };
    }
}

// [NEW] Get Personnel Summary By Site
export async function getPersonnelSiteSummary() {
    try {
        // Fetch sites with both primary attached personnel and assigned personnel
        const sites = await prisma.site.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                personnel: {
                    where: { status: 'ACTIVE' },
                    select: { id: true, salary: true }
                },
                assignedPersonnel: {
                    where: { status: 'ACTIVE' },
                    select: { id: true, salary: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        const summary = sites.map(site => {
            // Merge both lists and deduplicate by ID
            const allPersonnelMap = new Map<string, { id: string, salary: number | null }>();

            site.personnel.forEach(p => allPersonnelMap.set(p.id, p));
            site.assignedPersonnel.forEach(p => allPersonnelMap.set(p.id, p));

            const uniquePersonnel = Array.from(allPersonnelMap.values());

            const totalSalary = uniquePersonnel.reduce((sum, p) => sum + (p.salary || 0), 0);

            return {
                id: site.id,
                name: site.name,
                count: uniquePersonnel.length,
                totalSalary: totalSalary
            };
        });

        // Filter out sites with 0 personnel if desired, or keep them to show empty sites
        // For now, let's keep all active sites to give a full picture
        return { success: true, data: summary };

    } catch (error: any) {
        console.error('getPersonnelSiteSummary Error:', error);
        return { success: false, error: 'Şantiye özet bilgisi alınamadı.' };
    }
}

// [NEW] Get Bulk Personnel Attendance List (for Store Hydration)
export async function getPersonnelAttendanceList() {
    try {
        // [PERFORMANCE] Limit to recent years (2025+) to avoid huge payload
        const cutoffDate = new Date('2025-01-01');

        const records = await prisma.personnelAttendance.findMany({
            take: 5000, // [PERFORMANCE] Increased limit for production use
            where: {
                date: { gte: cutoffDate }
            },
            orderBy: { date: 'desc' }
        });
        return { success: true, data: records };
    } catch (error: any) {
        console.error('getPersonnelAttendanceList Error:', error);
        return { success: false, error: 'Personel puantaj listesi alınamadı.' };
    }
}
