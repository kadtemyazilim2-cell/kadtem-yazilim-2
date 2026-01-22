
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rawVehicles = [
    { "Plaka": "20 AOF 266", "Marka": "Ford", "Model": "Transit Servis Aracı", "Tip": "Kamyonet" },
    { "Plaka": "20 AJE 763", "Marka": "MERCEDES", "Model": "3031", "Tip": "Kamyon" },
    { "Plaka": "20 AFA 092", "Marka": "MERCEDES", "Model": "3031", "Tip": "Kamyon" },
    { "Plaka": "SUMİTOMO SH 210 LC", "Marka": "SUMİTOMO", "Model": "SH 210 LC", "Tip": "İş Makinesi" },
    { "Plaka": "Tümosan 7056", "Marka": "Tümosan", "Model": "7056", "Tip": "Traktör" },
    { "Plaka": "Tümosan 8095", "Marka": "Tümosan", "Model": "8095", "Tip": "Traktör" },
    { "Plaka": "20 AAU 061", "Marka": "TANKER", "Model": "TANKER", "Tip": "Kamyon" },
    { "Plaka": "60 ACU 271", "Marka": "Renault", "Model": "Symbol", "Tip": "Otomobil" },
    { "Plaka": "Kiralık", "Marka": "Jcb", "Model": "Jcb", "Tip": "İş Makinesi" },
    { "Plaka": "15 AAH 448", "Marka": "MAN", "Model": "MAN", "Tip": "Kamyon" },
    { "Plaka": "20 AGN 312", "Marka": "Mercedes", "Model": "3028", "Tip": "Kamyon" },
    { "Plaka": "20 KS 695", "Marka": "Mercedes", "Model": "3028", "Tip": "Kamyon" },
    { "Plaka": "60 AAN 203", "Marka": "İbrahim Temir", "Model": "Tır", "Tip": "Çekici" },
    { "Plaka": "20 AJF 532", "Marka": "MERCEDES", "Model": "KAMYON", "Tip": "Kamyon" },
    { "Plaka": "06 BHD 462", "Marka": "Mazda", "Model": "Mazda", "Tip": "Otomobil" },
    { "Plaka": "20 D 9172", "Marka": "ATILIM", "Model": "VABCO YARI RÖMORK", "Tip": "Treyler" },
    { "Plaka": "15 ABK 784", "Marka": "New Holland", "Model": "TM 155", "Tip": "Traktör" },
    { "Plaka": "01 C 9569", "Marka": "New Holland", "Model": "TM155", "Tip": "Traktör" },
    { "Plaka": "20 B 0460", "Marka": "Ford", "Model": "Connect", "Tip": "Kamyonet" },
    { "Plaka": "60 AJ 433", "Marka": "KADIOĞLU", "Model": "MAZOT TANKERİ", "Tip": "Kamyon" },
    { "Plaka": "60 AEY 074", "Marka": "RENAULT", "Model": "EXPRESS", "Tip": "Otomobil" },
    { "Plaka": "60 HT 260", "Marka": "CITROEN", "Model": "LİDER MAKİNE FEYZULLAH", "Tip": "Otomobil" },
    { "Plaka": "TÜMOSAN 8095", "Marka": "TÜMOSAN", "Model": "TRAKTÖR", "Tip": "Traktör" },
    { "Plaka": "SUMİTOMO 300", "Marka": "SUMİTOMO", "Model": "300", "Tip": "İş Makinesi" },
    { "Plaka": "SUMİTOMO 210", "Marka": "SUMİTOMO", "Model": "210", "Tip": "İş Makinesi" },
    { "Plaka": "NEWHOLLAND", "Marka": "NEWHOLLAND", "Model": "1554", "Tip": "Traktör" },
    { "Plaka": "JCB", "Marka": "JCB", "Model": "BEKO LOADER", "Tip": "İş Makinesi" },
    { "Plaka": "HYUNDAİ 210", "Marka": "HYUNDAİ", "Model": "210", "Tip": "İş Makinesi" },
    { "Plaka": "3035 T", "Marka": "TRENCHER", "Model": "3035 T", "Tip": "İş Makinesi" },
    { "Plaka": "2025 T", "Marka": "TRENCHER", "Model": "2025 T", "Tip": "İş Makinesi" },
    { "Plaka": "20 SV 588", "Marka": "MERCEDES", "Model": "KAMYON", "Tip": "Kamyon" },
    { "Plaka": "20 PR 205", "Marka": "MERCEDES", "Model": "KAMYON", "Tip": "Kamyon" },
    { "Plaka": "20 D 9221", "Marka": "ATILIM", "Model": "TIR", "Tip": "Çekici" },
    { "Plaka": "20 AT 901", "Marka": "FORD", "Model": "AÇIK KASA TRANSİT", "Tip": "Kamyonet" },
    { "Plaka": "20 APF 898", "Marka": "MERCEDES", "Model": "KAMYON", "Tip": "Kamyon" },
    { "Plaka": "20 AOS 213", "Marka": "ARAZÖZ", "Model": "ARAZÖZ", "Tip": "Kamyon" },
    { "Plaka": "20 AIF 182", "Marka": "DACİA", "Model": "DACİA", "Tip": "Otomobil" },
    { "Plaka": "20 AIC 919", "Marka": "MITSUBISHI", "Model": "L200", "Tip": "Kamyonet" },
    { "Plaka": "20 AGV 818", "Marka": "FORD", "Model": "KAPALI TRANSİT", "Tip": "Kamyonet" },
    { "Plaka": "20 AGT 534", "Marka": "MERCEDES", "Model": "KAMYON", "Tip": "Kamyon" },
    { "Plaka": "20 AFA 898", "Marka": "MERCEDES", "Model": "KAMYON", "Tip": "Kamyon" },
    { "Plaka": "20 AFA 092", "Marka": "MERCEDES", "Model": "3031", "Tip": "Kamyon" },
    { "Plaka": "20 AC 240", "Marka": "FORD", "Model": "ÇİFT KABİN TRANSİT", "Tip": "Kamyonet" },
    { "Plaka": "09 ADA 284", "Marka": "TRAKTÖR", "Model": "TRAKTÖR", "Tip": "Traktör" },
    { "Plaka": "06 ADV 304", "Marka": "NISSAN", "Model": "NAVARA", "Tip": "Kamyonet" }
];

const mapType = (tip: string): any => { // Return 'VehicleType' compatible string
    const t = tip.toLowerCase();
    if (t.includes('kamyon') && !t.includes('kamyonet')) return 'TRUCK';
    if (t.includes('kamyonet')) return 'PICKUP';
    if (t.includes('otomobil')) return 'CAR';
    if (t.includes('traktör')) return 'TRACTOR';
    if (t.includes('tanker')) return 'TRUCK';
    if (t.includes('çekici') || t.includes('tır')) return 'LORRY';
    if (t.includes('treyler')) return 'LORRY';
    if (t.includes('iş makinesi') || t.includes('ekskavatör') || t.includes('loader') || t.includes('trencher') || t.includes('jcb')) return 'EXCAVATOR';
    return 'OTHER';
};

async function main() {
    console.log('Starting rental vehicle import...');

    // Get a default company
    const defaultCompany = await prisma.company.findFirst();
    if (!defaultCompany) {
        console.error('No company found in database to assign vehicles to!');
        return;
    }
    console.log(`Assigning to Company: ${defaultCompany.name} (${defaultCompany.id})`);

    let importedCount = 0;
    let skippedCount = 0;

    for (const v of rawVehicles) {
        if (!v.Plaka) continue;

        const exists = await prisma.vehicle.findUnique({
            where: { plate: v.Plaka }
        });

        if (exists) {
            console.log(`Skipping existing vehicle: ${v.Plaka}`);
            skippedCount++;
            continue;
        }

        const type = mapType(v.Tip);
        const meterType = (type === 'EXCAVATOR' || type === 'TRACTOR') ? 'HOURS' : 'KM';

        try {
            await prisma.vehicle.create({
                data: {
                    plate: v.Plaka,
                    brand: v.Marka,
                    model: v.Model,
                    year: new Date().getFullYear(),
                    type: type,
                    ownership: 'RENTAL',
                    status: 'ACTIVE',
                    currentKm: 0,
                    meterType: meterType, // Added meterType
                    rentalCompanyName: 'İkikat (İçe Aktarılan)',
                    monthlyRentalFee: 0,
                    companyId: defaultCompany.id
                }
            });
            console.log(`Imported: ${v.Plaka}`);
            importedCount++;
        } catch (error) {
            console.error(`Failed to import ${v.Plaka}:`, error);
        }
    }

    console.log(`\nImport Complete!`);
    console.log(`Imported: ${importedCount}`);
    console.log(`Skipped: ${skippedCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
