import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Encode actual desktop captures into looping documentation previews.
const source = process.argv[2] || 'desktop/smoke-gifs';
for (const name of ['styles', 'zoom']) {
  const files = fs.readdirSync(source).filter(f => f.startsWith(`${name}-`) && f.endsWith('.png')).sort();
  if (!files.length) throw new Error(`No ${name} captures found`);
  const frames = [];
  let width, height;
  for (const file of files) {
    const { data, info } = await sharp(path.join(source, file)).resize({ width: 960 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    width = info.width; height = info.height;
    frames.push(data);
  }
  const output = `docs/images/${name}-demo.gif`;
  await sharp(Buffer.concat(frames), { raw: { width, height: height * frames.length, channels: 3, pageHeight: height } })
    .gif({ loop: 0, delay: name === 'styles' ? frames.map((_, i) => i % 5 === 0 ? 600 : 240) : 120, colours: 256, effort: 7, dither: 0.3 })
    .toFile(output);
  const metadata = await sharp(output, { animated: true }).metadata();
  console.log(JSON.stringify({ output, frames: metadata.pages, width: metadata.width, height: metadata.pageHeight, bytes: fs.statSync(output).size }));
}
