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
    // İKİKAT Vehicles
    { id: 'v_ik_1', plate: '06 CIG 90', brand: 'HIDROMEK', model: 'HMK 102S', year: 2006, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS' },
    { id: 'v_ik_2', plate: '06 GEY 72', brand: 'HITACHI', model: '200 LC', year: 2007, type: 'EXCAVATOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS' },
    { id: 'v_ik_3', plate: '60 ES 765', brand: 'SKODA', model: 'Octavia', year: 2014, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_ik_4', plate: '60 BP 166', brand: 'FIAT', model: 'Symbol', year: 2011, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_ik_5', plate: '60 ADG 721', brand: 'FIAT', model: 'Egea', year: 2017, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_ik_6', plate: '60 ACN 101', brand: 'DACIA', model: 'Duster', year: 2012, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_ik_7', plate: '60 ADH 729', brand: 'DACIA', model: 'Duster', year: 2022, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_ik_8', plate: '60 ADH 964', brand: 'DACIA', model: 'Duster', year: 2022, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_ik_9', plate: '60 ADH 750', brand: 'DACIA', model: 'Duster', year: 2022, type: 'CAR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_ik_10', plate: '60 BG 225', brand: 'MASSEY FERGUSON', model: '398', year: 1997, type: 'TRACTOR', companyId: 'comp_ikikat', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS' },

    // KAD-TEM Vehicles
    { id: 'v_kt_1', plate: '60 AAE 458', brand: 'MERCEDES', model: 'CLA 200', year: 2013, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_2', plate: '60 ACV 721', brand: 'HONDA', model: 'PCX', year: 2014, type: 'OTHER', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_3', plate: '06 DU 1084', brand: 'HIDROMEK', model: '140 W', year: 1997, type: 'EXCAVATOR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS' },
    { id: 'v_kt_4', plate: '06 DU 140661', brand: 'HIDROMEK', model: '200 W', year: 2010, type: 'EXCAVATOR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS' },
    { id: 'v_kt_5', plate: '54 ADU 144', brand: 'CITROEN', model: 'AMI', year: 2022, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_6', plate: '06 BIZ 067', brand: 'VW', model: 'Golf', year: 2011, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_7', plate: '06 HB 0878', brand: 'VW', model: 'Caddy', year: 2015, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_8', plate: '60 HN 450', brand: 'RENAULT', model: 'Fluence', year: 2013, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_9', plate: '60 AAH 991', brand: 'OPEL', model: 'Corsa', year: 2011, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_10', plate: '60 HP 555', brand: 'RENAULT', model: 'Symbol', year: 2011, type: 'CAR', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },

    // Kamyons / Trucks
    { id: 'v_kt_11', plate: '06 AJ 485', brand: 'FORD', model: 'M550 Kamyonet', year: 2006, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_12', plate: '06 AUT 444', brand: 'FORD', model: 'Transit', year: 2013, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_13', plate: '60 AFA 401', brand: 'FORD', model: 'Transit', year: 2012, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_14', plate: '06 AU 3649', brand: 'MERCEDES', model: 'Sprinter', year: 2015, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_15', plate: '06 BF 042', brand: 'MERCEDES', model: 'Arocs', year: 2018, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_16', plate: '06 BF 546', brand: 'MERCEDES', model: 'Arocs', year: 2018, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_17', plate: '06 BF 544', brand: 'MERCEDES', model: 'Arocs', year: 2018, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_18', plate: '06 BF 952', brand: 'MERCEDES', model: 'Arocs', year: 2021, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_19', plate: '06 BF 954', brand: 'MERCEDES', model: 'Arocs', year: 2021, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_20', plate: '06 BU 280', brand: 'DODGE', model: 'AS 950', year: 2016, type: 'TRUCK', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'KM' },
    { id: 'v_kt_21', plate: '45 M 0860', brand: 'ÇUKUROVA', model: 'Forklift', year: 1997, type: 'OTHER', companyId: 'comp_kadtem', status: 'ACTIVE', ownership: 'OWNED', currentKm: 0, meterType: 'HOURS' },
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
            update: {},
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
