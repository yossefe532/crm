const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const INPUT_FILE = path.join(__dirname, '../public/logo.png');
const PUBLIC_DIR = path.join(__dirname, '../public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

async function generateIcons() {
  try {
    if (!fs.existsSync(INPUT_FILE)) {
      console.error('❌ Error: public/logo.png not found!');
      console.log('👉 Please place your logo image at web/public/logo.png and run this script again.');
      process.exit(1);
    }

    console.log('🎨 Reading logo from public/logo.png...');
    const image = await Jimp.read(INPUT_FILE);

    // Ensure icons directory exists
    if (!fs.existsSync(ICONS_DIR)) {
      fs.mkdirSync(ICONS_DIR, { recursive: true });
    }

    // Generate PWA icons
    console.log('⚙️  Generating PWA icons...');
    
    // 192x192
    await image.clone().resize({ w: 192, h: 192 }).write(path.join(ICONS_DIR, 'icon-192x192.png'));
    console.log('✅ Generated icon-192x192.png');

    // 512x512
    await image.clone().resize({ w: 512, h: 512 }).write(path.join(ICONS_DIR, 'icon-512x512.png'));
    console.log('✅ Generated icon-512x512.png');
    
    // Maskable (usually with padding, but for now just resize)
    await image.clone().resize({ w: 512, h: 512 }).write(path.join(ICONS_DIR, 'maskable-icon.png'));
    console.log('✅ Generated maskable-icon.png');

    // Favicon (32x32)
    await image.clone().resize({ w: 32, h: 32 }).write(path.join(PUBLIC_DIR, 'favicon-32x32.png'));
    console.log('✅ Generated favicon-32x32.png');

    console.log('🎉 All icons generated successfully!');
    console.log('👉 Make sure your manifest.json and layout.tsx are updated to point to these files.');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
