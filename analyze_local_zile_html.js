
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
    const htmlPath = 'C:\\Users\\Drone\\Desktop\\benzer iş grupları\\yakıt zile\\zile yakıt.html';

    console.log(`Reading local file: ${htmlPath}`);
    if (!fs.existsSync(htmlPath)) {
        console.error('File not found!');
        return;
    }

    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Parse HTML using Regex (assuming standard table structure)
    // Looking for patterns like: <td>01.01.2025</td>...<td>34 AB 123</td>...<td>100,50</td>
    // This is rough parsing. If structure is complex, might need more robust logic.
    // Based on previous tasks, these reports usually have Date, Plate, Amount in specific order.

    // Let's try to extract rows.
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
    let match;
    const localLogs = [];

    while ((match = rowRegex.exec(htmlContent)) !== null) {
        const rowContent = match[1];
        // Extract cells
        const cellRegex = /<td[^>]*>(.*?)<\/td>/gs;
        const cells = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            cells.push(cellMatch[1].trim().replace(/&nbsp;/g, ' '));
        }

        if (cells.length > 5) { // Assuming enough columns
            // Try to identify columns. Usually Date is early, Plate is middle, Liters is late.
            // Adjust indices based on typical report layout.
            // Example: No | Tarih | Fiş No | Plaka | ... | Miktar | ...

            // Let's search for date pattern in cells to anchor
            const dateIndex = cells.findIndex(c => /^\d{2}\.\d{2}\.\d{4}$/.test(c));
            if (dateIndex !== -1) {
                const dateStr = cells[dateIndex];

                // Plate usually follows date nearby
                // Let's look for "200.3" or "Hitachi" specifically as requested
                const plateIndex = cells.findIndex(c => c.toLowerCase().includes('200.3') || c.toLowerCase().includes('hitachi') || c.toLowerCase().includes('06 dgg 821')); // 2025 T plate might be relevant too

                if (plateIndex !== -1) {
                    const plate = cells[plateIndex];

                    // Amount is usually numeric with comma/dot
                    // Look for amount AFTER plate
                    // We need to be careful not to pick unit price or total cost.
                    // Usually Quantity is before Unit Price.
                    const amountCell = cells.slice(plateIndex + 1).find(c => /^[0-9]+([.,][0-9]+)?$/.test(c.replace(',', '.')));

                    if (amountCell) {
                        const amount = parseFloat(amountCell.replace(',', '.')); // Assuming TR format 1.000,50 or 100,50

                        localLogs.push({
                            date: dateStr,
                            plate: plate,
                            rawAmount: amountCell,
                            amount: amount
                        });
                    }
                }
            }
        }
    }

    console.log(`\nFound ${localLogs.length} matching rows in local HTML for '200.3'/'Hitachi'.`);
    const totalLocal = localLogs.reduce((sum, l) => sum + l.amount, 0);
    console.log(`Total Amount in Local File: ${totalLocal.toFixed(2)}`);

    // Group by Date to find duplicates in local file itself?
    // User says "processed twice".

    console.log('\n--- DB COMPARISON ---');
    // Search DB for these vehicles
    // User mentioned merging "Fiat Hitachi 200.3"
    // I need to find which vehicle ID represents this now.
    // I'll search for logs with these amounts and dates.

    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { plate: { contains: '200.3' } },
                { plate: { contains: 'Hitachi' } },
                { model: { contains: '200.3' } },
                { definition: { contains: 'Hitachi' } }
            ]
        }
    });

    console.log('Target Vehicles in DB:', vehicles.map(v => `${v.plate} (${v.id})`));
    const vehicleIds = vehicles.map(v => v.id);

    // Also include '06 DGG 821' (2025 T) if it was the merge target
    const targetVehicle = await prisma.vehicle.findFirst({ where: { plate: { contains: '06 DGG 821' } } });
    if (targetVehicle) {
        console.log(`Checking Merge Target: ${targetVehicle.plate} (${targetVehicle.id})`);
        vehicleIds.push(targetVehicle.id);
    }

    const dbLogs = await prisma.fuelLog.findMany({
        where: {
            vehicleId: { in: vehicleIds }
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Found ${dbLogs.length} logs in DB for these vehicles.`);
    const totalDB = dbLogs.reduce((sum, l) => sum + l.liters, 0);
    console.log(`Total Amount in DB: ${totalDB.toFixed(2)}`);
    console.log(`Difference (DB - Local): ${(totalDB - totalLocal).toFixed(2)}`);

    // Check for Duplicates in DB
    console.log('\n--- DUPLICATE CHECK IN DB ---');
    const seen = new Set();
    const duplicates = [];

    dbLogs.forEach(log => {
        const key = `${log.date.toISOString().split('T')[0]}_${log.liters}_${log.vehicleId}`;
        if (seen.has(key)) {
            duplicates.push(log);
        } else {
            seen.add(key);
        }
    });

    if (duplicates.length > 0) {
        console.log(`⚠️ FOUND ${duplicates.length} DUPLICATE LOGS IN DB!`);
        duplicates.forEach(d => {
            console.log(`Duplicate: ${d.date.toISOString().split('T')[0]} - ${d.liters}L (ID: ${d.id})`);
        });

        console.log(`Total Duplicate Amount: ${duplicates.reduce((sum, d) => sum + d.liters, 0).toFixed(2)}`);
    } else {
        console.log('No exact duplicates (Same Date, Same Amount, Same Vehicle) found in DB.');
    }

    // Check if maybe we have logs from "Fiat Hitachi" AND "2025 T" on the SAME day with SAME amount?
    // This happens if merge wasn't a true merge but a copy.
    console.log('\n--- CROSS-VEHICLE DUPLICATE CHECK ---');
    const logsByDateAmount = {};
    dbLogs.forEach(log => {
        const key = `${log.date.toISOString().split('T')[0]}_${log.liters}`;
        if (!logsByDateAmount[key]) logsByDateAmount[key] = [];
        logsByDateAmount[key].push(log);
    });

    Object.keys(logsByDateAmount).forEach(key => {
        const group = logsByDateAmount[key];
        if (group.length > 1) {
            const plates = group.map(l => {
                const v = vehicles.find(veh => veh.id === l.vehicleId) || (targetVehicle && targetVehicle.id === l.vehicleId ? targetVehicle : { plate: 'Unknown' });
                return v.plate;
            });
            console.log(`Potential Match: ${key} -> Count: ${group.length} [${plates.join(', ')}]`);
        }
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
