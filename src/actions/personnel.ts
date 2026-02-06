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

// [NEW] Update Attendance (Single Cell or Range)
export async function upsertPersonnelAttendance(
    personnelId: string,
    date: Date,
    data: {
        status: string;
        hours?: number;
        overtime?: number;
        note?: string;
        siteId: string;
    }
) {
    try {
        const dateObj = new Date(date);
        const nextDay = new Date(dateObj);
        nextDay.setDate(nextDay.getDate() + 1);

        // Normalize for range check
        const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        // If specific status (e.g. '', null) -> DELETE
        if (!data.status) {
            await prisma.personnelAttendance.deleteMany({
                where: {
                    personnelId,
                    date: {
                        gte: startOfDay,
                        lt: endOfDay
                    }
                }
            });
        } else {
            // Manual Upsert to handle lack of composite unique constraint
            const existing = await prisma.personnelAttendance.findFirst({
                where: {
                    personnelId,
                    date: {
                        gte: startOfDay,
                        lt: endOfDay
                    }
                }
            });

            if (existing) {
                await prisma.personnelAttendance.update({
                    where: { id: existing.id },
                    data: {
                        status: data.status,
                        hours: data.hours !== undefined ? data.hours : existing.hours,
                        overtime: data.overtime,
                        note: data.note,
                        siteId: data.siteId
                    }
                });
            } else {
                await prisma.personnelAttendance.create({
                    data: {
                        personnelId,
                        date: dateObj,
                        status: data.status,
                        hours: data.hours || 0,
                        overtime: data.overtime,
                        note: data.note,
                        siteId: data.siteId
                    }
                });
            }

            // [FIX] If status is 'EXIT', update Personnel status and leftDate
            if (data.status === 'EXIT') {
                await prisma.personnel.update({
                    where: { id: personnelId },
                    data: {
                        status: 'PASSIVE', // Or 'LEFT' if enum supports it, usually 'PASSIVE' or 'INACTIVE'
                        leftDate: dateObj
                    }
                });
            }
        }

        revalidatePath('/dashboard/new-tab');
        return { success: true };
    } catch (error: any) {
        console.error('upsertPersonnelAttendance Error:', error);
        return { success: false, error: error.message };
    }
}

// [NEW] Get Personnel WITH Attendance (For the Grid)
export async function getPersonnelWithAttendance(month: Date, siteId?: string) {
    try {
        const stablePersonnel = await prisma.personnel.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { status: 'ACTIVE' },
                            { leftDate: { gte: new Date(month.getFullYear(), month.getMonth(), 1) } },
                            {
                                attendance: {
                                    some: {
                                        date: {
                                            gte: new Date(month.getFullYear(), month.getMonth(), 1),
                                            lte: new Date(month.getFullYear(), month.getMonth() + 1, 0)
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    (siteId && siteId !== 'all') ? { siteId } : {}
                ]
            },
            include: {
                attendance: {
                    where: {
                        date: {
                            gte: new Date(month.getFullYear(), month.getMonth(), 1), // Start of Month
                            lte: new Date(month.getFullYear(), month.getMonth() + 1, 0) // End of Month
                        }
                    }
                },
                salaryAdjustments: {
                    where: {
                        year: month.getFullYear(),
                        month: month.getMonth() + 1
                    }
                }
            },
            orderBy: { fullName: 'asc' }
        });

        return { success: true, data: stablePersonnel };
    } catch (error) {
        console.error('getPersonnelWithAttendance Error:', error);
        return { success: false, error: 'Veri alınamadı.' };
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
