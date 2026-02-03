
import puppeteer from 'puppeteer';

// Config
const URL = 'https://ikikat.com.tr/AracPuantaj.aspx';
const CREDENTIALS = { user: 'ahmetcan', pass: 'canahmet' };

(async () => {
    console.log('Launching browser for evidence screenshot...');
    const browser = await puppeteer.launch({ headless: false }); // User can see it too
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    try {
        // 1. Login
        await page.goto('https://ikikat.com.tr/Giris.aspx');
        await page.type('input[type="text"]', CREDENTIALS.user);
        await page.type('input[type="password"]', CREDENTIALS.pass);
        await Promise.all([
            page.click('input[type="submit"]'),
            page.waitForNavigation()
        ]);

        // 2. Navigate to Target Page
        await page.goto(URL, { waitUntil: 'networkidle0' });

        // 3. Select Aydin (1) -> 2025 -> Aug (8)
        // Site
        await page.select('select[name*="ddlSantiye"]', '1');
        await new Promise(r => setTimeout(r, 2000));

        // Year
        await page.select('select[name*="ddlYil"]', '2025');
        await new Promise(r => setTimeout(r, 2000));

        // Month
        await page.select('select[name*="ddlAy"]', '8');
        await new Promise(r => setTimeout(r, 1000));

        // 4. Click 'Getir'
        const btn = await page.$('input[name*="btnGetir"]');
        if (btn) {
            await btn.click();
            await new Promise(r => setTimeout(r, 5000)); // Wait for table load
        }

        // 5. Screenshot
        console.log('Taking screenshot...');
        await page.screenshot({ path: 'evidence_aydin_2025_aug.png', fullPage: true });
        console.log('Screenshot saved: evidence_aydin_2025_aug.png');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
})();
