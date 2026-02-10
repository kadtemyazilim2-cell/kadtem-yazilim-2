
function simulateServerDate(inputDateString: string) {
    console.log(`Input: ${inputDateString}`);

    // Simulate "new Date(data.date)" behavior in Node (UTC if ISO string)
    const d = new Date(inputDateString);
    console.log(`Parsed Date (UTC): ${d.toISOString()}`);
    console.log(`Parsed Date (Local): ${d.toString()}`);

    // Simulate "startOfDay.setHours(0, 0, 0, 0)"
    d.setHours(0, 0, 0, 0);
    console.log(`After setHours(0,0,0,0) (UTC): ${d.toISOString()}`);
    console.log(`After setHours(0,0,0,0) (Local): ${d.toString()}`);

    return d;
}

// Test Cases
console.log('--- Test Case 1: Today (Feb 10) ISO from Client (UTC+3) ---');
// Client usually sends: "2026-02-10T00:00:00.000Z" (if they picked date and converted to ISO)
// OR "2026-02-10" (if date input value)
// Let's assume client sends strict ISO string for the date picked in UI

const clientDateToday = "2026-02-10T00:00:00.000Z";
simulateServerDate(clientDateToday);

console.log('\n--- Test Case 2: Yesterday (Feb 9) ISO from Client (UTC+3) ---');
const clientDateYesterday = "2026-02-09T00:00:00.000Z";
simulateServerDate(clientDateYesterday);

console.log('\n--- Test Case 3: Date String Only ---');
simulateServerDate("2026-02-10");
