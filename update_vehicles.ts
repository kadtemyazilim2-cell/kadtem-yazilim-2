import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updates = [
    { plate: '60 AAN 203', owner: 'İbrahim Temir' },
    { plate: '60 ACU 271', owner: 'Erkan Yiğit' },
    { plate: '60 AEY 074', owner: 'Hidromek Servis' },
    { plate: '60 HT 260', owner: 'Feyzullah Usta' },
    { plate: '06 ADV 304', owner: 'Atılım İnşaat' }
];

async function main() {
    console.log("Starting updates...");

    for (const item of updates) {
        try {
            const vehicle = await prisma.vehicle.findUnique({
                where: { plate: item.plate }
            });

            if (!vehicle) {
                console.warn(`Vehicle with plate ${item.plate} not found!`);
                continue;
            }

            console.log(`Updating ${item.plate}:`);
            console.log(`  Old: Ownership=${vehicle.ownership}, RentalCo=${vehicle.rentalCompanyName}`);

            const updated = await prisma.vehicle.update({
                where: { plate: item.plate },
                data: {
                    ownership: 'RENTAL',
                    rentalCompanyName: item.owner
                }
            });

            console.log(`  New: Ownership=${updated.ownership}, RentalCo=${updated.rentalCompanyName}`);
        } catch (e) {
            console.error(`Error updating ${item.plate}:`, e);
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
