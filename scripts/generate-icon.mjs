/**
 * Generates public/apple-touch-icon.png (180×180) using only Node.js built-ins.
 * Design: dark navy gradient background + 6 guitar strings + 4 fret lines.
 */

import { deflateSync } from "zlib";
import { writeFileSync } from "fs";

// ── CRC-32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG chunk helper ─────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

// ── Image dimensions ─────────────────────────────────────────────────────────
const W = 180;
const H = 180;

// ── Design constants ─────────────────────────────────────────────────────────
// 6 guitar strings — horizontal, evenly spaced in centre region
const STRING_YS = [52, 68, 84, 100, 116, 132];
// 4 fret lines — vertical, evenly spaced between left and right margins
const FRET_XS   = [28, 68, 108, 148];
const FRET_TOP  = 44;
const FRET_BOT  = 140;

// ── Build raw scanlines (filter byte 0 = None, then RGB per pixel) ───────────
const stride = 1 + W * 3;          // filter + RGB
const raw = Buffer.alloc(H * stride, 0);

for (let y = 0; y < H; y++) {
  raw[y * stride] = 0;             // None filter

  for (let x = 0; x < W; x++) {
    const off = y * stride + 1 + x * 3;
    const t = y / (H - 1);        // 0 at top, 1 at bottom

    // ── Background gradient: #0d1b2a → #183558 ──────────────────────────────
    let r = Math.round(0x0d + (0x18 - 0x0d) * t);
    let g = Math.round(0x1b + (0x35 - 0x1b) * t);
    let b = Math.round(0x2a + (0x58 - 0x2a) * t);

    // ── Fret lines (vertical, subtle lighter navy) ───────────────────────────
    const isFret = FRET_XS.includes(x) && y >= FRET_TOP && y <= FRET_BOT;
    if (isFret) { r = 0x28; g = 0x50; b = 0x7a; }

    // ── Guitar strings (horizontal, bright blue-white with soft edge) ────────
    const distToString = Math.min(...STRING_YS.map((sy) => Math.abs(y - sy)));

    if (distToString === 0) {
      // Core string — bright
      r = 0xc8; g = 0xdf; b = 0xf5;
    } else if (distToString === 1) {
      // Soft glow/anti-alias
      r = Math.min(255, r + 0x40);
      g = Math.min(255, g + 0x55);
      b = Math.min(255, b + 0x65);
    }

    raw[off]     = r;
    raw[off + 1] = g;
    raw[off + 2] = b;
  }
}

// ── Assemble PNG ─────────────────────────────────────────────────────────────
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(W, 0);
ihdrData.writeUInt32BE(H, 4);
ihdrData[8]  = 8;  // bit depth
ihdrData[9]  = 2;  // color type: RGB
ihdrData[10] = 0;  // compression
ihdrData[11] = 0;  // filter
ihdrData[12] = 0;  // interlace

const ihdr = pngChunk("IHDR", ihdrData);
const idat = pngChunk("IDAT", deflateSync(raw, { level: 9 }));
const iend = pngChunk("IEND", Buffer.alloc(0));

const png = Buffer.concat([signature, ihdr, idat, iend]);
writeFileSync("public/apple-touch-icon.png", png);
console.log(`Generated public/apple-touch-icon.png (${png.length} bytes)`);
