const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = process.cwd();
const publicDir = path.join(root, 'public');
const source = path.join(publicDir, 'barakah-icon.svg');

async function main() {
  if (!fs.existsSync(source)) throw new Error('Barakah source icon not found');

  await sharp(source).resize(192, 192, { fit: 'cover' }).png()
    .toFile(path.join(publicDir, 'barakah-icon-192.png'));

  await sharp(source).resize(512, 512, { fit: 'cover' }).png()
    .toFile(path.join(publicDir, 'barakah-icon-512.png'));

  const maskable = await sharp(source).resize(410, 410, { fit: 'contain' }).png().toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  }).composite([{ input: maskable, gravity: 'center' }]).png()
    .toFile(path.join(publicDir, 'barakah-icon-512-maskable.png'));
}

main().catch((error) => {
  console.error('[PWA icons] generation failed:', error);
  process.exit(1);
});
