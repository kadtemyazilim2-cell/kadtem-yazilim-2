
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const SITE_MAP = {
    '1': 'cmkmop5q5000fhgexroggue2m', // Aydin
    '2': 'cmkmop1ku0005hgexcgjjregi', // Vezirkopru
    '3': 'cmkmooxq1000jsjtfm8kfo5hp'  // Zile 1
};

const STATUS_MAP = {
    '✔️': { status: 'WORK', hours: 9 },
    '🌓': { status: 'HALF_DAY', hours: 4.5 },
    '🛠️': { status: 'REPAIR', hours: 0 },
    '⛔': { status: 'IDLE', hours: 0 },
    '❌': { status: 'IDLE', hours: 0 },
    'X': { status: 'WORK', hours: 9 },
    'x': { status: 'WORK', hours: 9 },
    '/': { status: 'HALF_DAY', hours: 4.5 },
    'A': { status: 'REPAIR', hours: 0 }
};

async function main() {
    console.log('Starting Import Process...');

    // 1. Load Data
    const dataPath = path.join(__dirname, '../scraped_attendance.json');
    if (!fs.existsSync(dataPath)) {
        throw new Error('scraped_attendance.json not found!');
    }
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    let importData;
    try {
        importData = JSON.parse(rawData);
    } catch (e) {
        console.error("JSON Parse Error (File might be incomplete):", e.message);
        return;
    }

    console.log(`Loaded ${importData.length} site-month blocks.`);

    // [NEW] Fetch all vehicles with assignedSiteId
    const allVehicles = await prisma.vehicle.findMany({ select: { id: true, plate: true, assignedSiteId: true } });
    const vehicleMap = new Map();
    allVehicles.forEach(v => {
        const norm = v.plate.replace(/[\s-]/g, '').toUpperCase();
        if (norm.length < 2) return;
        vehicleMap.set(norm, { id: v.id, assignedSiteId: v.assignedSiteId });
    });
    console.log(`Loaded ${allVehicles.length} vehicles from DB.`);

    let totalImported = 0;

    for (const block of importData) {
        const importSiteId = SITE_MAP[block.siteVal];
        if (!importSiteId) continue;

        const year = parseInt(block.year);
        const month = parseInt(block.month);

        console.log(`Processing ${block.siteName} (${year}-${month})...`);

        for (const row of block.rows) {
            let vehicleId = null;
            let targetSiteId = importSiteId; // Default to the site we are scraping from

            const normRow = row.vehicleInfo.replace(/[\s-]/g, '').toUpperCase();

            // Find Vehicle
            for (const [vPlate, vData] of vehicleMap.entries()) {
                if (normRow.includes(vPlate)) {
                    vehicleId = vData.id;

                    // [LOGIC CHANGE]
                    if (!vData.assignedSiteId) {
                        // 1. Vehicle has NO site -> Assign to this import site
                        // We update the DB and our local map to avoid repeated updates
                        console.log(`Assigning orphan vehicle ${vData.id} (${vPlate}) to site ${importSiteId}`);
                        await prisma.vehicle.update({
                            where: { id: vehicleId },
                            data: { assignedSiteId: importSiteId }
                        });
                        vData.assignedSiteId = importSiteId; // Update local map
                        targetSiteId = importSiteId;
                    } else {
                        // 2. Vehicle HAS site -> Use ITS assigned site (even if we scraped from another list - unlikely but keeps data consistent)
                        // Actually, if we scrape from Zile list but car belongs to Aydin, we want to log it to Aydin.
                        targetSiteId = vData.assignedSiteId;
                    }
                    break;
                }
            }

            if (!vehicleId) {
                continue;
            }

            const days = row.days;
            for (let i = 0; i < days.length; i++) {
                let cell = days[i].trim();
                if (!cell) continue;
                cell = cell.split('\n')[0].trim();
                if (cell === '-' || cell === '') continue;

                let mapped = STATUS_MAP[cell];

                if (!mapped) {
                    if (cell.includes('✔️')) mapped = STATUS_MAP['✔️'];
                    else if (cell.includes('🌓')) mapped = STATUS_MAP['🌓'];
                    else if (cell.includes('🛠️')) mapped = STATUS_MAP['🛠️'];
                    else if (cell.includes('⛔')) mapped = STATUS_MAP['⛔'];
                }

                if (!mapped) continue;

                const day = i + 1;
                const d = new Date(year, month - 1, day);
                d.setHours(12, 0, 0, 0);

                if (d.getMonth() !== month - 1) continue;

                // Use custom upsert logic
                // Check existing with correct targetSiteId
                const existing = await prisma.vehicleAttendance.findFirst({
                    where: {
                        vehicleId: vehicleId,
                        date: d
                    }
                });

                if (existing) {
                    await prisma.vehicleAttendance.update({
                        where: { id: existing.id },
                        data: {
                            status: mapped.status,
                            hours: mapped.hours,
                            siteId: targetSiteId, // Use the resolved site ID
                            note: 'Otomatik Import (Güncelleme)'
                        }
                    });
                } else {
                    await prisma.vehicleAttendance.create({
                        data: {
                            vehicleId: vehicleId,
                            siteId: targetSiteId, // Use the resolved site
                            date: d,
                            status: mapped.status,
                            hours: mapped.hours,
                            note: 'Otomatik Import'
                        }
                    });
                }
                totalImported++;
            }
        }
    }
    console.log(`Import Finished. Processed ${totalImported} records.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
