import { downloadBlob } from '../js/utils.js';

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(8 + data.length + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  dv.setUint32(8 + data.length, crc32(crcInput));
  return chunk;
}

async function deflateData(data) {
  if (!('CompressionStream' in window)) throw new Error('CompressionStream indisponible dans ce navigateur.');
  const cs = new CompressionStream('deflate');
  const stream = new Blob([data]).stream().pipeThrough(cs);
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

async function encodeGray16Png(width, height, gray16) {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 16;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = 1 + width * 2;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const val = gray16[y * width + x];
      const p = rowStart + 1 + x * 2;
      raw[p] = (val >> 8) & 255;
      raw[p + 1] = val & 255;
    }
  }

  const compressed = await deflateData(raw);
  const chunks = [
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array(0))
  ];

  const total = signature.length + chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  out.set(signature, offset);
  offset += signature.length;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function exportPseudo16Png(gray16, width, height, filename = 'heightmap-worldpainter-16bit.png') {
  const bytes = await encodeGray16Png(width, height, gray16);
  const blob = new Blob([bytes], { type: 'image/png' });
  downloadBlob(blob, filename);
}
