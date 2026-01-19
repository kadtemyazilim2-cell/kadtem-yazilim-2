import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// --- INLINED DATA ---

const COMPANIES = [
    { id: 'c1', name: 'Alpha İnşaat', logoUrl: '/logos/alpha.png', address: 'Istanbul' },
    { id: 'c2', name: 'Beta Yapı', logoUrl: '/logos/beta.png', address: 'Ankara' },
    { id: 'c3', name: 'Gamma Mimarlık', logoUrl: '/logos/gamma.png', address: 'Izmir' },
    { id: 'c4', name: 'Delta Taahhüt', logoUrl: '/logos/delta.png', address: 'Bursa' },
    { id: 'c5', name: 'Epsilon Hafriyat', logoUrl: '/logos/epsilon.png', address: 'Antalya' },
    { id: 'c6', name: 'Omega Lojistik', logoUrl: '/logos/omega.png', address: 'Kocaeli' },
    { id: 'c7', name: 'İkikat İnşaat', logoUrl: '/logos/ikikat.png', address: 'Tokat' },
    { id: 'c8', name: 'KAD-TEM MÜHENDİSLİK', logoUrl: '/logos/kadtem.png', address: 'Tokat' },
];

const SITES = [
    { id: 's1', companyId: 'c1', name: 'Kadıköy Konut Projesi', location: 'Istanbul/Kadikoy', status: 'ACTIVE', partnershipPercentage: 100 },
    { id: 's2', companyId: 'c1', name: 'Levent Ofis Blokları', location: 'Istanbul/Levent', status: 'ACTIVE', partnershipPercentage: 100 },
    { id: 's3', companyId: 'c2', name: 'Ankara Hastane İnşaatı', location: 'Ankara/Cankaya', status: 'ACTIVE', partnershipPercentage: 100 },
    { id: 's4', companyId: 'c3', name: 'İzmir Marina', location: 'Izmir/Alsancak', status: 'COMPLETED', partnershipPercentage: 100 },
];

const USERS = [
    {
        id: 'u1', name: 'Sistem Yöneticisi', username: 'admin', password: '123', email: 'admin@system.com', role: 'ADMIN',
        assignedCompanyIds: [], assignedSiteIds: [], permissions: {}
    },
    {
        id: 'u2', name: 'Ahmet Yılmaz', username: 'ahmet', password: '123', email: 'ahmet@alpha.com', role: 'MANAGER',
        assignedCompanyIds: ['c1'], assignedSiteIds: ['s1', 's2'],
        permissions: { 'correspondence': ['VIEW', 'CREATE', 'EDIT'], 'vehicles': ['VIEW', 'CREATE', 'EDIT'], 'fuel': ['VIEW', 'CREATE', 'EDIT'], 'cash-book': ['VIEW', 'CREATE', 'EDIT'], 'personnel': ['VIEW', 'CREATE', 'EDIT'], 'vehicle-attendance': ['VIEW', 'CREATE', 'EDIT'], 'site-log': ['VIEW', 'CREATE', 'EDIT'] },
        editLookbackDays: 3
    },
    {
        id: 'u3', name: 'Mehmet Öz', username: 'mehmet', password: '123', email: 'mehmet@alpha.com', role: 'SITE_MANAGER',
        assignedCompanyIds: ['c1'], assignedSiteIds: ['s1'],
        permissions: { 'personnel': ['VIEW'], 'vehicle-attendance': ['VIEW'], 'site-log': ['VIEW'] }
    },
    {
        id: 'u4', name: 'Ali Kaya', username: 'ali', password: '123', email: 'ali@alpha.com', role: 'USER',
        assignedCompanyIds: ['c1'], assignedSiteIds: ['s1'], permissions: {}
    },
];

const VEHICLES = [
    { id: 'v1', companyId: 'c1', plate: '34 ABC 123', brand: 'Mercedes', model: 'Actros', year: 2022, type: 'TRUCK', meterType: 'KM', currentKm: 120500, insuranceExpiry: '2026-06-01', kaskoExpiry: '2026-06-01', status: 'ACTIVE', assignedSiteId: 's1', ownership: 'OWNED' },
    { id: 'v2', companyId: 'c1', plate: '34 XYZ 789', brand: 'Ford', model: 'Transit', year: 2022, type: 'CAR', meterType: 'KM', currentKm: 45000, insuranceExpiry: '2024-05-20', kaskoExpiry: '2024-05-20', status: 'ACTIVE', assignedSiteId: 's1', ownership: 'OWNED' },
    { id: 'v3', companyId: 'c2', plate: '06 ABC 06', brand: 'Hitachi', model: 'ZX 350', year: 2021, type: 'EXCAVATOR', meterType: 'HOURS', currentKm: 4500, insuranceExpiry: '2024-08-15', kaskoExpiry: '2024-08-15', status: 'ACTIVE', assignedSiteId: 's2', ownership: 'OWNED' },
];

const PERSONNEL = [
    { id: 'p1', fullName: 'Ali Yılmaz', tcNumber: '12345678901', profession: 'İnşaat Mühendisi', role: 'Şantiye Şefi', salary: 35000, siteId: 's1', category: 'TECHNICAL', note: 'Tecrübeli personel.' },
    { id: 'p2', fullName: 'Mehmet Demir', tcNumber: '98765432109', profession: 'Kalıp Ustası', role: 'Usta', salary: 25000, siteId: 's1', category: 'FIELD', note: '' }
];

const CORRESPONDENCES = [
    { id: 'doc1', companyId: 'c1', date: '2024-01-10', direction: 'OUTGOING', type: 'OFFICIAL', subject: 'Kazı İzni Başvurusu Hakkında', description: 'Kadıköy projesi için kazı izni talep yazısı.', referenceNumber: '', senderReceiver: 'Kadıköy Belediyesi', createdByUserId: 'u2' },
    { id: 'doc2', companyId: 'c1', date: '2024-01-15', direction: 'INCOMING', type: 'OFFICIAL', subject: 'Yapı Denetim Raporu', description: 'Ocak ayı 1. hafta raporu.', referenceNumber: 'YAPI-24-05', senderReceiver: 'Denetim Firması A.Ş.', createdByUserId: 'u2' },
    { id: 'c-example-permanent', companyId: 'c7', date: '2026-01-09T16:52:00', direction: 'OUTGOING', type: 'OFFICIAL', subject: 'Teminat Mektubu Süre Uzatımı', description: 'Tarafımızdan istemiş olduğunuz kesin teminat mektubu süre uzatım yazıları yazımız ekinde sunulmuştur.\nGereğini saygılarımızla arz ederiz.', referenceNumber: '2026/05', senderReceiver: 'İl Özel İdaresi Genel Sekreterliği\nDestek Hizmetleri Müdürlüğü\'ne', createdByUserId: 'u2', attachmentUrls: [] }
];

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
                editLookbackDays: user.editLookbackDays,
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
