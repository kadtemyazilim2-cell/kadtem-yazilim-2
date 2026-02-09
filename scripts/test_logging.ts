
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(process.cwd(), 'debug_transactions.txt');

try {
    console.log('Attempting to write to:', LOG_FILE);
    fs.appendFileSync(LOG_FILE, `[TEST] Manual write test at ${new Date().toISOString()}\n`);
    console.log('Write successful.');
} catch (e) {
    console.error('Write failed:', e);
}
