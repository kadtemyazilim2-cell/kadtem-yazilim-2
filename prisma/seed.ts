import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// --- INLINED DATA ---

const COMPANIES: any[] = [];

const SITES: any[] = [];

const USERS = [
    {
        id: 'u1', name: 'Sistem Yöneticisi', username: 'admin', password: '123', email: 'admin@system.com', role: 'ADMIN',
        assignedCompanyIds: [], assignedSiteIds: [], permissions: {}
    }
];

const VEHICLES: any[] = [];

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
