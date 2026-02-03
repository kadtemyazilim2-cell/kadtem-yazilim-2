
import puppeteer from 'puppeteer';
import * as fs from 'fs';

const CONFIG = {
    url: 'https://ikikat.com.tr/AracPuantaj.aspx',
    creds: { user: 'ahmetcan', pass: 'canahmet' },
    targetYears: ['2025', '2026']
};

// Target keywords to identify correct option values
const SITE_KEYWORDS = ['Nazilli', 'Vezir', 'Zile'];

const TARGET_MONTHS: Record<string, number[]> = {
    '2025': [8, 9, 10, 11, 12],
    '2026': [1]
};

async function main() {
    console.log("Starting ROBUST Discovery Scraper (Site -> Year -> Month)...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    const allData: any[] = [];

    try {
        // 1. Login
        console.log("Logging in...");
        await page.goto('https://ikikat.com.tr/Giris.aspx', { waitUntil: 'networkidle2' });

        const userSel = 'input[name="txtKullaniciAdi"]';
        const passSel = 'input[name="txtSifre"]';

        if (await page.$(userSel)) {
            await page.type(userSel, CONFIG.creds.user);
            await page.type(passSel, CONFIG.creds.pass);
        } else {
            await page.type('input[type="text"]', CONFIG.creds.user);
            await page.type('input[type="password"]', CONFIG.creds.pass);
        }

        await Promise.all([
            page.click('input[type="submit"]'),
            page.waitForNavigation()
        ]);
        console.log("Logged In.");

        // 2. Go to Attendance Page
        await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });

        // 3. Discover Sites Dynamically
        console.log("Reading Site Dropdown...");
        const siteOptions = await page.evaluate(() => {
            const sel = document.querySelector('select[name*="ddlSantiye"]');
            if (!sel) return [];
            return Array.from(sel.querySelectorAll('option')).map(opt => ({
                val: (opt as HTMLOptionElement).value, // explicit casting
                text: (opt as HTMLElement).innerText.trim()
            })).filter(o => o.val !== '0' && o.val !== '');
        });

        console.log("Found Sites:", siteOptions);

        const targetSites = siteOptions.filter(s => SITE_KEYWORDS.some(k => s.text.includes(k)));
        console.log("Targeting Sites:", targetSites);

        // 4. Iterate: SITE -> YEAR -> MONTH
        // This prevents Year selection from being wiped by Site selection postback
        for (const site of targetSites) {
            console.log(`\n=== SITE: ${site.text} (${site.val}) ===`);

            // Select Site
            await page.select('select[name*="ddlSantiye"]', site.val);
            await new Promise(r => setTimeout(r, 2000)); // Wait for postback

            for (const year of CONFIG.targetYears) {
                console.log(`  > Year ${year}`);

                // Select Year (Explicitly re-select for every site)
                await page.select('select[name*="ddlYil"]', year);
                await new Promise(r => setTimeout(r, 2000)); // Wait for postback

                const months = TARGET_MONTHS[year];
                if (!months) continue;

                for (const m of months) {
                    const month = m.toString();
                    process.stdout.write(`    Month ${month}: `);

                    try {
                        // Select Month
                        await page.select('select[name*="ddlAy"]', month);
                        await new Promise(r => setTimeout(r, 1000));

                        // Uncheck "Sadece Yakıt" if checked
                        const chk = await page.$('input[name*="chkSadeceYakit"]');
                        if (chk) {
                            const isChecked = await (await chk.getProperty('checked')).jsonValue();
                            if (isChecked) {
                                await chk.click();
                                await new Promise(r => setTimeout(r, 500));
                            }
                        }

                        // Click Listele/Getir
                        const btn = await page.$('input[name*="btnGetir"]');
                        if (btn) {
                            await Promise.all([
                                btn.click(),
                                new Promise(r => setTimeout(r, 4000))
                            ]);

                            // Scrape with Fallback
                            const pageData = await page.evaluate(() => {
                                // Try specific ID first, then generic table
                                const specificTable = document.querySelector('table#ContentPlaceHolder1_grdAracPuantaj');
                                const allTables = Array.from(document.querySelectorAll('table'));
                                // Find the table with most rows or specifically looking like data
                                const table = specificTable || allTables.find(t => t.rows.length > 5) || allTables[0];

                                if (!table) return [];

                                const rows = Array.from(table.querySelectorAll('tr'));
                                const actualRows = rows.length > 1 ? rows.slice(1) : []; // Skip header
                                const parsed: { vehicleInfo: string, days: string[] }[] = [];

                                for (const row of actualRows) {
                                    const cells = Array.from(row.querySelectorAll('td'));
                                    if (cells.length < 5) continue;

                                    const vehicleInfo = cells[1].innerText.trim();
                                    const days = cells.slice(2, 33).map(c => {
                                        const img = c.querySelector('img');
                                        if (img) {
                                            const src = img.src.toLowerCase();
                                            if (src.includes('ok')) return 'WORK';
                                            if (src.includes('delete') || src.includes('cross')) return 'ABSENT';
                                            if (src.includes('half') || src.includes('yarim')) return 'HALF';
                                            if (src.includes('repair') || src.includes('wrench')) return 'REPAIR';
                                            return 'UNKNOWN';
                                        }
                                        return c.innerText.trim();
                                    });
                                    parsed.push({ vehicleInfo, days });
                                }
                                return parsed;
                            });

                            process.stdout.write(`${pageData.length} records found.\n`);

                            if (pageData.length > 0) {
                                allData.push({
                                    siteName: site.text,
                                    siteVal: site.val,
                                    year,
                                    month,
                                    rows: pageData
                                });
                            } else {
                                // DEBUG: Why 0?
                                const text = await page.evaluate(() => document.body.innerText.substring(0, 500).replace(/\n/g, ' '));
                                process.stdout.write(`    [DEBUG] Page Text: ${text}\n`);
                            }
                        } else {
                            process.stdout.write(`Button not found.\n`);
                        }
                    } catch (e) {
                        process.stdout.write(`Error: ${e}\n`);
                    }
                }
            }
        }

        console.log(`\nDONE. Total Batches: ${allData.length}`);
        fs.writeFileSync('scraped_attendance_REVISIT.json', JSON.stringify(allData, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
main();
