
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const plates = ['60 AAN 203', '60 ACU 271', '60 AEY 074', '60 HT 260', '06 ADV 304'];
    const newOwners = [
        'İbrahim Temir',
        'Erkan Yiğit',
        'Hidromek Servis',
        'Feyzullah Usta',
        'Atılım İnşaat'
    ];

    console.log("Checking Vehicles:");
    const vehicles = await prisma.vehicle.findMany({
        where: { plate: { in: plates } },
        include: { company: true }
    });

    vehicles.forEach(v => {
        console.log(`- ${v.plate}: Current Company: ${v.company.name}, Ownership: ${v.ownership}, RentalCompany: ${v.rentalCompanyName}`);
    });

    console.log("\nChecking Companies (Potential New Owners):");
    const companies = await prisma.company.findMany({
        where: { name: { in: newOwners, mode: 'insensitive' } }
    });

    companies.forEach(c => {
        console.log(`- Found Company: ${c.name} (ID: ${c.id})`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
