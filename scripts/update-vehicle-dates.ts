
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const scrapedData = [
    { "plate": "06 BC 0679", "insuranceExpiry": "24.06.2026", "kaskoExpiry": "", "inspectionExpiry": "16.02.2026" },
    { "plate": "06 FF 3260", "insuranceExpiry": "08.08.2026", "kaskoExpiry": "", "inspectionExpiry": "06.04.2026" },
    { "plate": "06-00-10-1096", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "34 GF 3763", "insuranceExpiry": "08.02.2026", "kaskoExpiry": "", "inspectionExpiry": "22.01.2026" },
    { "plate": "34-00-11-6911", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "34-00-15-13879", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "34-00-24-2834", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "34-00-24-5563", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "34-00-24-7675", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "34-00-2556", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "35 GA 8108", "insuranceExpiry": "10.10.2026", "kaskoExpiry": "", "inspectionExpiry": "22.03.2026" },
    { "plate": "60 AAG 486", "insuranceExpiry": "13.09.2026", "kaskoExpiry": "", "inspectionExpiry": "22.01.2026" },
    { "plate": "60 AAG 665", "insuranceExpiry": "18.05.2026", "kaskoExpiry": "", "inspectionExpiry": "12.12.2026" },
    { "plate": "60 ACE 788", "insuranceExpiry": "23.02.2026", "kaskoExpiry": "", "inspectionExpiry": "18.01.2026" },
    { "plate": "60 ACG 379", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "22.01.2026" },
    { "plate": "60 ACN 701", "insuranceExpiry": "31.08.2026", "kaskoExpiry": "01.09.2026", "inspectionExpiry": "01.07.2026" },
    { "plate": "60 ACN 715", "insuranceExpiry": "31.08.2026", "kaskoExpiry": "02.09.2026", "inspectionExpiry": "17.04.2026" },
    { "plate": "60 ADG 565", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "60 ADG 721", "insuranceExpiry": "23.09.2026", "kaskoExpiry": "", "inspectionExpiry": "13.06.2027" },
    { "plate": "60 ADR 790", "insuranceExpiry": "15.11.2026", "kaskoExpiry": "15.11.2026", "inspectionExpiry": "02.07.2027" },
    { "plate": "60 ADU 194", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "14.11.2027" },
    { "plate": "60 AER 689", "insuranceExpiry": "30.08.2026", "kaskoExpiry": "", "inspectionExpiry": "28.08.2026" },
    { "plate": "60 AES 028", "insuranceExpiry": "22.09.2026", "kaskoExpiry": "", "inspectionExpiry": "19.06.2028" },
    { "plate": "60 AEU 736", "insuranceExpiry": "12.10.2026", "kaskoExpiry": "", "inspectionExpiry": "08.06.2026" },
    { "plate": "60 AEV 731", "insuranceExpiry": "18.07.2026", "kaskoExpiry": "", "inspectionExpiry": "24.08.2026" },
    { "plate": "60 AEY 683", "insuranceExpiry": "13.11.2026", "kaskoExpiry": "13.11.2026", "inspectionExpiry": "17.10.2026" },
    { "plate": "60 AFA 401", "insuranceExpiry": "12.12.2026", "kaskoExpiry": "22.12.2026", "inspectionExpiry": "21.11.2026" },
    { "plate": "60 AGN 891", "insuranceExpiry": "11.03.2026", "kaskoExpiry": "", "inspectionExpiry": "22.02.2027" },
    { "plate": "60 AHH 726", "insuranceExpiry": "04.10.2026", "kaskoExpiry": "", "inspectionExpiry": "13.09.2027" },
    { "plate": "60 AHS 837", "insuranceExpiry": "12.12.2026", "kaskoExpiry": "", "inspectionExpiry": "04.08.2027" },
    { "plate": "60 AJ 465", "insuranceExpiry": "12.08.2026", "kaskoExpiry": "", "inspectionExpiry": "18.01.2026" },
    { "plate": "60 BC 866", "insuranceExpiry": "04.08.2026", "kaskoExpiry": "", "inspectionExpiry": "22.01.2026" },
    { "plate": "60 BD 067", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "22.01.2026" },
    { "plate": "60 BP 164", "insuranceExpiry": "01.08.2026", "kaskoExpiry": "", "inspectionExpiry": "01.07.2026" },
    { "plate": "60 BP 842", "insuranceExpiry": "16.01.2027", "kaskoExpiry": "01.08.2026", "inspectionExpiry": "20.01.2026" },
    { "plate": "60 BP 843", "insuranceExpiry": "16.01.2027", "kaskoExpiry": "01.08.2026", "inspectionExpiry": "20.01.2026" },
    { "plate": "60 BP 844", "insuranceExpiry": "16.01.2027", "kaskoExpiry": "01.08.2026", "inspectionExpiry": "20.01.2026" },
    { "plate": "60 BP 933", "insuranceExpiry": "16.06.2026", "kaskoExpiry": "24.08.2026", "inspectionExpiry": "18.01.2026" },
    { "plate": "60 BP 934", "insuranceExpiry": "16.06.2026", "kaskoExpiry": "24.08.2026", "inspectionExpiry": "20.01.2026" },
    { "plate": "60 DB 904", "insuranceExpiry": "25.12.2026", "kaskoExpiry": "", "inspectionExpiry": "29.12.2028" },
    { "plate": "60 EC 562", "insuranceExpiry": "06.03.2026", "kaskoExpiry": "", "inspectionExpiry": "01.12.2027" },
    { "plate": "60 ES 785", "insuranceExpiry": "30.07.2026", "kaskoExpiry": "21.08.2026", "inspectionExpiry": "17.02.2027" },
    { "plate": "60 HE 380", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "60 HF 131", "insuranceExpiry": "29.09.2026", "kaskoExpiry": "", "inspectionExpiry": "02.03.2026" },
    { "plate": "60 HN 450", "insuranceExpiry": "08.05.2026", "kaskoExpiry": "", "inspectionExpiry": "19.10.2026" },
    { "plate": "60 HN 887", "insuranceExpiry": "22.02.2026", "kaskoExpiry": "", "inspectionExpiry": "05.08.2026" },
    { "plate": "60 HP 953", "insuranceExpiry": "02.06.2026", "kaskoExpiry": "", "inspectionExpiry": "18.01.2027" },
    { "plate": "60-00-10-0011", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "60-04-07-008", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" },
    { "plate": "61-00-16-0054", "insuranceExpiry": "", "kaskoExpiry": "", "inspectionExpiry": "" }
];

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
}

async function main() {
    console.log('Starting vehicle date update...');
    let updatedCount = 0;
    let notFoundCount = 0;

    for (const item of scrapedData) {
        // Normalize plate: Remove spaces for comparison if needed, or assume exact match.
        // The scraping returned spaces (e.g., "06 BC 0679"). The DB 'plate' field format should be checked.
        // Assuming the DB stores plates with or without spaces, let's try to match flexible.
        // But for now, let's try exact match first.

        const vehicle = await prisma.vehicle.findFirst({
            where: {
                plate: item.plate
            }
        });

        if (vehicle) {
            const updates: any = {};

            const insuranceDate = parseDate(item.insuranceExpiry);
            if (insuranceDate) updates.insuranceExpiry = insuranceDate;

            const kaskoDate = parseDate(item.kaskoExpiry);
            if (kaskoDate) updates.kaskoExpiry = kaskoDate;

            const inspectionDate = parseDate(item.inspectionExpiry);
            // Inspection expiry is mapped to 'inspectionExpiry' field in DB?
            // Checking schema from memory/views: yes, `inspectionExpiry`.
            if (inspectionDate) updates.inspectionExpiry = inspectionDate;

            if (Object.keys(updates).length > 0) {
                await prisma.vehicle.update({
                    where: { id: vehicle.id },
                    data: updates
                });
                console.log(`Updated ${item.plate}: ${JSON.stringify(updates)}`);
                updatedCount++;
            } else {
                console.log(`No updates for ${item.plate}`);
            }
        } else {
            console.log(`Vehicle not found: ${item.plate}`);
            // Try removing spaces
            const compactPlate = item.plate.replace(/\s/g, '');
            const vehicleCompact = await prisma.vehicle.findFirst({
                where: { plate: compactPlate }
            });

            if (vehicleCompact) {
                const updates: any = {};
                const insuranceDate = parseDate(item.insuranceExpiry);
                if (insuranceDate) updates.insuranceExpiry = insuranceDate;

                const kaskoDate = parseDate(item.kaskoExpiry);
                if (kaskoDate) updates.kaskoExpiry = kaskoDate;

                const inspectionDate = parseDate(item.inspectionExpiry);
                if (inspectionDate) updates.inspectionExpiry = inspectionDate;

                if (Object.keys(updates).length > 0) {
                    await prisma.vehicle.update({
                        where: { id: vehicleCompact.id },
                        data: updates
                    });
                    console.log(`Updated ${compactPlate} (compact match): ${JSON.stringify(updates)}`);
                    updatedCount++;
                }
            } else {
                notFoundCount++;
            }
        }
    }

    console.log(`Finished. Updated: ${updatedCount}, Not Found: ${notFoundCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
