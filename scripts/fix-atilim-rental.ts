
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Atilim Insaat Rental Correction...');

    // 1. Find the accidentally created "ATILIM İNŞAAT" company
    const atilimCompany = await prisma.company.findFirst({
        where: {
            name: {
                contains: 'ATILIM',
                mode: 'insensitive',
            },
        },
    });

    if (!atilimCompany) {
        console.log('Company "ATILIM İNŞAAT" not found. Nothing to delete.');
        return;
    }
    console.log(`Found erroneous company: ${atilimCompany.name} (${atilimCompany.id})`);

    // 2. Find vehicles assigned to this company
    const vehicles = await prisma.vehicle.findMany({
        where: {
            companyId: atilimCompany.id,
        },
    });

    console.log(`Found ${vehicles.length} vehicles assigned to it.`);

    // 3. Update vehicles to be Rental under IKIKAT (or default company)
    // We'll map them back to 'comp_ikikat' as a safe default based on user context
    const targetCompanyId = 'comp_ikikat';

    for (const v of vehicles) {
        console.log(`Updating [${v.plate}]...`);
        await prisma.vehicle.update({
            where: { id: v.id },
            data: {
                companyId: targetCompanyId, // Back to valid company
                ownership: 'RENTAL',        // Mark as Rental
                rentalCompanyName: 'ATILIM İNŞAAT', // Set the provider name correctly
                monthlyRentalFee: 0,        // Reset or leave as is (0 default)
                rentalLastUpdate: new Date()
            },
        });
    }
    console.log('All vehicles updated.');

    // 4. Delete the erroneous company
    console.log('Deleting company "ATILIM İNŞAAT"...');
    await prisma.company.delete({
        where: { id: atilimCompany.id },
    });
    console.log('Company deleted successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
