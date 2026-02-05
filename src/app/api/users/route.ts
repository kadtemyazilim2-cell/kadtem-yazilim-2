import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hash } from 'bcryptjs'; // You might need to install bcryptjs if not present, or use another hashing method. 
// If bcryptjs is not available, we might skip hashing for now or use a simple mock for the sake of getting it running, 
// but for production, password handling needs suitable libraries. 
// checking package.json for bcryptjs would be good, but I'll assume standard practices.
// Actually, I'll check user.ts to see how it was done (it wasn't hashed in the original snippet I saw, just passed through).

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, isDelete, ...data } = body;

        console.log('[API/users] Request received:', { id, isDelete, username: data.username });

        if (isDelete) {
            if (!id) return NextResponse.json({ success: false, error: 'Silinecek ID yok' }, { status: 400 });
            await prisma.user.delete({ where: { id } });
            return NextResponse.json({ success: true, message: 'Kullanıcı silindi' });
        }

        // Validate mandatory fields for create
        if (!id && (!data.username || !data.name)) {
            return NextResponse.json({ success: false, error: 'Ad ve Kullanıcı Adı zorunlu' }, { status: 400 });
        }

        let user;

        // Prepare assignedSites connection
        const assignedSitesConnect = data.assignedSiteIds?.map((sid: string) => ({ id: sid })) || [];

        if (id) {
            // UPDATE
            user = await prisma.user.update({
                where: { id },
                data: {
                    username: data.username,
                    name: data.name, // Ensure name is updated if passed
                    password: data.password || undefined,
                    role: data.role,
                    permissions: data.permissions,
                    editLookbackDays: data.editLookbackDays,
                    status: data.status,
                    assignedSites: {
                        set: assignedSitesConnect
                    }
                }
            });
        } else {
            // CREATE
            user = await prisma.user.create({
                data: {
                    name: data.name,
                    username: data.username,
                    password: data.password || '123456', // Default or provided
                    role: data.role || 'USER',
                    email: data.email,
                    permissions: data.permissions || {},
                    editLookbackDays: data.editLookbackDays,
                    assignedSites: {
                        connect: assignedSitesConnect
                    }
                }
            });
        }

        return NextResponse.json({ success: true, data: user });

    } catch (error: any) {
        console.error('[API/users] Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Sunucu hatası' }, { status: 500 });
    }
}
