
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function importZileData() {
    console.log("Starting Zile Import (Standalone)...");
    const filePath = String.raw`C:\Users\Drone\Desktop\benzer iş grupları\alpha\zile 1\alpha zile 1.html`;

    if (!fs.existsSync(filePath)) {
        console.error("File not found at: " + filePath);
        return;
    }

    const html = fs.readFileSync(filePath, 'utf-8');

    // Find Target Site
    let site = await prisma.site.findFirst({
        where: { name: { contains: 'Tokat Zile' } }
    });

    if (!site) {
        console.log("Tokat Zile site not found. Searching for 'Zile'...");
        site = await prisma.site.findFirst({
            where: { name: { contains: 'Zile' } }
        });

        if (!site) {
            console.log("No Zile site found. Creating 'Tokat Zile Ovası 1. Kısım'...");

            // WE NEED A COMPANY ID
            const company = await prisma.company.findFirst();
            if (!company) {
                console.error("No company found! Cannot create Site.");
                return;
            }

            site = await prisma.site.create({
                data: {
                    name: 'Tokat Zile Ovası 1. Kısım',
                    location: 'Tokat Zile',
                    status: 'ACTIVE',
                    companyId: company.id
                }
            });
            console.log(`Created Site: ${site.name}`);
        }
    }

    console.log(`Target Site: ${site.name} (${site.id})`);

    // Find Target Vehicle
    const vehicle = await prisma.vehicle.findFirst({
        where: { plate: { contains: '7675' } }
    });

    if (!vehicle) {
        console.error("Vehicle 34-00-24-7675 not found!");
        return;
    }
    console.log(`Target Vehicle: ${vehicle.plate} (${vehicle.id})`);

    // Basic Regex Parsing
    const rows = html.split('<tr');
    let count = 0;

    // Retrieve Admin User for 'filledByUser'
    const adminUser = await prisma.user.findFirst({
        orderBy: { id: 'asc' }
    });

    if (!adminUser) {
        console.error("No users found in DB to assign as filledByUser.");
        return;
    }

    // Process Rows
    for (const row of rows) {
        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);

        if (!cells || cells.length < 10) continue;

        const cleanCell = (cell: string) => cell.replace(/<[^>]+>/g, '').trim();

        const dateStr = cleanCell(cells[1]);
        const vehicleText = cleanCell(cells[2]);
        const kmStr = cleanCell(cells[3]);
        const literStr = cleanCell(cells[4]);
        const provider = cleanCell(cells[9]);

        if (!vehicleText.includes('7675')) continue;
        if (!dateStr || !literStr) continue;
        if (dateStr === 'Tarih' || literStr === 'Miktar (LT)') continue;

        const dateMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
        if (!dateMatch) continue;

        const [_, day, month, year, hour, minute] = dateMatch;
        const isoDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00.000Z`);

        const literClean = literStr.replace(/\./g, '').replace(',', '.').replace('-', '');
        const liter = parseFloat(literClean);

        const kmClean = kmStr.replace(/\./g, '').replace(',', '.');
        const km = parseFloat(kmClean);

        if (isNaN(liter)) continue;

        const exists = await prisma.fuelLog.findFirst({
            where: {
                vehicleId: vehicle.id,
                date: isoDate,
                liters: liter
            }
        });

        if (!exists) {
            await prisma.fuelLog.create({
                data: {
                    date: isoDate,
                    liters: liter,
                    vehicleId: vehicle.id,
                    siteId: site.id,
                    mileage: isNaN(km) ? 0 : km,
                    unitPrice: 0,
                    cost: 0,
                    filledByUserId: adminUser.id,
                    fullTank: true,
                    description: `İçe Aktarım: ${provider}`
                }
            });
            count++;
            console.log(`Imported: ${dateStr} - ${liter}lt`);
        }
    }

    console.log(`Completed. Imported ${count} records.`);
}

importZileData()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
