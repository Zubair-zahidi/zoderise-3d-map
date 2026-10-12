import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { BROWSER_HEADERS } from '../build/vite.js';
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'desktop/browser-build'], { stdio: 'inherit', env: { ...process.env, GOOGLE_MAPS_API_KEY: '__ZODERISE_GOOGLE_KEY__', CESIUM_ION_TOKEN: '__ZODERISE_CESIUM_TOKEN__' } });
fs.mkdirSync('desktop/runtime', { recursive: true });
fs.cpSync('desktop/browser-build', 'desktop/runtime/dist', { recursive: true });
for (const dir of ['server', 'src', 'build', 'scripts', 'config']) {
  fs.cpSync(dir, `desktop/runtime/${dir}`, { recursive: true, filter: p => !/\.test\./.test(p) });
}
fs.copyFileSync('LICENSE', 'desktop/runtime/LICENSE');
fs.writeFileSync('desktop/runtime/package.json', '{"type":"module"}\n');
fs.writeFileSync('desktop/runtime/headers.js', `export const BROWSER_HEADERS = ${JSON.stringify(BROWSER_HEADERS)};\n`);
const png = await sharp('public/logo.svg').resize(256, 256).png().toBuffer();
fs.writeFileSync('desktop/icon.png', png);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[8] = 0; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync('desktop/icon.ico', Buffer.concat([header, png]));
