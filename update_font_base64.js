const fs = require('fs');
const path = require('path');

const fontPath = path.join(__dirname, 'src/assets/fonts/Roboto-Regular.ttf');
const outputPath = path.join(__dirname, 'src/lib/pdf-font.ts');

try {
    if (!fs.existsSync(fontPath)) {
        console.error('Font file not found at:', fontPath);
        // Try alternate path just in case
        const altPath = path.join(__dirname, 'assets/fonts/Roboto-Regular.ttf');
        if (fs.existsSync(altPath)) {
            console.log('Found at alternate path:', altPath);
            // Proceed with altPath
        } else {
            process.exit(1);
        }
    }

    const fontBuffer = fs.readFileSync(fontPath);
    const fontBase64 = fontBuffer.toString('base64');

    const tsContent = `import { jsPDF } from 'jspdf';\n\nexport const fontBase64 = '${fontBase64}';\n`;

    fs.writeFileSync(outputPath, tsContent);
    console.log('Successfully updated pdf-font.ts with base64 font data.');
} catch (error) {
    console.error('Error updating font file:', error);
    process.exit(1);
}
