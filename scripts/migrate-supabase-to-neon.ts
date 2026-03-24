import { Client } from 'pg';

const SUPABASE_URL = "postgresql://postgres.jgufxwawjgwaekadqgkp:Mki2323*Mki_@aws-1-eu-central-1.pooler.supabase.com:6543/postgres";
const NEON_URL = "postgresql://neondb_owner:npg_xqpvig1DBXV8@ep-delicate-frog-agqqgwbh.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

async function migrate() {
    const supabase = new Client({ connectionString: SUPABASE_URL });
    const neon = new Client({ connectionString: NEON_URL });

    try {
        await supabase.connect();
        await neon.connect();
        console.log("Connected to both databases.");

        // Order is critical for foreign keys
        const tables = [
            "RoleTemplate",
            "BusinessGroup",
            "YiUfeRate",
            "Institution",
            "VehicleTypeConsumption",
            "User",
            "Company",
            "Site",
            "SimilarWorkItem",
            "LimitValueCalculation",
            "Vehicle",
            "Personnel",
            "FuelTank",
            "FuelLog",
            "FuelTransfer",
            "PersonnelAttendance",
            "VehicleAttendance",
            "CashTransaction",
            "Correspondence",
            "VehicleAssignmentHistory",
            "SalaryAdjustment",
            "SitePartner",
            "_CompanyToUser",
            "_SiteToUser",
            "_PersonnelAssignedSites",
            "_AssignedSites"
        ];

        // 1. Truncate existing data on Neon in reverse order
        console.log("Truncating existing data on Neon in reverse order...");
        const tablesInReverse = [...tables].reverse();
        for (const table of tablesInReverse) {
             try {
                await neon.query(`TRUNCATE TABLE "${table}" CASCADE;`);
                console.log(`Truncated ${table}`);
             } catch (e: any) {
                console.log(`Skip truncate for ${table}: ${e.message}`);
             }
        }

        // 2. Migrate each table in order
        for (const table of tables) {
            console.log(`Migrating table: ${table}...`);
            try {
                const result = await supabase.query(`SELECT * FROM "${table}";`);
                const rows = result.rows;

                if (rows.length === 0) {
                    console.log(`Table ${table} is empty, skipping.`);
                    continue;
                }

                const columns = Object.keys(rows[0]).map(c => `"${c}"`).join(", ");
                const placeholders = Object.keys(rows[0]).map((_, i) => `$${i + 1}`).join(", ");
                const query = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`;

                let successCount = 0;
                let failCount = 0;

                for (const row of rows) {
                    const values = Object.values(row);
                    try {
                        await neon.query(query, values);
                        successCount++;
                    } catch (err: any) {
                        failCount++;
                        if (failCount < 5) { // Log first 5 errors to avoid flooding
                            console.error(`  [FAIL] ${table} row:`, err.message);
                        }
                    }
                }
                console.log(`Table ${table}: Migrated ${successCount} rows, ${failCount} failed.`);
            } catch (error: any) {
                console.error(`Error migrating table ${table}:`, error.message);
            }
        }

        console.log("Migration completed successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await supabase.end();
        await neon.end();
    }
}

migrate();
