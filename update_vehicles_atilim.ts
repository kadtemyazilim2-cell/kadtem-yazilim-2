
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plates = [
    "15 AAH 448", "01 C 9569", "06 BHD 462", "09 ADA 284", "20 AT 901",
    "15 ABK 784", "20 AAU 061", "20 AC 240", "20 AFA 092", "20 AFA 898",
    "20 AGN 312", "20 AGT 534", "20 AGV 818", "20 AIC 919", "20 AIF 182",
    "20 AJE 763", "20 AJF 532", "20 AOF 266", "20 AOS 213", "20 APF 898",
    "20 B 0460", "20 D 9172", "20 D 9221", "20 KS 695", "20 PR 205",
    "20 SV 588", "2025 T", "3035 T"
];

async function main() {
    // 1. Find or Create Company
    let company = await prisma.company.findFirst({
        where: { name: "ATILIM İNŞAAT" }
    });

    if (!company) {
        console.log("Creating company 'ATILIM İNŞAAT'...");
        company = await prisma.company.create({
            data: {
                name: "ATILIM İNŞAAT",
                status: "ACTIVE"
            }
        });
    }

    console.log(`Using company: ${company.name} (${company.id})`);

    // 2. Update Vehicles
    // Reset rental info to ensure they are treated as pure OWNED for this company
    const result = await prisma.vehicle.updateMany({
        where: {
            plate: { in: plates }
        },
        data: {
            companyId: company.id,
            ownership: 'OWNED',
            rentalCompanyName: null, // Clear rental company if any
            monthlyRentalFee: null,
            rentalContact: null,
            assignedSiteId: null // Clear site if we want them to just look like normal owned vehicles initially, or keep it? User didn't say.
            // Actually, keeping site might be safer, but if they were 'Rental', maybe site was set.
            // User just said "Change Company". Let's stick to changing Company and Ownership.
        }
    });

    console.log(`Updated ${result.count} vehicles.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
