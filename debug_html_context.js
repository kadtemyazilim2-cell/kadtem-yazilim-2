
const fs = require('fs');

const htmlPath = 'C:\\Users\\Drone\\Desktop\\benzer iş grupları\\yakıt zile\\zile yakıt.html'; // Use correct path
const content = fs.readFileSync(htmlPath, 'utf-8');

console.log('--- SEARCHING FOR "200.3" IN HTML ---');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('200.3') || line.toLowerCase().includes('hitachi')) {
        console.log(`Line ${index}: ${line.trim()}`);
        // context
        for (let i = 1; i <= 10; i++) {
            if (lines[index + i]) console.log(`  +${i}: ${lines[index + i].trim()}`);
        }
    }
});
