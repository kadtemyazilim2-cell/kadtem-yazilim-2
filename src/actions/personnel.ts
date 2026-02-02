'use server';

import { prisma } from '@/lib/db';
import { Personnel } from '@prisma/client';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

// [PERFORMANCE] Cached personnel query
const getPersonnelFromDb = unstable_cache(
    async () => {
        return await prisma.personnel.findMany({
            orderBy: { fullName: 'asc' },
            include: { site: true }
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
                leaveAllowance: data.leaveAllowance,
                hasOvertime: data.hasOvertime || false
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
        dateObj.setHours(0, 0, 0, 0);

        // If specific status (e.g. '', null) -> DELETE
        if (!data.status) {
            await prisma.personnelAttendance.deleteMany({
                where: {
                    personnelId,
                    date: dateObj
                }
            });
        } else {
            // Manual Upsert to handle lack of composite unique constraint
            const existing = await prisma.personnelAttendance.findFirst({
                where: { personnelId, date: dateObj }
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
                status: 'ACTIVE', // Or include LEFT if they worked in this month?
                // Logic: show if active OR (leftDate > startOfMonth)
                OR: [
                    { status: 'ACTIVE' },
                    { leftDate: { gte: new Date(month.getFullYear(), month.getMonth(), 1) } }
                ],
                // Filter by site if provided
                ...(siteId && siteId !== 'all' ? { siteId } : {})
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
        const person = await prisma.personnel.update({
            where: { id },
            data: { ...data }
        });
        revalidateTag('personnel');
        revalidateTag('personnel');
        revalidateTag('personnel');
        revalidatePath('/dashboard/personnel');
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
