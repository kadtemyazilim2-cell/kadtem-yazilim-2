
import puppeteer from 'puppeteer';
import * as fs from 'fs';

const CONFIG = {
    url: 'https://ikikat.com.tr/AracPuantajRapor.aspx',
    creds: { user: 'ahmetcan', pass: 'canahmet' },
    targetYear: '2025'
};

const SITES = [
    { val: '1', name: 'Aydin' },
    { val: '2', name: 'Samsun' },
    { val: '3', name: 'Tokat' },
    { val: '4', name: 'Doganli' }
];

interface AttendanceRecord {
    site: string;
    month: string;
    date: string;
    plate: string;
    driver: string;
    dayWork: string;
    nightWork: string;
    standbyWork: string;
    description: string;
}

async function main() {
    console.log("Starting Deep Scan V13...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    const allData: AttendanceRecord[] = [];

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
        console.log('After login - Current URL:', page.url(), 'Title:', await page.title());

        await page.waitForSelector('select[name*="ddlYil"]', { timeout: 10000 });
        // Log available years for debugging
        const years = await page.evaluate(() => {
            const sel = document.querySelector('select[name*="ddlYil"]') as HTMLSelectElement;
            return sel ? Array.from(sel.options).map(o => o.value) : [];
        });
        console.log('Available Years:', years);

        if (!years.includes(CONFIG.targetYear)) {
            console.error(`Year ${CONFIG.targetYear} not found in dropdown!`);
            return;
        }

        await page.select('select[name*="ddlYil"]', CONFIG.targetYear);
        // Wait for postback from year change
        await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(e => console.log("Year change nav timeout/skip:", e));

        // Uncheck Fuel
        const chk = await page.$('input[name*="chkSadeceYakit"]');
        if (chk) {
            const isChecked = await (await chk.getProperty('checked')).jsonValue();
            if (isChecked) {
                await Promise.all([
                    chk.click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { })
                ]);
            }
        }

        let foundAny = false;
        let debugDumped = false;

        for (const site of SITES) {
            console.log(`Checking Site ${site.name}...`);
            await page.select('select[name*="ddlSantiye"]', site.val);
            // Wait for postback
            await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { });

            for (let m = 1; m <= 12; m++) {
                const month = m.toString();
                await page.select('select[name*="ddlAy"]', month);

                const btnGetir = await page.$('input[name*="btnGetir"]');
                if (btnGetir) {
                    console.log(`Clicking Getir for ${site.name} - ${month}/${CONFIG.targetYear}...`);
                    try {
                        // Click and wait for navigation (or just wait if it's AJAX)
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
                            btnGetir.click()
                        ]);
                    } catch (e) {
                        console.log("Navigation timeout or error (might be AJAX or slow):", (e as Error).message);
                        // Convert to error to access message property if needed, or just log string
                    }

                    if (!debugDumped) {
                        await page.screenshot({ path: 'debug_search_result.png', fullPage: true });
                        console.log("Captured debug_search_result.png");
                        debugDumped = true;
                    }

                    const tableData = await page.evaluate((currentSite, currentMonth) => {
                        // Try deeper selector or just all tables
                        const tables = document.querySelectorAll('table');
                        // console.log(`  Found ${tables.length} tables`);

                        // Usually the data table has a specific class or ID, but let's look for one with many rows
                        let targetTable: HTMLTableElement | null = null;
                        for (const t of tables) {
                            if (t.rows.length > 2 && (t as HTMLElement).innerText.includes('Plaka')) {
                                targetTable = t as HTMLTableElement;
                                break;
                            }
                        }

                        // Fallback: the one with ID ending in gvPuantaj
                        if (!targetTable) {
                            targetTable = document.querySelector('table[id*="gvPuantaj"]') as HTMLTableElement;
                        }

                        if (!targetTable) return [];

                        const rows = Array.from(targetTable.querySelectorAll('tr'));
                        const data: any[] = [];

                        // Skip header
                        for (let i = 1; i < rows.length; i++) {
                            const row = rows[i] as HTMLTableRowElement;
                            const cols = row.querySelectorAll('td');

                            // Adjust these indices based on the actual table structure
                            // Assuming: Date, Plate, Driver, Day, Night, Standby, Desc...
                            // Inspecting the previous logs or standard structure might be needed if this fails
                            if (cols.length > 5) {
                                data.push({
                                    site: currentSite,
                                    month: currentMonth,
                                    date: cols[0]?.innerText?.trim() || '',
                                    plate: cols[1]?.innerText?.trim() || '',
                                    driver: cols[2]?.innerText?.trim() || '',
                                    dayWork: cols[3]?.innerText?.trim() || '',
                                    nightWork: cols[4]?.innerText?.trim() || '',
                                    standbyWork: cols[5]?.innerText?.trim() || '',
                                    description: cols[6]?.innerText?.trim() || ''
                                });
                            }
                        }
                        return data;
                    }, site.name, month);

                    if (tableData.length > 0) {
                        console.log(`FOUND DATA! Site: ${site.name}, Month: ${month}, Rows: ${tableData.length}`);
                        foundAny = true;
                        allData.push(...tableData);
                    }
                }
            }
        }

        if (allData.length > 0) {
            console.log(`Total records found: ${allData.length}`);
            fs.writeFileSync('ikikat_2025_data.json', JSON.stringify(allData, null, 2));
            console.log("Data saved to ikikat_2025_data.json");
        } else {
            console.log("Deep Scan Complete. NO DATA FOUND in 2025.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
main();
