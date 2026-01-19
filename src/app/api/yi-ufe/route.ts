import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET() {
    try {
        const response = await fetch('https://www.hakedis.org/endeksler/yi-ufe-yurtici-uretici-fiyat-endeksi');
        const html = await response.text();
        const $ = cheerio.load(html);

        const rates: { year: number; month: number; index: number }[] = [];

        // Strategy: Look for the main table. Usually these sites have a specific table class or id.
        // If not found, look for a table with many rows.
        // Let's assume the table has "Yıl" and "Ay" headers.

        // Strategy: Hakedis.org uses a specific table structure.
        // verified via manual inspection: table class="table table-striped..."
        // Columns: YIL | OCAK | ŞUBAT ... | ARALIK (13 columns total)

        $('table').each((_, table) => {
            // We look for a table where the first header is "YIL" or "Yil" (handling encoding/locale)
            const headers = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
            if (!headers.includes('yıl') && !headers.includes('yil')) return; // skip if not target table

            // Finding rows: handle both tbody and direct children
            let rows = $(table).find('tbody tr');
            if (rows.length === 0) rows = $(table).find('tr');

            rows.each((_, tr) => {
                const cols = $(tr).find('td');
                // We expect at least 13 columns (Year + 12 Months)
                // Sometimes they might have averages or totals, so check length >= 13
                if (cols.length >= 13) {
                    const yearStr = $(cols[0]).text().trim();
                    const year = parseInt(yearStr);

                    if (!isNaN(year)) {
                        // Loop through months 1-12 (indices 1 to 12 in cols)
                        for (let m = 1; m <= 12; m++) {
                            // Column index for month m is m
                            // e.g. January (m=1) is at cols[1]
                            const valStr = $(cols[m]).text().trim();
                            // Handle Turkish number formatting: 3.861,33 -> 3861.33
                            // Remove dots (thousands), replace comma with dot (decimal)
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

        // Debug: If empty, add some mock data or check what happened in a real scenario.
        // But for this environment, I'll return what I found or nothing.

        // Sorting: Newest first
        rates.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        return NextResponse.json({ rates });

    } catch (error) {
        console.error('Scraping error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
