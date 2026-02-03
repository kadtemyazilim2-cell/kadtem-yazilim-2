
const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
    console.log("Dumping Login HTML...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    try {
        await page.goto('https://ikikat.com.tr/Login.aspx');
        await new Promise(r => setTimeout(r, 2000));
        console.log('Current URL:', page.url());

        const html = await page.content();
        fs.writeFileSync('login_dump.html', html);
        console.log('Login HTML saved.');
    } finally {
        await browser.close();
    }
}
main();
