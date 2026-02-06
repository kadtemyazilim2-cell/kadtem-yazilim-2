'use server';

import { prisma } from '@/lib/db';
import { User } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
    try {
        const users = await prisma.user.findMany({
            include: {
                assignedCompanies: true,
                assignedSites: true
            },
            orderBy: { name: 'asc' }
        });
        return { success: true, data: users };
    } catch (error) {
        console.error('getUsers Error:', error);
        return { success: false, error: 'Kullanıcılar getirilirken hata oluştu.' };
    }
}

export async function createUser(data: Partial<User> & { assignedCompanyIds?: string[], assignedSiteIds?: string[] }) {
    try {
        console.log('[createUser] Action started', { name: data.name, username: data.username });

        // Basic validation/hashing would go here.
        const user = await prisma.user.create({
            data: {
                name: data.name!,
                username: data.username!,
                password: data.password, // Ideally hash this!
                role: data.role || 'USER',
                email: data.email,
                permissions: data.permissions as any || {},
                editLookbackDays: data.editLookbackDays,
                assignedCompanies: {
                    connect: data.assignedCompanyIds?.map((id: string) => ({ id })) || []
                },
                assignedSites: {
                    connect: data.assignedSiteIds?.map((id: string) => ({ id })) || []
                }
            }
        });

        console.log('[createUser] User created in DB, ID:', user.id);

        // revalidatePath('/dashboard/admin'); // Invalidate admin page
        console.log('[createUser] Success returning');
        return { success: true, data: user };
    } catch (error) {
        console.error('createUser Error:', error);
        return { success: false, error: 'Kullanıcı oluşturulamadı.' };
    }
}

// [FIXED] Restored actual DB update logic
export async function updateUser(id: string, data: Partial<User> & { assignedSiteIds?: string[] }) {
    try {
        console.log('[updateUser] Action started for ID:', id);

        const { assignedSiteIds, ...rest } = data;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                ...rest,
                assignedSites: assignedSiteIds ? {
                    set: assignedSiteIds.map(sid => ({ id: sid }))
                } : undefined
            },
            include: {
                assignedCompanies: true,
                assignedSites: true
            }
        });

        // revalidatePath('/dashboard/admin');
        return { success: true, data: updatedUser };
    } catch (error) {
        console.error('updateUser Error:', error);
        return { success: false, error: 'Kullanıcı güncellenemedi.' };
    }
}

// [NEW] Get Single User Fresh Data
export async function getUserById(id: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                assignedCompanies: true,
                assignedSites: true
            }
        });

        if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

        // Ensure flattened IDs are present for frontend logic if needed, 
        // though frontend usually derives them from arrays.
        // We return the raw Prisma object, frontend handles mapping.
        return { success: true, data: user };
    } catch (error) {
        console.error('getUserById Error:', error);
        return { success: false, error: 'Kullanıcı verisi alınamadı.' };
    }
}

export async function deleteUser(id: string) {
    try {
        await prisma.user.delete({ where: { id } });
        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (error) {
        console.error('deleteUser Error:', error);
        return { success: false, error: 'Kullanıcı silinemedi.' };
    }
}
