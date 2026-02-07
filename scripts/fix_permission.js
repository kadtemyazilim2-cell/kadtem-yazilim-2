
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const targetUsername = 'can'; // Based on screenshot
    console.log(`Searching for user: ${targetUsername}...`);

    const user = await prisma.user.findFirst({
        where: { username: targetUsername } // Try username first
    });

    if (!user) {
        console.error('User not found!');
        // Try escaping or case insensitive? No, Prisma findFirst is case sensitive usually.
        // Let's list all users to see if we can find 'can'.
        const allUsers = await prisma.user.findMany({ select: { username: true, id: true } });
        console.log('Available users:', allUsers);
        return;
    }

    console.log(`Found user: ${user.username} (${user.id})`);
    console.log('Current Permissions:', JSON.stringify(user.permissions, null, 2));

    let perms = user.permissions || {};

    // Add the missing permission
    if (!perms['cash-book.admin-view']) {
        perms['cash-book.admin-view'] = ['VIEW'];
        console.log('Adding cash-book.admin-view permission...');
    } else {
        console.log('Permission already exists! Maybe value is wrong?');
        console.log('Value:', perms['cash-book.admin-view']);
        // Ensure it has VIEW
        if (!perms['cash-book.admin-view'].includes('VIEW')) {
            perms['cash-book.admin-view'].push('VIEW');
            console.log('Added VIEW to existing key.');
        }
    }

    // Update User
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { permissions: perms }
    });

    console.log('User updated successfully!');
    console.log('New Permissions:', JSON.stringify(updated.permissions, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
