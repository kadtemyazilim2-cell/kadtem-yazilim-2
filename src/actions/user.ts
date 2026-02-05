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

export async function updateUser(id: string, data: Partial<User> & { assignedSiteIds?: string[] }) {
    try {
        console.log('[updateUser] Action NUCLEAR MOCK started for ID:', id);

        // NUCLEAR OPTION: Bypass DB completely to test connectivity
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[updateUser] NUCLEAR MOCK Success returning');
        return { success: true, data: { id, ...data } as any };
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
