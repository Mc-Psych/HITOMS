import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // color type: RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      
      // Draw hospital blue background with darker corners
      const distFromCenter = Math.hypot(x - width / 2, y - height / 2) / (width / 2);
      let red = Math.max(2, Math.min(255, Math.floor(r * (1 - distFromCenter * 0.4))));
      let green = Math.max(15, Math.min(255, Math.floor(g * (1 - distFromCenter * 0.4))));
      let blue = Math.max(40, Math.min(255, Math.floor(b * (1 - distFromCenter * 0.3))));

      // Draw white cross in center
      const inVertical = Math.abs(x - width / 2) < width * 0.08 && Math.abs(y - height / 2) < height * 0.28;
      const inHorizontal = Math.abs(y - height / 2) < height * 0.08 && Math.abs(x - width / 2) < width * 0.28;
      
      if (inVertical || inHorizontal) {
        red = 255;
        green = 255;
        blue = 255;
      }

      rawData[pxOffset] = red;
      rawData[pxOffset + 1] = green;
      rawData[pxOffset + 2] = blue;
      rawData[pxOffset + 3] = 255;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = c ^ buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

fs.writeFileSync('public/pwa-192x192.png', createPng(192, 192, 2, 132, 199));
fs.writeFileSync('public/pwa-512x512.png', createPng(512, 512, 2, 132, 199));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPng(512, 512, 2, 132, 199));
fs.writeFileSync('public/apple-touch-icon.png', createPng(180, 180, 2, 132, 199));

console.log('PWA icons created successfully');
