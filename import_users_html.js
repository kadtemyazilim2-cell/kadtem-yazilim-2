const fs = require('fs');
// Handle cheerio import: 'cheerio' changed export style in v1.0. 
// Try standard require, if fails catch.
let cheerio;
try {
    cheerio = require('cheerio');
} catch (e) {
    console.error('Cheerio import failed:', e);
    process.exit(1);
}

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Starting user import...');

    // Path to the HTML file
    const htmlPath = 'C:\\Users\\Drone\\Desktop\\benzer iş grupları\\kullanıcı listesi\\kullanıcı listesi.html';

    if (!fs.existsSync(htmlPath)) {
        console.error(`File not found: ${htmlPath}`);
        process.exit(1);
    }

    const html = fs.readFileSync(htmlPath, 'utf8');
    const $ = cheerio.load(html);

    // Select the table rows
    // ID: ContentPlaceHolder1_gvKullanicilar
    const table = $('#ContentPlaceHolder1_gvKullanicilar');
    if (table.length === 0) {
        console.error('Table #ContentPlaceHolder1_gvKullanicilar not found in HTML');
        process.exit(1);
    }

    const rows = table.find('tr');
    console.log(`Found ${rows.length} rows (including header)`);

    let count = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = $(rows[i]);
        const cells = row.find('td');

        // Skip header rows (th)
        if (cells.length === 0) continue;

        // Column Mapping based on HTML inspection:
        // 0: # (Index)
        // 1: Kullanıcı Adı (username)
        // 2: Şifre (password)
        // 3: Yetki Türü (role)
        // 4: İşlem Noktası (ignored for now, or map to site?)
        // 5: Adı Soyadı (name)
        // 6: Puantaj Gün (editLookbackDays)
        // 7: Links
        // 8: Şantiye Button

        const username = $(cells[1]).text().trim();
        const password = $(cells[2]).text().trim();
        const roleText = $(cells[3]).text().trim();
        // const pointText = $(cells[4]).text().trim();
        const name = $(cells[5]).text().trim();
        const daysText = $(cells[6]).text().trim();

        if (!username) continue;

        // Map Role
        // Schema: ADMIN, MANAGER, SITE_MANAGER, USER
        let role = 'USER';
        if (roleText.includes('Yönetici')) {
            role = 'ADMIN';
        } else if (roleText.includes('Yakıt Personeli')) {
            // Mapping Yakıt Personeli to USER (or specific role if existed). Keeping USER for safety.
            role = 'USER';
        }

        const editLookbackDays = parseInt(daysText, 10) || 0;

        console.log(`Importing: ${username} (${role}), Lookback: ${editLookbackDays}`);

        try {
            await prisma.user.upsert({
                where: { username },
                update: {
                    name,
                    password, // Plain text as confirmed
                    role,
                    editLookbackDays,
                    status: 'ACTIVE'
                },
                create: {
                    username,
                    password,
                    name,
                    role,
                    editLookbackDays,
                    status: 'ACTIVE'
                }
            });
            count++;
        } catch (dbError) {
            console.error(`Error importing ${username}:`, dbError);
        }
    }

    console.log(`Successfully processed ${count} users.`);
}

main()
    .catch(e => {
        console.error('Script Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
