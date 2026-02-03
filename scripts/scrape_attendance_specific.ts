
import puppeteer from 'puppeteer';
import * as fs from 'fs';

const CONFIG = {
    // Target page
    url: 'https://ikikat.com.tr/AracPuantaj.aspx',
    creds: { user: 'ahmetcan', pass: 'canahmet' },
    targetYears: ['2026'] // Targeted
};

const SITES = [
    { val: '1', name: 'Aydin Nazilli Yenipazar' },
    { val: '2', name: 'Samsun Vezirkopru' },
    { val: '3', name: 'Tokat Zile' }
];

const TARGET_MONTHS: Record<string, number[]> = {
    '2026': [1] // Jan
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
    console.log("Starting Targeted Scraping...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // Enable console logging from browser
    page.on('console', msg => console.log('[BROWSER log]:', msg.text()));

    const allData: SiteMonthData[] = [];

    try {
        // 1. Discovery & Login
        console.log("Navigating to Root for Discovery...");
        await page.goto('https://ikikat.com.tr/', { waitUntil: 'networkidle2' });
        console.log(`[DEBUG] Root Redirected to: ${await page.url()}`);

        let loginInputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ name: i.name, type: i.type })));

        // If no inputs at root/redirect, try /Giris.aspx
        if (!loginInputs.some(i => i.type === 'password')) {
            console.log("Login inputs NOT found at detected URL. Trying /Giris.aspx...");
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
        }

        // 2. Navigate to Target
        await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });
        console.log(`[DEBUG] Target URL: ${await page.url()}`);

        if (await page.$('select[name*="ddlYil"]')) {
            console.log('[DEBUG] Year dropdown found.');
        } else {
            console.log('[DEBUG] Year dropdown NOT found. Dumping body sample...');
            fs.writeFileSync('debug_dump.html', await page.content());
        }

        // 3. Process
        const targetYear = '2026';
        console.log(`Switching to Year ${targetYear}...`);

        try {
            await page.waitForSelector('select[name*="ddlYil"]', { timeout: 10000 });
            await page.select('select[name*="ddlYil"]', targetYear);
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error('[CRITICAL] Failed to select Year.');
        }

        const months = [1];
        const sites = [SITES[0]]; // Only Aydin Nazilli

        for (const site of sites) {
            console.log(`  Processing Site ${site.name} (${targetYear})...`);
            await page.select('select[name*="ddlSantiye"]', site.val);
            await new Promise(r => setTimeout(r, 1000));

            for (const m of months) {
                const month = m.toString();
                console.log(`    Month ${month}...`);

                await page.select('select[name*="ddlAy"]', month);
                await new Promise(r => setTimeout(r, 1000));

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

                        console.log(`Total Rows Found: ${actualRows.length}`);

                        if (actualRows.length < 2) return [];

                        const parsedRows: any[] = [];

                        // Debug first row
                        if (actualRows.length > 2) {
                            const debugCells = Array.from(actualRows[2].querySelectorAll('td'));
                            console.log('Sample Data Row Cells:', debugCells.length);
                            if (debugCells.length > 1) {
                                console.log('Cell 1 Text:', (debugCells[1] as HTMLElement).innerText);
                            }
                        }

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
                        fs.writeFileSync(`scraped_attendance_${targetYear}_${site.val}_${month}.json`, JSON.stringify(allData, null, 2));
                    } else {
                        console.log(`      No records found. Dumping results page...`);
                        fs.writeFileSync('debug_results_dump.html', await page.content());
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
