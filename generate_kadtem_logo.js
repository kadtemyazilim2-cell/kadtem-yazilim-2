const fs = require('fs');

const imagePath = 'C:/Users/Drone/.gemini/antigravity/brain/66fe567e-1f97-4556-b571-9da78fd8d8fa/uploaded_image_1767872380368.png';
const targetFile = 'src/lib/logos.ts';

try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');

    // Read existing file
    let content = fs.readFileSync(targetFile, 'utf8');

    // Append new logo
    content += `
export const KADTEM_LOGO_BASE64 = 'data:image/png;base64,${base64}';
`;

    fs.writeFileSync(targetFile, content);
    console.log('Successfully appended to logos.ts');
} catch (err) {
    console.error('Error processing image:', err);
    process.exit(1);
}
