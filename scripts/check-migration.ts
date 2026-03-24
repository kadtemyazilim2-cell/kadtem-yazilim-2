import { Client } from 'pg';

const NEON_URL = "postgresql://neondb_owner:npg_xqpvig1DBXV8@ep-delicate-frog-agqqgwbh.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

async function check() {
    const neon = new Client({ connectionString: NEON_URL });
    try {
        await neon.connect();
        const tables = ["User", "Company", "Site", "Vehicle", "Personnel", "FuelLog", "PersonnelAttendance", "VehicleAttendance", "CashTransaction", "Correspondence"];
        console.log("Neon Database Counts:");
        for (const table of tables) {
            const res = await neon.query(`SELECT COUNT(*) FROM "${table}";`);
            console.log(`${table}: ${res.rows[0].count}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await neon.end();
    }
}
check();
