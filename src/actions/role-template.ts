'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function createRoleTemplate(name: string, permissions: any) {
    try {
        const session = await auth();
        if (session?.user?.role !== 'ADMIN') {
            return { success: false, error: 'Yetkisiz işlem.' };
        }

        if (!name || !name.trim()) {
            return { success: false, error: 'Şablon adı zorunludur.' };
        }

        // Check if name exists
        const existing = await prisma.roleTemplate.findUnique({
            where: { name }
        });

        if (existing) {
            return { success: false, error: 'Bu isimde bir şablon zaten mevcut.' };
        }

        const template = await prisma.roleTemplate.create({
            data: {
                name,
                permissions
            }
        });

        revalidatePath('/dashboard/admin');
        return { success: true, data: JSON.parse(JSON.stringify(template)) };
    } catch (error: any) {
        console.error('createRoleTemplate Error:', error);
        return { success: false, error: 'Şablon oluşturulamadı.' };
    }
}

export async function getRoleTemplates() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: 'Oturum açılmalı.' };

        const templates = await prisma.roleTemplate.findMany({
            orderBy: { name: 'asc' }
        });

        // Serialize to plain objects (DateTime fields can't be serialized by Next.js server actions)
        const serialized = JSON.parse(JSON.stringify(templates));

        return { success: true, data: serialized };
    } catch (error) {
        console.error('getRoleTemplates Error:', error);
        return { success: false, error: 'Şablonlar alınamadı.' };
    }
}

export async function updateRoleTemplate(id: string, permissions: any) {
    try {
        const session = await auth();
        if (session?.user?.role !== 'ADMIN') {
            return { success: false, error: 'Yetkisiz işlem.' };
        }

        const template = await prisma.roleTemplate.update({
            where: { id },
            data: { permissions }
        });

        revalidatePath('/dashboard/admin');
        return { success: true, data: JSON.parse(JSON.stringify(template)) };
    } catch (error: any) {
        console.error('updateRoleTemplate Error:', error);
        return { success: false, error: 'Şablon güncellenemedi.' };
    }
}

export async function deleteRoleTemplate(id: string) {
    try {
        const session = await auth();
        if (session?.user?.role !== 'ADMIN') {
            return { success: false, error: 'Yetkisiz işlem.' };
        }

        await prisma.roleTemplate.delete({
            where: { id }
        });

        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (error) {
        console.error('deleteRoleTemplate Error:', error);
        return { success: false, error: 'Şablon silinemedi.' };
    }
}
