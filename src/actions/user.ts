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

        revalidatePath('/dashboard/admin'); // Invalidate admin page
        return { success: true, data: user };
    } catch (error) {
        console.error('createUser Error:', error);
        return { success: false, error: 'Kullanıcı oluşturulamadı.' };
    }
}

export async function updateUser(id: string, data: Partial<User> & { assignedSiteIds?: string[] }) {
    try {
        const user = await prisma.user.update({
            where: { id },
            data: {
                username: data.username,
                password: data.password || undefined,
                role: data.role,
                permissions: data.permissions as any,
                editLookbackDays: data.editLookbackDays,
                status: data.status,
                assignedSites: data.assignedSiteIds ? {
                    set: data.assignedSiteIds.map((sid: string) => ({ id: sid }))
                } : undefined
            }
        });
        revalidatePath('/dashboard/admin');
        return { success: true, data: user };
    } catch (error) {
        console.error('updateUser Error:', error);
        return { success: false, error: 'Kullanıcı güncellenemedi.' };
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
