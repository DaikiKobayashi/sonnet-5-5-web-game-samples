// Minimal PNG encoder (dev tool only) so sprites can be previewed from Node.
import zlib from 'node:zlib';
import fs from 'node:fs';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Compose Px images onto a checkerboard sheet at an integer scale and write a PNG.
export function writeSheet(file, images, { scale = 4, gap = 6, cols = 8, bg = 0x2a2a3a, labels = false } = {}) {
  let x = gap, y = gap, rowH = 0, maxW = 0;
  const placed = [];
  for (const im of images) {
    const w = im.w * scale, h = im.h * scale;
    if (x + w + gap > cols * 200 && x > gap) { x = gap; y += rowH + gap; rowH = 0; }
    placed.push({ im, x, y });
    x += w + gap;
    rowH = Math.max(rowH, h);
    maxW = Math.max(maxW, x);
  }
  const W = maxW, H = y + rowH + gap;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const px = i % W, py = (i / W) | 0;
    const chk = ((px >> 3) + (py >> 3)) & 1;
    const c = chk ? bg : bg + 0x0c0c0c;
    out[i * 4] = (c >> 16) & 255; out[i * 4 + 1] = (c >> 8) & 255; out[i * 4 + 2] = c & 255; out[i * 4 + 3] = 255;
  }
  for (const p of placed) {
    const { im } = p;
    for (let yy = 0; yy < im.h * scale; yy++) {
      for (let xx = 0; xx < im.w * scale; xx++) {
        const si = (((yy / scale) | 0) * im.w + ((xx / scale) | 0)) * 4;
        const a = im.data[si + 3] / 255;
        if (a === 0) continue;
        const di = ((p.y + yy) * W + (p.x + xx)) * 4;
        out[di] = im.data[si] * a + out[di] * (1 - a);
        out[di + 1] = im.data[si + 1] * a + out[di + 1] * (1 - a);
        out[di + 2] = im.data[si + 2] * a + out[di + 2] * (1 - a);
      }
    }
  }
  fs.writeFileSync(file, encodePNG(W, H, out));
  return { W, H };
}

export function writePx(file, im, scale = 1) {
  const W = im.w * scale, H = im.h * scale;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const si = (((y / scale) | 0) * im.w + ((x / scale) | 0)) * 4;
      const di = (y * W + x) * 4;
      const a = im.data[si + 3] / 255;
      out[di] = im.data[si] * a + 20 * (1 - a);
      out[di + 1] = im.data[si + 1] * a + 20 * (1 - a);
      out[di + 2] = im.data[si + 2] * a + 30 * (1 - a);
      out[di + 3] = 255;
    }
  }
  fs.writeFileSync(file, encodePNG(W, H, out));
}
