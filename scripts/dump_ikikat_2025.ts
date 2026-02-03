
import puppeteer from 'puppeteer';
import * as fs from 'fs';

const CONFIG = {
    url: 'https://ikikat.com.tr/AracPuantajRapor.aspx',
    creds: { user: 'ahmetcan', pass: 'canahmet' },
    targetYear: '2025'
};

const SITES = [
    { val: '1', name: 'Aydin Nazilli Yenipazar' },
    { val: '2', name: 'Samsun Vezirkopru' },
    { val: '3', name: 'Tokat Zile' },
    { val: '4', name: 'Doganli Ciftligi' }
];

interface ExtractedRow {
    vehicleInfo: string;
    days: string[]; // 1-31
}

interface SiteMonthData {
    siteName: string;
    siteVal: string;
    year: string;
    month: string; // 1-12
    rows: ExtractedRow[];
}

async function main() {
    console.log("Starting Dump 2025 (Final)...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    const allData: SiteMonthData[] = [];

    try {
        await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });

        // Login
        if (await page.$('input[name*="kullanici"]')) {
            await page.type('input[type="text"]', CONFIG.creds.user);
            await page.type('input[type="password"]', CONFIG.creds.pass);
            await Promise.all([page.click('input[type="submit"]'), page.waitForNavigation()]);
            if (page.url() !== CONFIG.url) await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });
        } else {
            const title = await page.title();
            if (title.toLowerCase().includes('yetkin yok')) {
                const logout = await page.$('#btnLogout');
                if (logout) {
                    await Promise.all([logout.click(), page.waitForNavigation()]);
                    await page.type('input[type="text"]', CONFIG.creds.user);
                    await page.type('input[type="password"]', CONFIG.creds.pass);
                    await Promise.all([page.click('input[type="submit"]'), page.waitForNavigation()]);
                    await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });
                }
            }
        }

        await page.waitForSelector('select[name*="ddlYil"]', { timeout: 15000 });
        await page.select('select[name*="ddlYil"]', CONFIG.targetYear);
        await new Promise(r => setTimeout(r, 2000));

        for (const site of SITES) {
            console.log(`Processing Site ${site.name}...`);
            await page.select('select[name*="ddlSantiye"]', site.val);
            await new Promise(r => setTimeout(r, 1000));

            for (let m = 1; m <= 12; m++) {
                const month = m.toString();
                try {
                    await page.select('select[name*="ddlAy"]', month);
                    await new Promise(r => setTimeout(r, 1000));

                    // ENSURE UNCHECKED (Check every time)
                    const chk = await page.$('input[name*="chkSadeceYakit"]');
                    if (chk) {
                        const isChecked = await (await chk.getProperty('checked')).jsonValue();
                        if (isChecked) {
                            await chk.click();
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }

                    const btnGetir = await page.$('input[name*="btnGetir"]');
                    if (btnGetir) {
                        await Promise.all([
                            btnGetir.click(),
                            new Promise(r => setTimeout(r, 4500)) // Generous wait
                        ]);

                        // Extract Data
                        const pageData = await page.evaluate(() => {
                            const rows = Array.from(document.querySelectorAll('table tr'));
                            if (rows.length < 2) return [];

                            const parsedRows: any[] = [];
                            for (let i = 1; i < rows.length; i++) {
                                const cells = Array.from(rows[i].querySelectorAll('td'));
                                if (cells.length < 5) continue;

                                const vehicleInfo = (cells[1] as HTMLElement).innerText.trim();
                                if (!vehicleInfo) continue;

                                const days = cells.slice(2, 33).map(c => (c as HTMLElement).innerText.trim());

                                parsedRows.push({
                                    vehicleInfo,
                                    days
                                });
                            }
                            return parsedRows;
                        });

                        if (pageData.length > 0) {
                            console.log(`  Month ${month}: Found ${pageData.length} records.`);
                            allData.push({
                                siteName: site.name,
                                siteVal: site.val,
                                year: CONFIG.targetYear,
                                month: month,
                                rows: pageData
                            });

                            // INCREMENTAL SAVE
                            fs.writeFileSync('ikikat_2025_data.json', JSON.stringify(allData, null, 2));
                        }
                    }
                } catch (err) {
                    console.error(`Error processing Site ${site.name} Month ${month}:`, err);
                    // Try to recover context if possible?
                    try {
                        await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });
                        // Restore state? Hard. Just skip to next month/site might fail if on wrong page.
                        // Ideally re-select year/site.
                        await page.select('select[name*="ddlYil"]', CONFIG.targetYear);
                        await page.select('select[name*="ddlSantiye"]', site.val);
                    } catch (e2) { console.error("Recovery failed:", e2); }
                }
            }
        }

        console.log(`Extraction Complete. Final count: ${allData.length} month-blocks.`);

    } catch (e) {
        console.error("Global Error:", e);
    } finally {
        await browser.close();
    }
}
main();
