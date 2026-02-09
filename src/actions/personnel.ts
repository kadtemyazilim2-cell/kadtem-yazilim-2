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
    dateInput: Date | string,
    data: {
        status: string;
        hours?: number;
        overtime?: number;
        note?: string;
        siteId: string;
    }
) {
    const fs = await import('fs');
    const logFile = 'debug-attendance.log';
    const log = (msg: string) => {
        try { fs.appendFileSync(logFile, `${new Date().toISOString()} - ${msg}\n`); } catch (e) { }
    };

    try {
        log(`[START] Upsert for Person: ${personnelId}, Date: ${dateInput}, SiteIn: '${data.siteId}', Status: ${data.status}`);

        // [FIX] Valid SiteId Check
        let targetSiteId = data.siteId;

        // If siteId is empty or invalid, try to fetch from Personnel
        if (!targetSiteId || targetSiteId.trim() === '') {
            const person = await prisma.personnel.findUnique({
                where: { id: personnelId },
                select: { siteId: true, assignedSites: { take: 1, select: { id: true } } }
            });

            if (person) {
                if (person.siteId) {
                    targetSiteId = person.siteId;
                    log(`[INFO] Found Primary Site: ${targetSiteId}`);
                } else if (person.assignedSites.length > 0) {
                    targetSiteId = person.assignedSites[0].id;
                    log(`[INFO] Found Assigned Site: ${targetSiteId}`);
                }
            }
        }

        // Final check - if still no siteId, we can't save (or it will save with empty string if DB allows but Logic breaks)
        // DB allows empty string from test, but let's enforce Logic.
        if (!targetSiteId) {
            log('[ERROR] No Site ID found.');
            return { success: false, error: 'Puantaj girişi için personelin bir şantiyesi olmalıdır.' };
        }


        // [FIX] Handle Date normalization safely
        let dateObj: Date;
        if (typeof dateInput === 'string') {
            // Assume YYYY-MM-DD string, parse manually to UTC midnight to avoid local timezone offset
            const [y, m, d] = dateInput.split('-').map(Number);
            dateObj = new Date(Date.UTC(y, m - 1, d)); // UTC Midnight
            console.log(`[UPSERT] String Input: ${dateInput} -> UTC: ${dateObj.toISOString()}`);
        } else {
            // Fallback for Date object (Legacy or internal calls)
            // If it's a Date object, it might be shifted.
            // We'll trust the caller meant this absolute time, but normalize to UTC midnight for consistency if needed.
            // But safest is to use the string path.
            dateObj = new Date(dateInput);
            console.warn(`[UPSERT] Object Input: ${dateInput} -> ${dateObj.toISOString()}`);
        }

        // Define Start/End of Day in UTC to ensure we capture the record regardless of slight deviations
        // Using UTC boundaries matches the dateObj created above.
        const startOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        log(`[INFO] Date Range: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);

        // [SECURE] Fetch User & Permissions
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) {
            log('[ERROR] No Session User ID');
            return { success: false, error: 'Oturum bulunamadı.' };
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, status: true, editLookbackDays: true }
        });

        if (!dbUser || dbUser.status !== 'ACTIVE') {
            log('[ERROR] User Inactive or invalid');
            return { success: false, error: 'Hesabınız aktif değil.' };
        }

        // [SECURE] Date Restriction Check
        if (dbUser.role !== 'ADMIN') {
            const limit = dbUser.editLookbackDays ?? 3; // [FIX] Default to 3 days to match Client

            // [FIX] Robust Day Difference Check
            // Compare UTC Midnight of Today vs Target Date
            const now = new Date();
            const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            // dateObj is already UTC Midnight from string logic above

            // Calculate diff in days
            const diffTime = todayUtc.getTime() - startOfDay.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > limit) {
                const msg = limit === 0 ? 'Bugünden eski tarihli puantaj giremezsiniz.' : `Geriye dönük en fazla ${limit} gün işlem yapabilirsiniz. (Seçilen: ${diffDays} gün önce)`;
                log(`[ERROR] Date Restriction: ${msg}`);
                return { success: false, error: msg };
            }
        }

        // If specific status (e.g. '', null) -> DELETE
        if (!data.status) {
            const del = await prisma.personnelAttendance.deleteMany({
                where: {
                    personnelId,
                    date: {
                        gte: startOfDay,
                        lt: endOfDay
                    }
                }
            });
            log(`[SUCCESS] Deleted ${del.count} records.`);
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
                log(`[INFO] Updating Existing Record: ${existing.id}`);
                await prisma.personnelAttendance.update({
                    where: { id: existing.id },
                    data: {
                        status: data.status,
                        hours: data.hours !== undefined ? data.hours : existing.hours,
                        overtime: data.overtime,
                        note: data.note,
                        siteId: targetSiteId // Use validated SiteId
                    }
                });
            } else {
                log(`[INFO] Creating New Record`);
                await prisma.personnelAttendance.create({
                    data: {
                        personnelId,
                        date: dateObj,
                        status: data.status,
                        hours: data.hours || 0,
                        overtime: data.overtime,
                        note: data.note,
                        siteId: targetSiteId // Use validated SiteId
                    }
                });
            }

            // [FIX] If status is 'EXIT', update Personnel status and leftDate
            if (data.status === 'EXIT') {
                await prisma.personnel.update({
                    where: { id: personnelId },
                    data: {
                        status: 'PASSIVE', // Or 'LEFT'
                        leftDate: dateObj
                    }
                });
            } else {
                // If we are NOT setting EXIT (or we deleted it), check if any EXIT remains
                const hasExit = await prisma.personnelAttendance.findFirst({
                    where: {
                        personnelId,
                        status: 'EXIT'
                    }
                });

                if (!hasExit) {
                    // No exits left, revert to ACTIVE
                    await prisma.personnel.update({
                        where: { id: personnelId },
                        data: {
                            status: 'ACTIVE',
                            leftDate: null
                        }
                    });
                }
            }
        }

        revalidatePath('/dashboard/new-tab');
        log('[SUCCESS] Transaction Complete');
        return { success: true };
    } catch (error: any) {
        console.error('upsertPersonnelAttendance Error:', error);
        return { success: false, error: error.message };
    }
}

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
