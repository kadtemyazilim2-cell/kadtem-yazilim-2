
import puppeteer from 'puppeteer';
import * as fs from 'fs';

const CONFIG = {
    // Target page
    url: 'https://ikikat.com.tr/AracPuantaj.aspx',
    creds: { user: 'ahmetcan', pass: 'canahmet' },
    targetYears: ['2025', '2026'] // Full Range
};

const SITES = [
    { val: '1', name: 'Aydin Nazilli Yenipazar' },
    { val: '2', name: 'Samsun Vezirkopru' },
    { val: '3', name: 'Tokat Zile' }
];

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
    console.log("Starting Bulk Scraping (Aug 2025 - Jan 2026)...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // Enable console logging from browser
    page.on('console', msg => {
        if (msg.type() === 'error') return; // Ignore errors to reduce noise
        // console.log('[BROWSER log]:', msg.text())
    });

    const allData: SiteMonthData[] = [];

    try {
        // 1. Discovery & Login
        console.log("Navigating to Root for Discovery...");
        await page.goto('https://ikikat.com.tr/', { waitUntil: 'networkidle2' });

        let loginInputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ name: i.name, type: i.type })));

        if (!loginInputs.some(i => i.type === 'password')) {
            console.log("Login inputs NOT found. Trying /Giris.aspx...");
            await page.goto('https://ikikat.com.tr/Giris.aspx', { waitUntil: 'networkidle2' });
            loginInputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ name: i.name, type: i.type })));
        }

        const passInput = loginInputs.find(i => i.type === 'password');
        const userInput = loginInputs.find(i => i.name.toLowerCase().includes('kullanici')) || loginInputs.find(i => i.type === 'text');

        if (passInput) {
            console.log('[DEBUG] Login Page Detected. Logging in...');
            if (userInput) {
                await page.type(`input[name="${userInput.name}"]`, CONFIG.creds.user);
            } else {
                await page.type('input[type="text"]', CONFIG.creds.user);
            }

            await page.type(`input[name="${passInput.name}"]`, CONFIG.creds.pass);

            await Promise.all([
                page.click('input[type="submit"]'),
                page.waitForNavigation()
            ]);
            console.log("Logged In.");
        }

        // 2. Navigate to Target
        await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });
        console.log(`[DEBUG] Target URL: ${await page.url()}`);

        if (!await page.$('select[name*="ddlYil"]')) {
            console.log('[CRITICAL] Year dropdown NOT found. Aborting.');
            return;
        }

        // 3. Process Loops
        for (const targetYear of CONFIG.targetYears) {
            console.log(`Switching to Year ${targetYear}...`);

            try {
                await page.waitForSelector('select[name*="ddlYil"]', { timeout: 10000 });
                await page.select('select[name*="ddlYil"]', targetYear);
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                console.error(`[CRITICAL] Failed to select Year ${targetYear}. Skipping.`);
                continue;
            }

            const months = TARGET_MONTHS[targetYear];
            if (!months) continue;

            for (const site of SITES) {
                console.log(`  Processing Site ${site.name} (${targetYear})...`);
                await page.select('select[name*="ddlSantiye"]', site.val);
                await new Promise(r => setTimeout(r, 1000));

                for (const m of months) {
                    const month = m.toString();
                    console.log(`    Month ${month}...`);

                    try {
                        await page.select('select[name*="ddlAy"]', month);
                        await new Promise(r => setTimeout(r, 1000));

                        // Uncheck "Sadece Yakıt"
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
                                new Promise(r => setTimeout(r, 5000))
                            ]);

                            // Extract
                            const pageData = await page.evaluate(() => {
                                const rows = Array.from(document.querySelectorAll('table#ContentPlaceHolder1_grdAracPuantaj tr'));
                                const fallbackRows = Array.from(document.querySelectorAll('table tr'));
                                const actualRows = rows.length > 1 ? rows : fallbackRows;

                                if (actualRows.length < 2) return [];

                                const parsedRows: any[] = [];

                                for (let i = 1; i < actualRows.length; i++) {
                                    const cells = Array.from(actualRows[i].querySelectorAll('td'));
                                    if (cells.length < 5) continue;

                                    const vehicleInfo = (cells[1] as HTMLElement).innerText.trim();
                                    if (!vehicleInfo) continue;

                                    const days = cells.slice(2, 33).map(c => {
                                        const img = c.querySelector('img');
                                        if (img) {
                                            const src = img.src.toLowerCase();
                                            if (src.includes('ok.png') || src.includes('tam') || src.includes('tick')) return 'WORK';
                                            if (src.includes('delete') || src.includes('cross') || src.includes('calismadi') || src.includes('cancel')) return 'ABSENT';
                                            if (src.includes('yarim') || src.includes('half')) return 'HALF';
                                            if (src.includes('ariza') || src.includes('repair') || src.includes('wrench')) return 'REPAIR';
                                            return 'UNKNOWN_IMG_' + src;
                                        }
                                        return (c as HTMLElement).innerText.trim();
                                    });

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
                                    year: targetYear,
                                    month: month,
                                    rows: pageData
                                });
                                // Save Individual Month File (Safety)
                                const safeSiteName = site.name.replace(/\s+/g, '_');
                                fs.writeFileSync(`scraped_attendance_${targetYear}_${month}_${safeSiteName}.json`, JSON.stringify(allData[allData.length - 1], null, 2));
                            } else {
                                console.log(`      No records found.`);
                            }
                        }
                    } catch (err) {
                        console.error(`Error processing ${site.name} ${targetYear}/${month}:`, err);
                    }
                }
            }
        }

        console.log(`Scraping Completed. Total Batches: ${allData.length}`);
        fs.writeFileSync('scraped_attendance_FULL_6_MONTHS.json', JSON.stringify(allData, null, 2));

    } catch (e) {
        console.error("Global Scrape Error:", e);
    } finally {
        await browser.close();
    }
}
main();
