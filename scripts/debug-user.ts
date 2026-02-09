
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst({
            where: { name: { contains: 'Ahmet Can' } },
            include: { assignedSites: true }
        });

        if (user) {
            console.log('User Found:', user.name);
            console.log('Role:', user.role);
            console.log('Assigned Sites Count:', user.assignedSites.length);
            console.log('Assigned Sites Names:', user.assignedSites.map(s => s.name));
            const perms = user.permissions as Record<string, string[]>;
            console.log('Has "new-tab" key:', !!perms['new-tab']);
            console.log('"new-tab" value:', perms['new-tab']);
            console.log('Has "new-tab.attendance" key:', !!perms['new-tab.attendance']);
            console.log('Full Permissions Keys:', Object.keys(perms));
        } else {
            console.log('User not found');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
