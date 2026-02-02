
const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    try {
        console.log('Navigating to login...');
        await page.goto('https://ikikat.com.tr/', { waitUntil: 'networkidle2' });

        // Check if login is needed
        const url = page.url();
        console.log('Current URL:', url);

        if (url.includes('Login') || await page.$('input[name*="UserName"]')) {
            console.log('Logging in...');
            // Selectors might guess - standard ASP.NET names often contain UserName/Password
            // Let's dump input names if we fail, but first try blindly based on common ASP.NET patterns or name/id
            // User: ahmetcan, Pass: canahmet

            // Try explicit selectors based on typical experience or generic
            // Better: get all inputs
            await page.type('input[type="text"]', 'ahmetcan'); // Likely username
            await page.type('input[type="password"]', 'canahmet');

            // Click submit button
            const submitBtn = await page.$('input[type="submit"], button[type="submit"]');
            if (submitBtn) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    submitBtn.click(),
                ]);
            } else {
                console.log('Submit button not found, hitting Enter...');
                await page.keyboard.press('Enter');
                await page.waitForNavigation({ waitUntil: 'networkidle2' });
            }
            console.log('Login attempt finished. New URL:', page.url());
        }

        console.log('navigating to content page...');
        await page.goto('https://ikikat.com.tr/YakitRapor.aspx', { waitUntil: 'networkidle2' });

        console.log('Page Title:', await page.title());

        // Dump HTML to see structure + drop-down for Sites
        const content = await page.content();
        fs.writeFileSync('external_dump.html', content);
        console.log('Saved external_dump.html');

        // Try to identify Site Selector
        // Need to find "Aydın Nazilli", "Zile 1", etc.

    } catch (e) {
        console.error('Error:', e);
        // Dump screenshot if possible
        await page.screenshot({ path: 'error_screen.png' });
    } finally {
        await browser.close();
    }
}

run();
