// Generates public/icon-192.png and public/icon-512.png: a simple "3 pockets"
// mark (three coin-like circles on a rounded plate) rendered as raw RGBA
// pixels and PNG-encoded by hand, using only Node's built-in zlib — no
// image/canvas dependency needed for a placeholder icon.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLORS = {
  background: [0x10, 0x1a, 0x30], // --background
  plate: [0x25, 0x63, 0xeb], // --color-brand-600
  plateBorder: [0x1d, 0x4e, 0xd8], // --color-brand-700
  spend: [0xef, 0xf6, 0xff], // --color-brand-50
  savings: [0x14, 0xb8, 0xa6], // --color-teal-500
  investments: [0xf5, 0x9e, 0x0b], // --color-gold-500
};

function hexToRgb([r, g, b]) {
  return { r, g, b };
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function roundedRectMask(x, y, size, padding, radius) {
  const min = padding;
  const max = size - padding;
  if (x < min || x >= max || y < min || y >= max) return false;

  const nearLeft = x < min + radius;
  const nearRight = x >= max - radius;
  const nearTop = y < min + radius;
  const nearBottom = y >= max - radius;

  if (nearLeft && nearTop) return distance(x, y, min + radius, min + radius) <= radius;
  if (nearRight && nearTop) return distance(x, y, max - radius, min + radius) <= radius;
  if (nearLeft && nearBottom) return distance(x, y, min + radius, max - radius) <= radius;
  if (nearRight && nearBottom) return distance(x, y, max - radius, max - radius) <= radius;
  return true;
}

function buildIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const padding = size * 0.08;
  const radius = size * 0.22;
  const borderWidth = size * 0.018;

  const coinRadius = size * 0.135;
  const coinY = size * 0.5;
  const coinXs = [size * 0.315, size * 0.5, size * 0.685];
  const coinColors = [COLORS.spend, COLORS.savings, COLORS.investments];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = COLORS.background;

      if (roundedRectMask(x, y, size, padding, radius)) {
        color = roundedRectMask(x, y, size, padding + borderWidth, radius - borderWidth)
          ? COLORS.plate
          : COLORS.plateBorder;
      }

      for (let i = 0; i < coinXs.length; i++) {
        if (distance(x, y, coinXs[i], coinY) <= coinRadius) {
          color = coinColors[i];
        }
      }

      const { r, g, b } = hexToRgb(color);
      const offset = (y * size + x) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);

  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

function encodePng(pixels, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type: none
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "public");
for (const size of [192, 512]) {
  const png = encodePng(buildIcon(size), size);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.length} bytes)`);
}
