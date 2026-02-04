
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING BULK UPDATE: MARK ALL FUEL LOGS AS FULL ---');

    try {
        const result = await prisma.fuelLog.updateMany({
            data: {
                fullTank: true
            }
        });

        console.log(`✅ Success: ${result.count} fuel logs have been marked as 'Full Tank'.`);

        // Trigger revalidation?
        // Since this is an external script, Next.js cache won't know immediately given I can't call revalidatePath here.
        // But the user can refresh the page.
    } catch (error) {
        console.error('❌ Error updating fuel logs:', error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
