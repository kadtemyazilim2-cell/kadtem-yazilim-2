
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    // Paths provided by system
    const ikikatPath = 'C:/Users/Drone/.gemini/antigravity/brain/827496fa-c045-422e-afc6-734052e0735f/uploaded_image_0_1769065113107.png';
    const kenanPath = 'C:/Users/Drone/.gemini/antigravity/brain/827496fa-c045-422e-afc6-734052e0735f/uploaded_image_1_1769065113107.png';

    console.log('Reading image files...');

    // Check if files exist
    if (!fs.existsSync(ikikatPath)) {
        console.error('Ikikat image not found at:', ikikatPath);
        return;
    }
    if (!fs.existsSync(kenanPath)) {
        console.error('Kenan image not found at:', kenanPath);
        return;
    }

    const ikikatBuffer = fs.readFileSync(ikikatPath);
    const kenanBuffer = fs.readFileSync(kenanPath);

    const ikikatBase64 = `data:image/png;base64,${ikikatBuffer.toString('base64')}`;
    const kenanBase64 = `data:image/png;base64,${kenanBuffer.toString('base64')}`;

    console.log('Images converted to Base64.');
    console.log('Ikikat Length:', ikikatBase64.length);
    console.log('Kenan Length:', kenanBase64.length);

    console.log('Updating database...');

    // 1. Update IKIKAT LTD. STI. (Using rough name match)
    // "İKİKAT LTD. ŞTİ."
    const ikikatCompany = await prisma.company.findFirst({
        where: { name: { contains: 'İKİKAT', mode: 'insensitive' } }
    });

    // 2. Update KENAN TUGAY (Using rough name match)
    // "KENAN TUGAY İKİKAT"
    const kenanCompany = await prisma.company.findFirst({
        where: { name: { contains: 'KENAN', mode: 'insensitive' } }
    });

    if (ikikatCompany) {
        // Double check not to update Kenan if it contains Ikikat
        if (!ikikatCompany.name.includes('KENAN')) {
            await prisma.company.update({
                where: { id: ikikatCompany.id },
                data: { letterhead: ikikatBase64, logoUrl: null } // Clear logoUrl to force use of letterhead? Or used interchangeably.
            });
            console.log(`Updated ${ikikatCompany.name} with new logo.`);
        } else {
            console.log('Skipped Ikikat update because found company was actually Kenan:', ikikatCompany.name);
            // Try searching specifically for NOT Kenan?
            const realIkikat = await prisma.company.findFirst({
                where: {
                    name: { contains: 'İKİKAT' },
                    NOT: { name: { contains: 'KENAN' } }
                }
            });
            if (realIkikat) {
                await prisma.company.update({
                    where: { id: realIkikat.id },
                    data: { letterhead: ikikatBase64 }
                });
                console.log(`Updated Correct Ikikat (${realIkikat.name}) with new logo.`);
            }
        }
    } else {
        console.log('Could not find IKIKAT company.');
    }

    if (kenanCompany) {
        await prisma.company.update({
            where: { id: kenanCompany.id },
            data: { letterhead: kenanBase64, logoUrl: null }
        });
        console.log(`Updated ${kenanCompany.name} with new logo.`);
    } else {
        console.log('Could not find KENAN TUGAY company.');
    }

    console.log('Done.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
