import { Client } from 'pg';

const SUPABASE_URL = "postgresql://postgres.jgufxwawjgwaekadqgkp:Mki2323*Mki_@aws-1-eu-central-1.pooler.supabase.com:6543/postgres";
const NEON_URL = "postgresql://neondb_owner:npg_xqpvig1DBXV8@ep-delicate-frog-agqqgwbh.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

async function compare() {
    const supabase = new Client({ connectionString: SUPABASE_URL });
    const neon = new Client({ connectionString: NEON_URL });
    try {
        await supabase.connect();
        await neon.connect();
        const tables = ["User", "Company", "Site", "Vehicle", "Personnel", "FuelLog", "PersonnelAttendance", "VehicleAttendance", "CashTransaction", "Correspondence"];
        console.log("Database Comparison (Supabase vs Neon):");
        for (const table of tables) {
            const resSupabase = await supabase.query(`SELECT COUNT(*) FROM "${table}";`);
            const resNeon = await neon.query(`SELECT COUNT(*) FROM "${table}";`);
            console.log(`${table}: Supabase=${resSupabase.rows[0].count}, Neon=${resNeon.rows[0].count}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await supabase.end();
        await neon.end();
    }
}
compare();
