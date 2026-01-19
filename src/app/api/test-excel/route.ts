import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
    try {
        // This is the "Url" from the JSON in Step 923 for "Yurt içi üretici fiyat endeksi ve değişim oranı"
        const encodedUrl = "sWY8HzcuMIjbqHvHEulHan6ayypwiCoKeTKcB4ApA3EvL1SdUFKsxYASm1RuOVzbez6gwqhel650c8QSqqrU4wJJAJMB1/LCSHhg3bZjdzM=";
        const downloadUrl = `https://data.tuik.gov.tr/Bulten/DownloadIstatistikselTablo?p=${encodedUrl}`;

        console.log('Fetching Excel:', downloadUrl);
        const res = await fetch(downloadUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://data.tuik.gov.tr/Bulten/Index?p=Yurt-Ici-Uretici-Fiyat-Endeksi-Aralik-2024-53696',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON to inspect
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Header: 1 gives array of arrays

        return NextResponse.json({
            success: true,
            sheetName: firstSheetName,
            rowCount: jsonData.length,
            preview: jsonData.slice(0, 15) // First 15 rows
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
