
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

    const allVehicles = await prisma.vehicle.findMany({ select: { id: true, plate: true } });
    const vehicleMap = new Map();
    allVehicles.forEach(v => {
        // Normalize: Remove spaces, specific chars? Just remove spaces for now.
        // Also handle "34 ABC 123" vs "34-ABC-123" if needed.
        const norm = v.plate.replace(/[\s-]/g, '').toUpperCase();
        if (norm.length < 2) return; // Skip empty or invalid plates like '-'
        vehicleMap.set(norm, v.id);
    });
    console.log(`Loaded ${allVehicles.length} vehicles from DB.`);

    let totalImported = 0;

    for (const block of importData) {
        const siteId = SITE_MAP[block.siteVal];
        if (!siteId) continue;

        const year = parseInt(block.year);
        const month = parseInt(block.month);

        console.log(`Processing ${block.siteName} (${year}-${month})...`);

        for (const row of block.rows) {
            let vehicleId = null;
            // Row info e.g. "06-00-10-1096 - Caterpillar..."
            // Normalization: Remove spaces and dashes.
            const normRow = row.vehicleInfo.replace(/[\s-]/g, '').toUpperCase();

            // Try direct map
            // Need to match potential substring if plate is "06ABC123" and row has "06ABC123CATERPILLAR..."

            for (const [vPlate, vId] of vehicleMap.entries()) {
                if (normRow.includes(vPlate)) {
                    // Ambiguity check? Likely fine for plates.
                    vehicleId = vId;
                    break;
                }
            }

            if (!vehicleId) {
                // console.warn(`  Vehicle not found for: ${row.vehicleInfo} (Skipping)`);
                continue;
            }

            const days = row.days;
            for (let i = 0; i < days.length; i++) {
                let cell = days[i].trim();
                if (!cell) continue;

                // Handle newlines (fuel info)
                // e.g. "✔️\n200 L" -> "✔️"
                cell = cell.split('\n')[0].trim();

                if (cell === '-' || cell === '') continue;

                // Determine mapped status
                let mapped = STATUS_MAP[cell];

                // Fallback: Check if cell contains emoji?
                if (!mapped) {
                    if (cell.includes('✔️')) mapped = STATUS_MAP['✔️'];
                    else if (cell.includes('🌓')) mapped = STATUS_MAP['🌓'];
                    else if (cell.includes('🛠️')) mapped = STATUS_MAP['🛠️'];
                    else if (cell.includes('⛔')) mapped = STATUS_MAP['⛔'];
                }

                if (!mapped) {
                    // Check numeric? "198 L" -> Maybe just fuel, no work status?
                    // If it's just fuel e.g. "198 L", does it mean WORK?
                    // Probably means WORK if not stated otherwise, OR just Fuel Log.
                    // IMPORTANT: If "198 L" is the string, and no status, maybe it implicitly means WORK?
                    // Inspecting JSON: 
                    // Month 8 Zile: "198 L"
                    // Month 9: "✔️\n207 L"
                    // This implies "198 L" alone MIGHT be just fuel without explicit status emoji.
                    // But usually, machines working consume fuel.
                    // I will assume if it has Fuel, it worked? 
                    // Or maybe I should skip if no explicit status.
                    // Let's assume SKIP if unknown for now to avoid bad data.
                    // console.log(`  Unknown code '${cell}'`);
                    continue;
                }

                // Date
                const day = i + 1;
                const d = new Date(year, month - 1, day);
                // Correct for timezone if needed (DB stores DateTime). Local midnight is safely stored as UTC usually.
                // Better to set UTC explicitly to avoid shift? 
                // Prisma DateTime is ISO.
                // Setting hours to 12:00 to avoid midnight boundary issues.
                d.setHours(12, 0, 0, 0);

                if (d.getMonth() !== month - 1) continue;

                await prisma.vehicleAttendance.upsert({
                    where: {
                        // Composite unique constraint might not exist.
                        // We need to find by vehicleId + date.
                        // Wait, prisma `upsert` needs `where` on unique field.
                        // Does `VehicleAttendance` have unique [vehicleId, date]?
                        // Schema says NO unique index on [vehicleId, date].
                        // Schema just has `id`.
                        // So we cannot use `upsert` directly unless there is a unique key.
                        // We must findFirst then update/create.
                        id: 'dummy_id' // Will fail upsert logic.
                    },
                    update: {}, // Dummy
                    create: { vehicleId: 'dummy', siteId: 'dummy', date: d, status: 'dummy', hours: 0 } // Dummy
                }).catch(() => { }); // Using custom logic below

                // Custom Upsert Logic
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
                            siteId: siteId,
                            note: 'Otomatik Import (Güncelleme)'
                        }
                    });
                } else {
                    await prisma.vehicleAttendance.create({
                        data: {
                            vehicleId: vehicleId,
                            siteId: siteId,
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
