
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'scraped_attendance.json');
if (fs.existsSync(dataPath)) {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const zileData = data.filter(d => d.siteName.includes('Zile'));
    console.log('Zile Blocks:', zileData.length);
    if (zileData.length > 0) {
        console.log('Sample Zile Vehicles:', zileData[0].rows.map(r => r.vehicleInfo));
    }
}
