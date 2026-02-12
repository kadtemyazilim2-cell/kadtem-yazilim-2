// Migration script: Supabase → Neon (v2 - no global transaction)
// Usage: node scripts/migrate-supabase-to-neon.mjs

import pg from 'pg';
const { Client } = pg;

const SUPABASE_URL = 'postgresql://postgres.jgufxwawjgwaekadqgkp:Mki2323*Mki_@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
const NEON_URL = 'postgresql://neondb_owner:npg_xqpvig1DBXV8@ep-delicate-frog-agqqgwbh.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

// Tables in dependency order (parents first)
const TABLES = [
    '"User"',
    '"RoleTemplate"',
    '"Company"',
    '"YiUfeRate"',
    '"Institution"',
    '"BusinessGroup"',
    '"Site"',
    '"SitePartner"',
    '"SimilarWorkItem"',
    '"Vehicle"',
    '"Personnel"',
    '"FuelTank"',
    '"SiteLogEntry"',
    '"VehicleAssignmentHistory"',
    '"VehicleAttendance"',
    '"SalaryAdjustment"',
    '"PersonnelAttendance"',
    '"FuelLog"',
    '"FuelTransfer"',
    '"CashTransaction"',
    '"Correspondence"',
    '"LimitValueCalculation"',
];

// Implicit many-to-many join tables
const JOIN_TABLES = [
    '"_CompanyToUser"',
    '"_SiteToUser"',
];

async function migrate() {
    const source = new Client({ connectionString: SUPABASE_URL });
    const target = new Client({ connectionString: NEON_URL });

    try {
        console.log('Connecting to Supabase...');
        await source.connect();
        console.log('Connecting to Neon...');
        await target.connect();

        const allTables = [...TABLES, ...JOIN_TABLES];

        for (const table of allTables) {
            try {
                const countRes = await source.query(`SELECT COUNT(*) as cnt FROM ${table}`);
                const count = parseInt(countRes.rows[0].cnt);

                if (count === 0) {
                    console.log(`⏭️  ${table}: 0 rows, skipping`);
                    continue;
                }

                const dataRes = await source.query(`SELECT * FROM ${table}`);
                const rows = dataRes.rows;
                if (rows.length === 0) continue;

                const columns = Object.keys(rows[0]);
                const colNames = columns.map(c => `"${c}"`).join(', ');
                const placeholderRow = columns.map((_, i) => `$${i + 1}`).join(', ');

                // Clear existing data (skip errors if empty)
                try { await target.query(`DELETE FROM ${table}`); } catch (e) { /* ignore */ }

                let inserted = 0;
                let errors = 0;

                for (const row of rows) {
                    const values = columns.map(c => {
                        const val = row[c];
                        // JSON fields: convert objects to JSON strings
                        if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val) && !Buffer.isBuffer(val)) {
                            return JSON.stringify(val);
                        }
                        return val;
                    });
                    try {
                        await target.query(
                            `INSERT INTO ${table} (${colNames}) VALUES (${placeholderRow}) ON CONFLICT DO NOTHING`,
                            values
                        );
                        inserted++;
                    } catch (err) {
                        errors++;
                        if (errors <= 3) {
                            console.error(`  ⚠️  ${table} row error: ${err.message.substring(0, 100)}`);
                        }
                    }
                }

                const status = errors === 0 ? '✅' : '⚠️';
                console.log(`${status} ${table}: ${inserted}/${count} rows migrated${errors > 0 ? ` (${errors} errors)` : ''}`);
            } catch (err) {
                console.error(`❌ ${table}: ${err.message}`);
            }
        }

        console.log('\n🎉 Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await source.end();
        await target.end();
    }
}

migrate();
