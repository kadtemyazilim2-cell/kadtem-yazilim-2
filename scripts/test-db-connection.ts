
import { prisma } from '../src/lib/db';

async function main() {
    try {
        console.log('Connecting to database...');
        // Try to query something simple, e.g. count users
        const userCount = await prisma.user.count();
        console.log(`Successfully connected! Found ${userCount} users.`);

        // Check if we can query the new model
        // Note: The table for LimitValueCalculation might not exist yet if migrate/push hasn't run!
        // But I can try to access the model property to ensure client is generated correctly.
        if (prisma.limitValueCalculation) {
            console.log('LimitValueCalculation model exists on client.');
        } else {
            console.error('LimitValueCalculation model missing on client!');
        }

    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
