import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// --- INLINED DATA ---

const COMPANIES: any[] = [
    {
        id: 'comp_ikikat',
        name: 'İKİKAT LTD. ŞTİ.',
        address: 'Merkez',
        status: 'ACTIVE'
    },
    {
        id: 'comp_kadtem',
        name: 'KAD-TEM A.Ş.',
        address: 'Merkez',
        status: 'ACTIVE'
    }
];

const SITES: any[] = [];

const USERS = [
    {
        id: 'u1', name: 'Sistem Yöneticisi', username: 'admin', password: '123', email: 'admin@system.com', role: 'ADMIN',
        assignedCompanyIds: ['comp_ikikat', 'comp_kadtem'], assignedSiteIds: [], permissions: {}
    }
];

const VEHICLES: any[] = [
    // İKİKAT LTD. ŞTİ.
    { id: 'v_ik_1', plate: '61-00-16-0054', brand: 'Caterpiller', model: 'D6 Dozer', year: 1974, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '6A6398', chassisNumber: '47J3045.10000' },
    { id: 'v_ik_2', plate: 'NON-PLATE-1', brand: 'Fiat Hitachi', model: '200.3 20 Ton Paletli Ekskavator', year: 1997, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '379147', chassisNumber: '203H0341' },
    { id: 'v_ik_3', plate: '34-00-2556', brand: 'Hidromek', model: 'HMK 101S Beko Loader', year: 2000, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: 'AB50458U971476G', chassisNumber: '30690' },
    { id: 'v_ik_4', plate: '34-00-24-7675', brand: 'Hidromek', model: 'HMK 102S ALPHA K5 Beko Loader', year: 2024, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: 'FX52016U029679J', chassisNumber: 'HMK102SRL2S530687' },
    { id: 'v_ik_5', plate: '34-00-15-13879', brand: 'Hitachi', model: 'ZX350 LC-3 35 Ton Paletli Ekskavator', year: 2015, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '590239', chassisNumber: 'HCM1V800V00060583' },
    { id: 'v_ik_6', plate: '34-00-24-2834', brand: 'Hidromek', model: '230 LC-5 23 Ton Paletli Ekskavator', year: 2024, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '4HK1867198', chassisNumber: 'HMKH3480LP1345370' },
    { id: 'v_ik_7', plate: '34-00-24-5563', brand: 'Hidromek', model: '230 LC-5 23 Ton Paletli Ekskavator', year: 2024, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '4HK1868085', chassisNumber: 'HMKH3480PR1345069' },
    { id: 'v_ik_8', plate: '60-04-07-008', brand: 'Caterpiller', model: '160 H Greyder', year: 1995, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '08Z86314', chassisNumber: '9EJ00078' },
    { id: 'v_ik_9', plate: '60 ES 785', brand: 'Hyundai', model: 'Staria Elite (8+1) 2.2 CRDI 177 PS', year: 2024, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'D4HBRH005818', chassisNumber: 'KMHYC811BRU177401' },
    { id: 'v_ik_10', plate: '60 BP 164', brand: 'Renault', model: 'Symbol Otomobil', year: 2017, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'K9KC612D416710', chassisNumber: 'VF14SRCL4585143701' },
    { id: 'v_ik_11', plate: '60 ADG 721', brand: 'Fiat', model: 'Egea Otomobil Sedan', year: 2022, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'NM435600006W98040', chassisNumber: '843A10002915246' },
    { id: 'v_ik_12', plate: '60 ACN 701', brand: 'Dacia', model: 'Duster', year: 2021, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'H4DF480U057897', chassisNumber: 'VF1HJD20267812273' },
    { id: 'v_ik_13', plate: '60 ACN 715', brand: 'Dacia', model: 'Duster', year: 2021, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'H4DF480U035847', chassisNumber: 'VF1HJD20167396328' },
    { id: 'v_ik_14', plate: '60 AES 023', brand: 'Mercedes', model: 'CLA 200 AMG', year: 2025, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '28281480404962', chassisNumber: 'W1K5J8HB8TN581624' },
    { id: 'v_ik_15', plate: '60 ADR 790', brand: 'Dacia', model: 'Duster', year: 2022, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'H4DF480U166175', chassisNumber: 'VF1HJD20169560231' },
    { id: 'v_ik_16', plate: '60 HF 131', brand: 'Massey Ferguson', model: 'MF285 Traktör', year: 1993, type: 'TRACTOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: 'LF97050T24826W24824741', chassisNumber: '6TU28524741' },
    { id: 'v_ik_17', plate: '60 AAG 486', brand: 'Mitsubishi', model: 'L200 Invite', year: 2014, type: 'TRUCK', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '4D56UCFN9954', chassisNumber: 'MMCJNKB40FD030388' },
    { id: 'v_ik_18', plate: '60 AEV 731', brand: 'Honda', model: 'PCX', year: 2023, type: 'OTHER', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'K05E6254939', chassisNumber: 'RLHJK05AXPY154873' },

    // KAD-TEM A.Ş.
    { id: 'v_kt_1', plate: '06-00-10-1096', brand: 'Caterpiller', model: '140 G Greyder', year: 1987, type: 'EXCAVATOR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '08Z41610', chassisNumber: '72V10937' },
    { id: 'v_kt_2', plate: '60-00-10-0011', brand: 'Hidromek', model: '300 LC 30 Ton Paletli Ekskavator', year: 2010, type: 'EXCAVATOR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '6HK1X-529703', chassisNumber: 'A125518' },
    { id: 'v_kt_3', plate: '34-00-11-6911', brand: 'Amman', model: 'Asc110 Keçiayaklı Silindir', year: 2010, type: 'EXCAVATOR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: '21987831', chassisNumber: '2823013' },
    { id: 'v_kt_4', plate: '60 ADU 194', brand: 'Citroen', model: 'AMI', year: 2022, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '105RAA2000483', chassisNumber: 'VR79AZ2CAN5916190' },
    { id: 'v_kt_5', plate: '60 EC 562', brand: 'Peugeot', model: '3008 Allure 1.6 Puretech', year: 2023, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '10FKBL3009013', chassisNumber: 'VF3M45GFUNS171687' },
    { id: 'v_kt_6', plate: '60 HN 887', brand: 'Mercedes', model: 'E350 Otomobil', year: 2011, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '64285841102089', chassisNumber: 'WDD2120931A411541' },
    { id: 'v_kt_7', plate: '06 BC 0679', brand: 'Mercedes', model: 'GLK 220 Otomobil', year: 2015, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '65191232752337', chassisNumber: 'WDC2049841G415583' },
    { id: 'v_kt_8', plate: '60 HN 450', brand: 'Renault', model: 'Fluence Otomobil', year: 2013, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'K9KH834R034618', chassisNumber: 'VF1LZBS0549872015' },
    { id: 'v_kt_9', plate: '60 AGN 891', brand: 'Opel', model: 'Corsa-E Otomobil', year: 2019, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'B14XER19US6354', chassisNumber: 'W0V0XEP8K4220247' },
    { id: 'v_kt_10', plate: '60 HP 953', brand: 'Renault', model: 'Symbol Otomobil', year: 2011, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'K9K1740R044850', chassisNumber: 'VF1LBNMS545812477' },
    { id: 'v_kt_11', plate: '06 FF 3260', brand: 'Skoda', model: 'Superb', year: 2023, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'DPCP11959', chassisNumber: 'TMBAN6NP9P7048824' },
    { id: 'v_kt_12', plate: '60 AJ 465', brand: 'Ford', model: 'M350 Kamyonet', year: 2008, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '7L64403', chassisNumber: 'NM0NXXTTFN7L64403' },
    { id: 'v_kt_13', plate: '60 AEY 683', brand: 'Ford', model: 'Transit FMA6 Çift Kabin Kamyonet', year: 2023, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'PU07086', chassisNumber: 'NM0CXXTTRCPU07086' },
    { id: 'v_kt_14', plate: '60 AFA 401', brand: 'Ford', model: 'Transit FMA6 Çift Kabin Kamyonet', year: 2023, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'PM28325', chassisNumber: 'NM0CXXTTRCPM28325' },
    { id: 'v_kt_15', plate: '35 GA 8108', brand: 'Mercedes', model: 'Sprinter Kamyonet', year: 2012, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '65195531158084', chassisNumber: 'WDB9061331N522638' },
    { id: 'v_kt_16', plate: '60 BC 866', brand: 'Mitsubishi', model: 'Yakıt Tankeri', year: 1997, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '4D34C01071', chassisNumber: 'FE444EA52002' },
    { id: 'v_kt_17', plate: '60 ACE 788', brand: 'Iveco', model: '35.9 Kamyonet', year: 1996, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'FIAT8040U5230837869', chassisNumber: '3513796' },
    { id: 'v_kt_18', plate: '60 DB 904', brand: 'New Holland', model: 'Traktör', year: 2007, type: 'TRACTOR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS', engineNumber: 'TTF804525L406T148743', chassisNumber: 'HFD047534' },
    { id: 'v_kt_19', plate: '60 AEU 736', brand: 'CFMOTO', model: 'CF1000ATR ATV', year: 2023, type: 'TRACTOR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '2V91YPF012034', chassisNumber: 'LCELV1Z85P6004579' },
    { id: 'v_kt_20', plate: '34 GF 3763', brand: 'Ford', model: '1838 Çekici', year: 2011, type: 'LORRY', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'AB77980', chassisNumber: 'NM0K13TFDABAB77980' },
    { id: 'v_kt_21', plate: '60 BP 842', brand: 'Mercedes', model: 'Arocs Damperli Kamyon 4142', year: 2018, type: 'LORRY', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '471926C0364386', chassisNumber: 'NMB96423112188019' },
    { id: 'v_kt_22', plate: '60 BP 843', brand: 'Mercedes', model: 'Arocs Damperli Kamyon 4142', year: 2018, type: 'LORRY', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '471926C0364686', chassisNumber: 'NMB96423112188016' },
    { id: 'v_kt_23', plate: '60 BP 844', brand: 'Mercedes', model: 'Arocs Damperli Kamyon 4142', year: 2018, type: 'LORRY', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '471926C0364651', chassisNumber: 'NMB96423112188017' },
    { id: 'v_kt_24', plate: '60 BP 933', brand: 'Mercedes', model: 'Arocs Damperli Kamyon 4148', year: 2021, type: 'LORRY', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '471926C0644384', chassisNumber: 'NMB96423112209235' },
    { id: 'v_kt_25', plate: '60 BP 934', brand: 'Mercedes', model: 'Arocs Damperli Kamyon 4148', year: 2021, type: 'LORRY', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '471926C0644355', chassisNumber: 'NMB96423112209181' },
    { id: 'v_kt_26', plate: '60 HE 380', brand: 'Desoto', model: 'Dodge AS950 Damperli Kamyon', year: 1997, type: 'LORRY', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: 'YD9A420T9058C', chassisNumber: 'NLCK6CCCCV0128909' },
    { id: 'v_kt_27', plate: '60 BD 067', brand: 'Çuhadar', model: 'Yarı Römork Treyler', year: 2015, type: 'OTHER', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '-', chassisNumber: 'NP9CTS3TNFC131028' },
    { id: 'v_kt_28', plate: '60 ADG 565', brand: 'Ali Rıza Usta', model: 'Yarı Römork Tanker Kasa', year: 2004, type: 'OTHER', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '-', chassisNumber: '099' },
    { id: 'v_kt_29', plate: '60 ACG 379', brand: 'Takdir Marka', model: 'Yarı Römork Damper', year: 2008, type: 'OTHER', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM', engineNumber: '-', chassisNumber: 'NP9T3DY26811066185' },
];

const PERSONNEL: any[] = [];

const CORRESPONDENCES: any[] = [];

// --- MAIN SEED FUNCTION ---

async function main() {
    console.log('Start seeding ...')

    // 1. Companies
    for (const company of COMPANIES) {
        await prisma.company.upsert({
            where: { id: company.id },
            update: {},
            create: {
                id: company.id,
                name: company.name,
                logoUrl: company.logoUrl,
                address: company.address,
            }
        })
    }

    // 2. Sites
    for (const site of SITES) {
        await prisma.site.upsert({
            where: { id: site.id },
            update: {},
            create: {
                id: site.id,
                companyId: site.companyId,
                name: site.name,
                location: site.location,
                status: site.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
                partnershipPercentage: site.partnershipPercentage,
            }
        })
    }

    // 3. Vehicles
    for (const vehicle of VEHICLES) {
        const vType = vehicle.type as any;
        const vStatus = vehicle.status as any;
        const vOwnership = vehicle.ownership as any;

        await prisma.vehicle.upsert({
            where: { id: vehicle.id },
            update: {
                plate: vehicle.plate,
                type: vType,
                brand: vehicle.brand,
                model: vehicle.model,
                year: vehicle.year,
                engineNumber: vehicle.engineNumber,
                chassisNumber: vehicle.chassisNumber,
                ownership: vOwnership,
                companyId: vehicle.companyId
            },
            create: {
                id: vehicle.id,
                companyId: vehicle.companyId,
                plate: vehicle.plate,
                brand: vehicle.brand,
                model: vehicle.model,
                year: vehicle.year,
                type: vType,
                meterType: vehicle.meterType,
                currentKm: vehicle.currentKm,
                insuranceExpiry: vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry) : null,
                kaskoExpiry: vehicle.kaskoExpiry ? new Date(vehicle.kaskoExpiry) : null,
                status: vStatus,
                assignedSiteId: vehicle.assignedSiteId,
                ownership: vOwnership,
                engineNumber: vehicle.engineNumber,
                chassisNumber: vehicle.chassisNumber,
            }
        })
    }

    // 4. Users
    for (const user of USERS) {
        const uRole = user.role as any;

        await prisma.user.upsert({
            where: { id: user.id },
            update: {},
            create: {
                id: user.id,
                name: user.name,
                username: user.username,
                password: user.password,
                email: user.email,
                role: uRole,
                permissions: user.permissions as any,
                editLookbackDays: (user as any).editLookbackDays,
                assignedCompanies: {
                    connect: user.assignedCompanyIds.map((id) => ({ id }))
                },
                assignedSites: {
                    connect: user.assignedSiteIds.map((id) => ({ id }))
                }
            }
        })
    }

    // 5. Personnel
    for (const p of PERSONNEL) {
        await prisma.personnel.upsert({
            where: { id: p.id },
            update: {},
            create: {
                id: p.id,
                fullName: p.fullName,
                tcNumber: p.tcNumber,
                profession: p.profession,
                role: p.role,
                salary: p.salary,
                siteId: p.siteId,
                category: p.category,
                note: p.note,
            }
        })
    }

    // 6. Correspondence
    for (const c of CORRESPONDENCES) {
        await prisma.correspondence.upsert({
            where: { id: c.id },
            update: {},
            create: {
                id: c.id,
                companyId: c.companyId,
                date: new Date(c.date),
                direction: c.direction,
                type: c.type,
                subject: c.subject,
                description: c.description,
                referenceNumber: c.referenceNumber,
                senderReceiver: c.senderReceiver,
                attachmentUrls: c.attachmentUrls || [],
                createdByUserId: c.createdByUserId,
            }
        })
    }

    // 7. Insurance Companies
    const INSURANCE_COMPANIES = [
        "AK SİGORTA",
        "ALLIANZ SİGORTA",
        "ANADOLU SİGORTA",
        "ANKARA SİGORTA",
        "AXA SİGORTA",
        "BEREKET SİGORTA",
        "DOĞA SİGORTA",
        "EMAA SİGORTA",
        "HDI SİGORTA",
        "HEPİYİ SİGORTA",
        "MAGDEBURGER SİGORTA",
        "NEOVA SİGORTA",
        "QUICK SİGORTA",
        "RAY SİGORTA",
        "SOMPO JAPON SİGORTA",
        "TÜRK NİPPON",
        "TÜRKİYE KATILIM SİGORTA",
        "TÜRKİYE SİGORTA",
        "UNICO SİGORTA"
    ];

    for (const name of INSURANCE_COMPANIES) {
        const exists = await prisma.institution.findFirst({
            where: { name, category: 'INSURANCE_COMPANY' }
        });
        if (!exists) {
            await prisma.institution.create({
                data: {
                    name,
                    category: 'INSURANCE_COMPANY'
                }
            });
        }
    }

    // 8. Insurance Agencies
    const INSURANCE_AGENCIES = [
        "ADİN ULUĞ",
        "ARMANTE SİGORTA",
        "AYKUT GÖLPINAR",
        "CANTAŞ SİGORTA",
        "CEMAL ŞEN",
        "EMİN KATILIM SİGORTA",
        "HAKAN ÖZDEMİR",
        "HARUN GÜN",
        "HİDAY SİGORTA (TAŞIT)",
        "İSA ANTEPLİ",
        "İŞ BANKASI",
        "KASIM GAZİ DIRICAN",
        "KESKİNLER SİGORTA",
        "MELİH EKİNCİ",
        "MURAT AKMAN",
        "NİKA SİGORTA",
        "ÖMER FARUK ÖZDEMİR",
        "SELİN ARSLAN (İSTANBUL)",
        "SİGORTAM ÇANAKKALE",
        "ŞAHİN KARAKILINÇ",
        "YİĞİT SİGORTA",
        "ZİRAAT KATILIM BANKASI"
    ];

    for (const name of INSURANCE_AGENCIES) {
        const exists = await prisma.institution.findFirst({
            where: { name, category: 'INSURANCE_AGENCY' }
        });
        if (!exists) {
            await prisma.institution.create({
                data: {
                    name,
                    category: 'INSURANCE_AGENCY'
                }
            });
        }
    }

    console.log('Seeding finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
