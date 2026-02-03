
const puppeteer = require('puppeteer');
const fs = require('fs');

const CONFIG = {
    reportUrl: 'https://ikikat.com.tr/AracPuantajRapor.aspx',
    yetkiUrl: 'https://ikikat.com.tr/YetkinYok.aspx',
    creds: { user: 'ahmetcan', pass: 'canahmet' },
    targetYears: ['2025', '2026']
};

const SITES = [
    { val: '1', name: 'Aydin Nazilli Yenipazar' },
    { val: '2', name: 'Samsun Vezirkopru' },
    { val: '3', name: 'Tokat Zile' }
];

const TARGET_MONTHS = {
    '2025': [8, 9, 10, 11, 12],
    '2026': [1]
};

async function main() {
    console.log("Starting Targeted Scraping - Navigation Fix...");
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    const allData = [];

    try {
        console.log('Step 1: Go to YetkinYok to clear any bad session...');
        await page.goto(CONFIG.yetkiUrl, { waitUntil: 'load' });

        const logoutBtn = await page.$('#btnLogout');
        if (logoutBtn) {
            console.log('Logout button found. Clicking...');
            await Promise.all([
                logoutBtn.click(),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
            console.log('Logged out. URL:', page.url());
        }

        // Now we should be on Login Page.
        // Check for inputs.
        let loggedIn = false;
        if (await page.$('input[type="password"]') || await page.$('input[name*="Sifre"]')) {
            console.log('Login inputs detected. Logging in...');
            await page.type('input[type="text"]', CONFIG.creds.user);
            await page.type('input[type="password"]', CONFIG.creds.pass);

            const submitBtn = await page.$('input[type="submit"]');
            await Promise.all([
                submitBtn.click(),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
            console.log('Login submitted. URL:', page.url());
            loggedIn = true;
        } else {
            console.log('No login inputs found. Are we logged in? Or wrong page?');
            // If we are at root or main, maybe we are logged in?
        }

        console.log('Step 2: Go to Report Page...');
        await page.goto(CONFIG.reportUrl, { waitUntil: 'networkidle2' });

        if (page.url().includes('YetkinYok')) {
            throw new Error('Still Unauthorized. Credentials might be wrong or user has no access to this report.');
        }

        // If we are here, we should see the dropdown
        await page.waitForSelector('select[name*="ddlYil"]', { timeout: 20000 });

        // Step 3: Scrape
        for (const year of CONFIG.targetYears) {
            console.log(`Switching to Year ${year}...`);
            await page.select('select[name*="ddlYil"]', year);
            await new Promise(r => setTimeout(r, 2000));

            const months = TARGET_MONTHS[year];
            if (!months) continue;

            for (const site of SITES) {
                console.log(`  Processing Site ${site.name} (${year})...`);
                await page.select('select[name*="ddlSantiye"]', site.val);
                await new Promise(r => setTimeout(r, 1500));

                for (const m of months) {
                    const month = m.toString();
                    process.stdout.write(`    Month ${month}: `);

                    try {
                        await page.select('select[name*="ddlAy"]', month);
                        await new Promise(r => setTimeout(r, 1000));

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
                            await btnGetir.click();
                            await new Promise(r => setTimeout(r, 5000));

                            const pageData = await page.evaluate(() => {
                                const rows = Array.from(document.querySelectorAll('table tr'));
                                if (rows.length < 2) return [];

                                const parsedRows = [];
                                for (let i = 1; i < rows.length; i++) {
                                    const cells = Array.from(rows[i].querySelectorAll('td'));
                                    if (cells.length < 5) continue;
                                    const vehicleInfo = cells[1].innerText.trim();
                                    if (!vehicleInfo) continue;
                                    const days = cells.slice(2, 33).map(c => c.innerText.trim());
                                    parsedRows.push({ vehicleInfo, days });
                                }
                                return parsedRows;
                            });

                            if (pageData.length > 0) {
                                console.log(`Found ${pageData.length} records.`);
                                allData.push({
                                    siteName: site.name,
                                    siteVal: site.val,
                                    year: year,
                                    month: month,
                                    rows: pageData
                                });
                                fs.writeFileSync('scraped_attendance.json', JSON.stringify(allData, null, 2));
                            } else {
                                console.log(`No records.`);
                            }
                        }
                    } catch (err) {
                        console.log('Error:', err.message);
                    }
                }
            }
        }

        console.log(`\nScraping Completed. Total Batches: ${allData.length}`);

    } catch (e) {
        console.error("\nGlobal Scrape Error:", e);
    } finally {
        await browser.close();
    }
}

main();
