const fs = require('fs');
const cheerio = require('cheerio');

async function main() {
    const username = 'ahmetcan';
    const password = 'canahmet';
    const loginUrl = 'https://ikikat.com.tr/giris.aspx?returnUrl=%2fAracBelgeListesi.aspx';
    const targetUrl = 'https://ikikat.com.tr/AracBelgeListesi.aspx';

    // Helper to parse set-cookie headers
    function extractCookies(headers) {
        const rawCookies = headers.get('set-cookie');
        if (!rawCookies) return '';

        // Split into individual cookies. 
        // A naive split by comma might fail on dates, but assuming standard node fetch behavior or simple session cookies for now.
        // Better: regex or split by ', ' and check if it starts with known attributes?
        // Actually, we can use a simpler approach: extract KEY=VALUE where KEY is not an attribute.

        // Input: "ASP.NET_SessionId=xyz; path=/; HttpOnly, .IKIKATAUTH=abc; path=/..."
        return rawCookies.split(/,(?=\s*[^;]+=[^;]+)/g) // Split distinct cookies
            .map(c => c.split(';')[0].trim()) // Take only the first part (name=value)
            .join('; '); // Join with semi-colon
    }

    try {
        console.log('1. Fetching Login Page...');
        const initialResponse = await fetch(loginUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        let cookieJar = extractCookies(initialResponse.headers);

        const initialHtml = await initialResponse.text();
        const $initial = cheerio.load(initialHtml);

        let viewState = $initial('#__VIEWSTATE').val();
        let viewStateGenerator = $initial('#__VIEWSTATEGENERATOR').val();
        let eventValidation = $initial('#__EVENTVALIDATION').val();

        console.log('VIEWSTATE found:', !!viewState);

        console.log('2. Logging in...');
        const formData = new URLSearchParams();
        formData.append('__VIEWSTATE', viewState);
        formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
        formData.append('__EVENTVALIDATION', eventValidation);
        formData.append('txtKullaniciAdi', username);
        formData.append('txtSifre', password);
        formData.append('btnGiris', 'Giriş');

        if ($initial('#chkHatirla').length) {
            formData.append('chkHatirla', 'on');
        }

        const loginResponse = await fetch(loginUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Cookie': cookieJar
            },
            redirect: 'manual'
        });

        console.log('Login Response Status:', loginResponse.status);

        const loginCookies = extractCookies(loginResponse.headers);
        if (loginCookies) {
            cookieJar += (cookieJar ? '; ' : '') + loginCookies;
        }

        console.log('CookieJar:', cookieJar);

        if (loginResponse.status === 302 || loginResponse.status === 301) {
            console.log('Redirect location:', loginResponse.headers.get('location'));
        }

        console.log('3. Fetching Vehicle List...');
        const listResponse = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Cookie': cookieJar
            }
        });

        const listHtml = await listResponse.text();
        console.log('List Page Status:', listResponse.status);
        // fs.writeFileSync('debug_list.html', listHtml); // Optional: save for debugging

        const $list = cheerio.load(listHtml);
        const vehicles: any[] = [];

        // Selector based on the provided HTML structure
        // Table id: ContentPlaceHolder1_gv
        // Rows: tbody tr (skip header if in thead, but selectors handle it usually)

        $list('#ContentPlaceHolder1_gv tbody tr').each((i, el) => {
            const $row = $list(el);
            const cols = $row.find('td');

            // Column Indices (0-based per HTML structure provided):
            // 0: Sıra
            // 1: Plaka No (class="col-plate")
            // 10: Trafik Sigorta Bitiş
            // 11: Kasko Bitiş
            // 12: Muayene Bitiş
            // 13: Taşıt Kartı Bitiş

            const plate = $row.find('.col-plate').text().trim();
            if (!plate) return; // Skip empty rows if any

            // Helper to clean date text (e.g. "24.06.2026", remove "30 gün kaldı" etc if present, usually it's just date or span text)
            // The HTML shows dates inside <span class='status ...'> or directly in td?
            // HTML: <td ...><span class='status ok'>24.06.2026</span></td>
            const getColText = (index) => {
                return $list(cols[index]).text().trim();
            };

            const insuranceExpiry = getColText(10);
            const kaskoExpiry = getColText(11);
            const inspectionExpiry = getColText(12);
            const vehicleCardExpiry = getColText(13);

            vehicles.push({
                plate,
                insuranceExpiry,
                kaskoExpiry,
                inspectionExpiry,
                vehicleCardExpiry
            });
        });

        console.log(`Scraped ${vehicles.length} vehicles.`);
        fs.writeFileSync('scraped_vehicles.json', JSON.stringify(vehicles, null, 2));
        console.log('Saved scraped_vehicles.json');

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
