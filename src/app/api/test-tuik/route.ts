import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET() {
    try {
        // TUIK Category Page for "Inflation and Price"
        const categoryUrl = 'https://data.tuik.gov.tr/Kategori/GetKategori?p=Enflasyon-ve-Fiyat-106&dil=1';

        console.log('Fetching:', categoryUrl);
        const res = await fetch(categoryUrl);
        const html = await res.text();

        const $ = cheerio.load(html);
        const links: { text: string, href: string }[] = [];

        $('a').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (text && href) {
                links.push({ text, href });
            }
        });

        // Filter for Yi-UFE related links
        const yiUfeLinks = links.filter(l => l.text.includes('Yurt İçi Üretici Fiyat Endeksi') || l.href.includes('YI-UFE'));

        return NextResponse.json({
            success: true,
            status: res.status,
            linksCount: links.length,
            yiUfeLinks,
            htmlPreview: html.substring(0, 500)
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
