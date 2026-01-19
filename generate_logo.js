const fs = require('fs');

const imagePath = 'C:/Users/Drone/.gemini/antigravity/brain/66fe567e-1f97-4556-b571-9da78fd8d8fa/uploaded_image_1767871982711.png';
const targetFile = 'src/lib/logos.ts';

try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');

    // Create TS file
    const content = `// Auto-generated logo file
export const IKIKAT_LOGO_BASE64 = 'data:image/png;base64,${base64}';
`;

    fs.writeFileSync(targetFile, content);
    console.log('Successfully created logos.ts');
} catch (err) {
    console.error('Error processing image:', err);
    process.exit(1);
}
