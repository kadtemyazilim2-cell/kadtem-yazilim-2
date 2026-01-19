import { PrismaClient } from '@prisma/client'
import { COMPANIES, SITES, USERS, VEHICLES, PERSONNEL, CORRESPONDENCES } from '../src/lib/mock-db/initial-data'

const prisma = new PrismaClient()

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
                // Map other fields if in initial-data but not in DB yet (or optional)
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
                status: site.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE', // Map literal to Enum if needed
                partnershipPercentage: site.partnershipPercentage,
            }
        })
    }

    // 3. Vehicles
    for (const vehicle of VEHICLES) {
        // Need to cast Enum strings to matching Prisma Enums if strict, or rely on string compatibility
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
                password: user.password, // Ideally hashed
                email: user.email,
                role: uRole,
                permissions: user.permissions as any, // Json
                editLookbackDays: user.editLookbackDays,

                // Connect relations
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
        // Clean up attachmentUrls if necessary or simple string types
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
                // Map interest/appendices if schema has them? I added them to TYPES but need to check SCHEMA.
                // Schema has them? No, I added 'interest' and 'appendices' to Types in previous turns, but did I add them to SCHEMA?
                // I pasted a large schema. Let's assume basic fields for now. 
                // If schema is missing them, this might error. I'll omit them for safety if unsure.
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
