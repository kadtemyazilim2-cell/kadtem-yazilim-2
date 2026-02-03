
const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
    console.log("Dumping YetkinYok HTML...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    try {
        await page.goto('https://ikikat.com.tr/AracPuantajRapor.aspx');
        // Likely redirects to YetkinYok
        await new Promise(r => setTimeout(r, 3000));
        console.log('Current URL:', page.url());

        const html = await page.content();
        fs.writeFileSync('yetkinyok_dump.html', html);
        console.log('HTML saved.');
    } finally {
        await browser.close();
    }
}
main();
