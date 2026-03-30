const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for 1150 TL transactions or System Admin related data...');
    
    // Find System Admin user
    const admin = await prisma.user.findFirst({
        where: { name: { contains: 'Sistem Yöneticisi' } }
    });
    
    if (admin) {
        console.log('Admin User Found:', admin.id, admin.name);
    } else {
        console.log('Admin User not found by name.');
    }

    const transactions = await prisma.cashTransaction.findMany({
        where: {
            OR: [
                { amount: 1150 },
                { description: { contains: '1150' } },
                admin ? { responsibleUserId: admin.id } : {},
                admin ? { createdByUserId: admin.id } : {}
            ]
        },
        include: {
            site: true,
            createdByUser: true,
            responsibleUser: true
        }
    });

    console.log('Found transactions count:', transactions.length);
    if (transactions.length > 0) {
        transactions.forEach(t => {
            console.log(`- ID: ${t.id}, Amount: ${t.amount}, Type: ${t.type}, Site: ${t.site?.name}, Resp: ${t.responsibleUser?.name}, Desc: ${t.description}`);
        });
    }

    // Check balance start records
    const balanceStarts = await prisma.cashTransaction.findMany({
        where: { type: 'BALANCE_START' },
        include: { site: true, responsibleUser: true }
    });
    console.log('Balance Start Records count:', balanceStarts.length);
    balanceStarts.forEach(t => {
        console.log(`- Site: ${t.site?.name}, Resp: ${t.responsibleUser?.name || 'N/A'}, Amount: ${t.amount}`);
    });

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
