import { Company, Site, User, Vehicle, Correspondence, Personnel } from "../types";

export const COMPANIES: Company[] = [
    { id: 'c1', name: 'Alpha İnşaat', logoUrl: '/logos/alpha.png', address: 'Istanbul' },
    { id: 'c2', name: 'Beta Yapı', logoUrl: '/logos/beta.png', address: 'Ankara' },
    { id: 'c3', name: 'Gamma Mimarlık', logoUrl: '/logos/gamma.png', address: 'Izmir' },
    { id: 'c4', name: 'Delta Taahhüt', logoUrl: '/logos/delta.png', address: 'Bursa' },
    { id: 'c5', name: 'Epsilon Hafriyat', logoUrl: '/logos/epsilon.png', address: 'Antalya' },
    { id: 'c6', name: 'Omega Lojistik', logoUrl: '/logos/omega.png', address: 'Kocaeli' },
    { id: 'c7', name: 'İkikat İnşaat', logoUrl: '/logos/ikikat.png', address: 'Tokat' },
    { id: 'c8', name: 'KAD-TEM MÜHENDİSLİK', logoUrl: '/logos/kadtem.png', address: 'Tokat' },
];

export const SITES: Site[] = [
    { id: 's1', companyId: 'c1', name: 'Kadıköy Konut Projesi', location: 'Istanbul/Kadikoy', status: 'ACTIVE', partnershipPercentage: 100 },
    { id: 's2', companyId: 'c1', name: 'Levent Ofis Blokları', location: 'Istanbul/Levent', status: 'ACTIVE', partnershipPercentage: 100 },
    { id: 's3', companyId: 'c2', name: 'Ankara Hastane İnşaatı', location: 'Ankara/Cankaya', status: 'ACTIVE', partnershipPercentage: 100 },
    { id: 's4', companyId: 'c3', name: 'İzmir Marina', location: 'Izmir/Alsancak', status: 'COMPLETED', partnershipPercentage: 100 },
];

export const USERS: User[] = [
    {
        id: 'u1',
        name: 'Sistem Yöneticisi',
        username: 'admin',
        password: '123',
        email: 'admin@system.com',
        role: 'ADMIN',
        assignedCompanyIds: [],
        assignedSiteIds: [],
        permissions: {}
    },
    {
        id: 'u2',
        name: 'Ahmet Yılmaz',
        username: 'ahmet',
        password: '123',
        email: 'ahmet@alpha.com',
        role: 'MANAGER',
        assignedCompanyIds: ['c1'],
        assignedSiteIds: ['s1', 's2'],
        permissions: {
            'correspondence': ['VIEW', 'CREATE', 'EDIT'],
            'vehicles': ['VIEW', 'CREATE', 'EDIT'],
            'fuel': ['VIEW', 'CREATE', 'EDIT'],
            'cash-book': ['VIEW', 'CREATE', 'EDIT'],
            'personnel': ['VIEW', 'CREATE', 'EDIT'],
            'vehicle-attendance': ['VIEW', 'CREATE', 'EDIT'],
            'site-log': ['VIEW', 'CREATE', 'EDIT']
        },
        editLookbackDays: 3 // [NEW] Restrict editing to last 3 days
    },
    {
        id: 'u3',
        name: 'Mehmet Öz',
        username: 'mehmet',
        password: '123',
        email: 'mehmet@alpha.com',
        role: 'SITE_MANAGER',
        assignedCompanyIds: ['c1'],
        assignedSiteIds: ['s1'],
        permissions: {
            'personnel': ['VIEW'],
            'vehicle-attendance': ['VIEW'],
            'site-log': ['VIEW']
        }
    },
    {
        id: 'u4',
        name: 'Ali Kaya',
        username: 'ali',
        password: '123',
        email: 'ali@alpha.com',
        role: 'USER',
        assignedCompanyIds: ['c1'],
        assignedSiteIds: ['s1'],
        permissions: {}
    },
];

export const VEHICLES: Vehicle[] = [
    {
        id: 'v1',
        companyId: 'c1',
        plate: '34 ABC 123',
        brand: 'Mercedes',
        model: 'Actros',
        year: 2022,
        type: 'TRUCK',
        meterType: 'KM',
        currentKm: 120500,
        insuranceExpiry: '2026-06-01',
        kaskoExpiry: '2026-06-01',
        status: 'ACTIVE',
        assignedSiteId: 's1',
        ownership: 'OWNED'
    },
    {
        id: 'v2',
        companyId: 'c1',
        plate: '34 XYZ 789',
        brand: 'Ford',
        model: 'Transit',
        year: 2022,
        type: 'CAR',
        meterType: 'KM',
        currentKm: 45000,
        insuranceExpiry: '2024-05-20',
        kaskoExpiry: '2024-05-20',
        status: 'ACTIVE',
        assignedSiteId: 's1',
        ownership: 'OWNED'
    },
    {
        id: 'v3',
        companyId: 'c2',
        plate: '06 ABC 06',
        brand: 'Hitachi',
        model: 'ZX 350',
        year: 2021,
        type: 'EXCAVATOR',
        meterType: 'HOURS',
        currentKm: 4500,
        insuranceExpiry: '2024-08-15',
        kaskoExpiry: '2024-08-15',
        status: 'ACTIVE',
        assignedSiteId: 's2',
        ownership: 'OWNED'
    },
];

export const CORRESPONDENCES: Correspondence[] = [
    {
        id: 'doc1',
        companyId: 'c1',
        date: '2024-01-10',
        direction: 'OUTGOING',
        type: 'OFFICIAL',
        subject: 'Kazı İzni Başvurusu Hakkında',
        description: 'Kadıköy projesi için kazı izni talep yazısı.',
        referenceNumber: '',
        senderReceiver: 'Kadıköy Belediyesi',
        createdByUserId: 'u2'
    },
    {
        id: 'doc2',
        companyId: 'c1',
        date: '2024-01-15',
        direction: 'INCOMING',
        type: 'OFFICIAL',
        subject: 'Yapı Denetim Raporu',
        description: 'Ocak ayı 1. hafta raporu.',
        referenceNumber: 'YAPI-24-05',
        senderReceiver: 'Denetim Firması A.Ş.',
        createdByUserId: 'u2'
    },
    {
        id: 'c-example-permanent',
        companyId: 'c7', // İkikat İnşaat
        date: '2026-01-09T16:52:00',
        direction: 'OUTGOING',
        type: 'OFFICIAL',
        subject: 'Teminat Mektubu Süre Uzatımı',
        description: 'Tarafımızdan istemiş olduğunuz kesin teminat mektubu süre uzatım yazıları yazımız ekinde sunulmuştur.\nGereğini saygılarımızla arz ederiz.',
        referenceNumber: '2026/05',
        senderReceiver: 'İl Özel İdaresi Genel Sekreterliği\nDestek Hizmetleri Müdürlüğü\'ne',
        createdByUserId: 'u2',
        attachmentUrls: [],
        interest: [
            '30.05.2025 Tarihli yazı',
            '25.10.2025 Tarihli yazı ve ekleri'
        ],
        appendices: [
            '99-C2-45 seri numaralı kesin teminat mektubu süre uzatımı yazısı ve teyit formu',
            '99-C2-39 seri numaralı kesin teminat mektubu süre uzatımı yazısı ve teyit formu',
            '99-C2-44 seri numaralı kesin teminat mektubu süre uzatımı yazısı ve teyit formu'
        ]
    }
];

export const PERSONNEL: Personnel[] = [
    {
        id: 'p1',
        fullName: 'Ali Yılmaz',
        tcNumber: '12345678901',
        profession: 'İnşaat Mühendisi',
        role: 'Şantiye Şefi',
        salary: 35000,
        siteId: 's1',
        category: 'TECHNICAL',
        note: 'Tecrübeli personel.'
    },
    {
        id: 'p2',
        fullName: 'Mehmet Demir',
        tcNumber: '98765432109',
        profession: 'Kalıp Ustası',
        role: 'Usta',
        salary: 25000,
        siteId: 's1',
        category: 'FIELD',
        note: ''
    }
];
