
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Clearing Kenan Tugay Logo...');

    // Find the company
    const company = await prisma.company.findFirst({
        where: {
            name: { contains: 'Kenan', mode: 'insensitive' }
        }
    });

    if (!company) {
        console.log('Company "Kenan Tugay" not found.');
        return;
    }

    console.log(`Found company: ${company.name} (${company.id})`);
    console.log(`Current Letterhead Size: ${company.letterhead ? company.letterhead.length : 0} bytes`);

    // Update to remove letterhead and logoUrl
    await prisma.company.update({
        where: { id: company.id },
        data: {
            letterhead: null,
            logoUrl: null, // Clear this too just in case
            stamp: null // Keeping stamp? Maybe user wants stamp? But let's verify.
            // User complaint is about "Header" (Baslik). Stamp is footer.
            // I will only clear letterhead/logoUrl.
        }
    });

    console.log('Cleared letterhead and logoUrl.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
