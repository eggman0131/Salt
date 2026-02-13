#!/usr/bin/env node
/**
 * Icon Generator for SALT PWA
 * 
 * This script generates PNG icons from the SVG source.
 * You'll need to install sharp: npm install --save-dev sharp
 * 
 * Run: node scripts/generate-icons.js
 * 
 * For now, you can use online tools like:
 * - https://realfavicongenerator.net/
 * - https://www.pwabuilder.com/imageGenerator
 * 
 * Just upload public/icons/icon.svg and it will generate all required sizes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📱 SALT Icon Generator');
console.log('='.repeat(50));
console.log('');
console.log('To generate PWA icons, please install sharp:');
console.log('  npm install --save-dev sharp');
console.log('');
console.log('Or use online tools:');
console.log('  • https://realfavicongenerator.net/');
console.log('  • https://www.pwabuilder.com/imageGenerator');
console.log('');
console.log('Upload: public/icons/icon.svg');
console.log('Sizes needed: 72, 96, 128, 144, 152, 192, 384, 512');
console.log('');

// Check if sharp is available
try {
  const sharp = (await import('sharp')).default;
  const svgPath = path.join(__dirname, '../public/icons/icon.svg');
  const iconsDir = path.join(__dirname, '../public/icons');
  
  if (!fs.existsSync(svgPath)) {
    console.error('❌ SVG file not found:', svgPath);
    process.exit(1);
  }

  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  
  console.log('✨ Generating icons...');
  
  Promise.all(
    sizes.map(async (size) => {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`  ✓ Generated ${size}x${size}`);
    })
  ).then(() => {
    console.log('');
    console.log('✅ All icons generated successfully!');
  }).catch((err) => {
    console.error('❌ Error generating icons:', err);
    process.exit(1);
  });

} catch (err) {
  console.log('⚠️  Sharp not installed. Icons not generated.');
  console.log('    Install with: npm install --save-dev sharp');
  console.log('    Then run: node scripts/generate-icons.js');
}
