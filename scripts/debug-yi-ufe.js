const cheerio = require('cheerio');

async function testScraping() {
    try {
        console.log("Fetching https://www.hakedis.org/endeksler/yi-ufe-yurtici-uretici-fiyat-endeksi...");
        const response = await fetch('https://www.hakedis.org/endeksler/yi-ufe-yurtici-uretici-fiyat-endeksi');
        const html = await response.text();
        console.log(`Fetched ${html.length} bytes.`);

        const $ = cheerio.load(html);
        const rates = [];

        $('table').each((index, table) => {
            console.log(`Checking table ${index}...`);
            const headers = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
            console.log(`Headers: ${JSON.stringify(headers)}`);

            if (!headers.includes('yıl') && !headers.includes('yil')) {
                console.log("Skipping table: 'yıl' header not found.");
                return;
            }

            let rows = $(table).find('tbody tr');
            if (rows.length === 0) rows = $(table).find('tr');
            console.log(`Found ${rows.length} rows.`);

            rows.each((rIndex, tr) => {
                const cols = $(tr).find('td');
                if (cols.length >= 13) {
                    const yearStr = $(cols[0]).text().trim();
                    const year = parseInt(yearStr);
                    // console.log(`Row ${rIndex}: Year ${yearStr} (Parsed: ${year})`);

                    if (!isNaN(year)) {
                        for (let m = 1; m <= 12; m++) {
                            const valStr = $(cols[m]).text().trim();
                            const cleanValStr = valStr.replace(/\./g, '').replace(',', '.');
                            const val = parseFloat(cleanValStr);
                            if (!isNaN(val)) {
                                rates.push({ year, month: m, index: val });
                            }
                        }
                    }
                }
            });
        });

        console.log(`Total rates found: ${rates.length}`);
        if (rates.length > 0) {
            console.log("Sample rate:", rates[0]);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testScraping();
