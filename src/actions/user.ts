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
                    connect: data.assignedCompanyIds?.map(id => ({ id })) || []
                },
                assignedSites: {
                    connect: data.assignedSiteIds?.map(id => ({ id })) || []
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
