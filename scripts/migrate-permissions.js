// Migration script: Rename 'new-tab' permission keys to 'personnel-attendance' for all users
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migratePermissions() {
    try {
        const users = await prisma.user.findMany();
        let updated = 0;

        for (const user of users) {
            if (!user.permissions || typeof user.permissions !== 'object') continue;

            const perms = user.permissions;
            const newPerms = {};
            let changed = false;

            for (const [key, value] of Object.entries(perms)) {
                if (key === 'new-tab' || key.startsWith('new-tab.')) {
                    const newKey = key.replace('new-tab', 'personnel-attendance');
                    newPerms[newKey] = value;
                    changed = true;
                    console.log(`  User "${user.name}": ${key} -> ${newKey}`);
                } else {
                    newPerms[key] = value;
                }
            }

            if (changed) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { permissions: newPerms }
                });
                updated++;
                console.log(`  ✅ Updated user: ${user.name}`);
            }
        }

        console.log(`\n✅ Migration complete. ${updated} user(s) updated.`);
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migratePermissions();
