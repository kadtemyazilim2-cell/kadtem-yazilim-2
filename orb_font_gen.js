
const fs = require('fs');
const path = require('path');

const boldPath = path.join('src', 'assets', 'fonts', 'Roboto-Bold.ttf');
const regularPath = path.join('src', 'assets', 'fonts', 'Roboto-Regular.ttf');

function toBase64(filePath) {
    try {
        const fileData = fs.readFileSync(filePath);
        return fileData.toString('base64');
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e.message);
        return null;
    }
}

const boldBase64 = toBase64(boldPath);
const regularBase64 = toBase64(regularPath);

if (!boldBase64 || !regularBase64) {
    console.error('Failed to read font files');
    process.exit(1);
}

const fileContent = `import { jsPDF } from "jspdf";

const fontBase64 = "${regularBase64}";
const fontBoldBase64 = "${boldBase64}";

export const addTurkishFont = (doc: jsPDF) => {
    // Regular
    doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal", "Identity-H");

    // Bold
    doc.addFileToVFS("Roboto-Bold.ttf", fontBoldBase64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold", "Identity-H");

    return "Roboto";
};
`;

const outputPath = path.join('src', 'lib', 'pdf-font.ts');
fs.writeFileSync(outputPath, fileContent);
console.log(`Successfully wrote to ${outputPath}`);
