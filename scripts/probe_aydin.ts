
import puppeteer from 'puppeteer';

const CONFIG = {
    url: 'https://ikikat.com.tr/AracPuantaj.aspx',
    creds: { user: 'ahmetcan', pass: 'canahmet' },
};

async function main() {
    console.log("Starting PROBE for Aydin Aug 2025...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    try {
        await page.goto('https://ikikat.com.tr/Giris.aspx');
        await page.type('input[type="text"]', CONFIG.creds.user);
        await page.type('input[type="password"]', CONFIG.creds.pass);
        await Promise.all([page.click('input[type="submit"]'), page.waitForNavigation()]);
        await page.goto(CONFIG.url);

        const targetSiteVal = '1'; // Aydin
        const targetYear = '2025';
        const targetMonth = '8';

        // TEST 1: Year -> Site -> Month
        console.log("\n--- TEST 1: Year -> Site -> Month ---");
        await page.select('select[name*="ddlYil"]', targetYear);
        await new Promise(r => setTimeout(r, 3000));
        await page.select('select[name*="ddlSantiye"]', targetSiteVal);
        await new Promise(r => setTimeout(r, 3000));
        await page.select('select[name*="ddlAy"]', targetMonth);
        await new Promise(r => setTimeout(r, 2000));

        const btn = await page.$('input[name*="btnGetir"]');
        if (btn) await Promise.all([btn.click(), new Promise(r => setTimeout(r, 5000))]);

        let count = await page.evaluate(() => document.querySelectorAll('table#ContentPlaceHolder1_grdAracPuantaj tr').length);
        console.log(`TEST 1 Result: ${count} rows (Header included)`);

        // TEST 2: Site -> Year -> Month
        console.log("\n--- TEST 2: Site -> Year -> Month ---");
        // Reset by navigating away or refreshing? 
        // Let's just select a different site first to force change
        await page.select('select[name*="ddlSantiye"]', '4'); // Doganli
        await new Promise(r => setTimeout(r, 3000));

        await page.select('select[name*="ddlSantiye"]', targetSiteVal);
        await new Promise(r => setTimeout(r, 3000));
        await page.select('select[name*="ddlYil"]', targetYear);
        await new Promise(r => setTimeout(r, 3000));
        await page.select('select[name*="ddlAy"]', targetMonth);
        await new Promise(r => setTimeout(r, 2000));

        if (btn) await Promise.all([btn.click(), new Promise(r => setTimeout(r, 5000))]);

        count = await page.evaluate(() => document.querySelectorAll('table#ContentPlaceHolder1_grdAracPuantaj tr').length);
        console.log(`TEST 2 Result: ${count} rows`);

        // TEST 3: Toggle "Sadece Yakıt"
        console.log("\n--- TEST 3: Toggle Checkbox ---");
        const chk = await page.$('input[name*="chkSadeceYakit"]');
        if (chk) {
            await chk.click(); // Toggle it
            await new Promise(r => setTimeout(r, 3000));
            if (btn) await Promise.all([btn.click(), new Promise(r => setTimeout(r, 5000))]);
            count = await page.evaluate(() => document.querySelectorAll('table#ContentPlaceHolder1_grdAracPuantaj tr').length);
            console.log(`TEST 3 Result (After Toggle): ${count} rows`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
main();
