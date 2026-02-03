
import puppeteer from 'puppeteer';
import * as fs from 'fs';

const CONFIG = {
    url: 'https://ikikat.com.tr/AracPuantajRapor.aspx',
    creds: { user: 'ahmetcan', pass: 'canahmet' },
    targetYears: ['2025', '2026']
};

const SITES = [
    { val: '1', name: 'Aydin Nazilli Yenipazar' },
    { val: '2', name: 'Samsun Vezirkopru' },
    { val: '3', name: 'Tokat Zile' } // Assuming this maps to Zile 1
];

// Months to fetch: 2025 (8,9,10,11,12) and 2026 (1)
const TARGET_MONTHS: Record<string, number[]> = {
    '2025': [8, 9, 10, 11, 12],
    '2026': [1]
};

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
    console.log("Starting Targeted Scraping (2025/2026)...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    const allData: SiteMonthData[] = [];

    try {
        await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });

        // Login Check
        if (await page.$('input[name*="kullanici"]')) {
            await page.type('input[type="text"]', CONFIG.creds.user);
            await page.type('input[type="password"]', CONFIG.creds.pass);
            await Promise.all([page.click('input[type="submit"]'), page.waitForNavigation()]);
        } else {
            // If already logged in but session might be stale or wrong user? Assuming okay for now or logout if needed.
            // Usually safe to proceed if URL matches.
        }

        for (const year of CONFIG.targetYears) {
            console.log(`Switching to Year ${year}...`);
            await page.waitForSelector('select[name*="ddlYil"]', { timeout: 15000 });
            await page.select('select[name*="ddlYil"]', year);
            await new Promise(r => setTimeout(r, 2000));

            const months = TARGET_MONTHS[year];
            if (!months) continue;

            for (const site of SITES) {
                console.log(`  Processing Site ${site.name} (${year})...`);
                await page.select('select[name*="ddlSantiye"]', site.val);
                await new Promise(r => setTimeout(r, 1000));

                for (const m of months) {
                    const month = m.toString();
                    console.log(`    Month ${month}...`);

                    try {
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

                        const btnGetir = await page.$('input[name*="btnGetir"]');
                        if (btnGetir) {
                            await Promise.all([
                                btnGetir.click(),
                                new Promise(r => setTimeout(r, 4500)) // Wait for postback
                            ]);

                            // Extract
                            const pageData = await page.evaluate(() => {
                                const rows = Array.from(document.querySelectorAll('table tr'));
                                if (rows.length < 2) return [];

                                const parsedRows: any[] = [];
                                for (let i = 1; i < rows.length; i++) {
                                    const cells = Array.from(rows[i].querySelectorAll('td'));
                                    if (cells.length < 5) continue;

                                    const vehicleInfo = (cells[1] as HTMLElement).innerText.trim();
                                    if (!vehicleInfo) continue;

                                    // Days columns usually start at index 2
                                    // Check header to be sure? Assuming fixed structure as per previous script.
                                    const days = cells.slice(2, 33).map(c => (c as HTMLElement).innerText.trim());

                                    parsedRows.push({
                                        vehicleInfo,
                                        days
                                    });
                                }
                                return parsedRows;
                            });

                            if (pageData.length > 0) {
                                console.log(`      Found ${pageData.length} records.`);
                                allData.push({
                                    siteName: site.name,
                                    siteVal: site.val,
                                    year: year,
                                    month: month,
                                    rows: pageData
                                });

                                // Incremental Save
                                fs.writeFileSync('scraped_attendance.json', JSON.stringify(allData, null, 2));
                            } else {
                                console.log(`      No records found.`);
                            }
                        }
                    } catch (err) {
                        console.error(`Error processing ${site.name} ${year}/${month}:`, err);
                    }
                }
            }
        }

        console.log(`Scraping Completed. Total Batches: ${allData.length}`);

    } catch (e) {
        console.error("Global Scrape Error:", e);
    } finally {
        await browser.close();
    }
}

main();
