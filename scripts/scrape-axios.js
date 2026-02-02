
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const qs = require('querystring');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
        'Connection': 'keep-alive'
    }
}));

const BASE_URL = 'https://ikikat.com.tr';

async function run() {
    try {
        console.log('1. Fetching Login Page...');
        const loginPageRes = await client.get(BASE_URL);
        const $ = cheerio.load(loginPageRes.data);

        const viewState = $('#__VIEWSTATE').val();
        const eventValidation = $('#__EVENTVALIDATION').val();
        const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();

        console.log('Got ViewState:', viewState ? 'Yes' : 'No');

        // Guessing input names based on standard patterns or if I could see them. 
        // Since I can't browse, I'll dump the inputs found on login page to be sure for next step
        // But let's try standard names first: txtUserName, txtPassword, btnLogin or similar.
        // Actually, let's look at the inputs
        const inputs = $('input').map((i, el) => $(el).attr('name')).get();
        console.log('Inputs found:', inputs);

        // Heuristic: Find user/pass fields
        const userField = inputs.find(n => n && n.toLowerCase().includes('user'));
        const passField = inputs.find(n => n && n.toLowerCase().includes('pass'));
        const btnField = inputs.find(n => n && (n.toLowerCase().includes('btn') || n.toLowerCase().includes('sub')));

        if (!userField || !passField) {
            console.error('Could not identify login fields automatically. Inputs:', inputs);
            return;
        }

        console.log(`Using fields: User=${userField}, Pass=${passField}`);

        const formData = {
            '__VIEWSTATE': viewState,
            '__EVENTVALIDATION': eventValidation,
            '__VIEWSTATEGENERATOR': viewStateGenerator,
            [userField]: 'ahmetcan',
            [passField]: 'canahmet',
            [btnField || 'ctl00$MainContent$btnLogin']: 'Giriş Yap' // Fallback
        };

        console.log('2. Posting Login...');
        const loginRes = await client.post(BASE_URL, qs.stringify(formData), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            maxRedirects: 5
        });

        console.log('Login Status:', loginRes.status);
        console.log('Final URL:', loginRes.config.url);

        console.log('3. Fetching YakitRapor.aspx...');
        const reportRes = await client.get(`${BASE_URL}/YakitRapor.aspx`);

        fs.writeFileSync('report_dump.html', reportRes.data);
        console.log('Saved report_dump.html');

        const $r = cheerio.load(reportRes.data);
        const title = $r('title').text();
        console.log('Report Page Title:', title);

        // Check if we are actually logged in (Title shouldn't be Login)
        if (title.toLowerCase().includes('giriş') || title.toLowerCase().includes('login')) {
            console.log('FAILED: Still on login page.');
        } else {
            console.log('SUCCESS: Accessed report page.');
        }

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error('Res Status:', e.response.status);
    }
}

run();
