
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting vehicle company correction (Round 2)...');

    // 1. Find "ATILIM İNŞAAT"
    const atilim = await prisma.company.findFirst({
        where: {
            name: {
                contains: 'ATILIM',
                mode: 'insensitive',
            },
        },
    });

    if (!atilim) {
        throw new Error('Company ATILIM İNŞAAT not found! It should have been created in Round 1.');
    }
    console.log(`Target Company: ${atilim.name} (${atilim.id})`);

    // 2. Define Vehicles to Move
    // Added "Kiralık" correcting the plate name
    const targetPlates = [
        'HYUNDAİ 210',
        'JCB',
        'Kiralık', // Corrected from 'Kiralık Jcb'
        'NEWHOLLAND',
        'SUMİTOMO 210',
        'SUMİTOMO 300',
        'SUMİTOMO SH 210 LC',
        'Tümosan 7056',
        'Tümosan 8095',
        'TÜMOSAN 8095',
    ];

    // 3. Find and Update Vehicles
    for (const plate of targetPlates) {
        // Find vehicle that matches Valid Plate AND is NOT already in Atılım
        // This solves the issue of finding the same "Tümosan 8095" twice if they look same insensitively.
        const vehicle = await prisma.vehicle.findFirst({
            where: {
                plate: {
                    equals: plate,
                    mode: 'insensitive'
                },
                companyId: {
                    not: atilim.id
                }
            },
        });

        if (vehicle) {
            console.log(`Found candidate: [${vehicle.plate}] (ID: ${vehicle.id}) currently in ${vehicle.companyId}`);
            await prisma.vehicle.update({
                where: { id: vehicle.id },
                data: {
                    companyId: atilim.id,
                },
            });
            console.log(`  Moved to ${atilim.name} (Success)`);
        } else {
            // Just checking if it's already done
            const done = await prisma.vehicle.findFirst({
                where: {
                    plate: { equals: plate, mode: 'insensitive' },
                    companyId: atilim.id
                }
            });
            if (done) {
                console.log(`Vehicle [${plate}] is already assigned to target. Skipping.`);
            } else {
                console.warn(`WARNING: Vehicle with plate "${plate}" not found (and not in target company either).`);
            }
        }
    }

    console.log('Correction complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
