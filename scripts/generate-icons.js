import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, getPixel) {
  // Each row starts with filter byte 0 (None)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  // CRC32 table & helper
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const typeAndData = buf.subarray(4, 8 + len);
    buf.writeUInt32BE(crc32(typeAndData), 8 + len);
    return buf;
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Ensure public/icons directory exists
const iconsDir = path.resolve('public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

function renderIconPixel(x, y, w, h, isMaskable = false) {
  const nx = (x / (w - 1)) * 2 - 1; // -1 to 1
  const ny = (y / (h - 1)) * 2 - 1; // -1 to 1
  const dist = Math.sqrt(nx * nx + ny * ny);

  // Background color
  let bgR = 17, bgG = 18, bgB = 21; // #111215

  if (!isMaskable) {
    // Rounded squircle
    const radius = 0.88;
    const cornerRadius = 0.28;
    const qx = Math.abs(nx) - (radius - cornerRadius);
    const qy = Math.abs(ny) - (radius - cornerRadius);
    const dCorner = Math.sqrt(Math.max(0, qx) ** 2 + Math.max(0, qy) ** 2) - cornerRadius;
    const dMax = Math.max(Math.abs(nx) - radius, Math.abs(ny) - radius);
    const distToEdge = (qx > 0 && qy > 0) ? dCorner : dMax;
    
    if (distToEdge > 0.03) {
      return [0, 0, 0, 0]; // transparent
    }
    
    // Smooth anti-aliased edge
    const edgeAlpha = distToEdge > 0 ? Math.max(0, Math.min(1, 1 - distToEdge / 0.03)) : 1;

    // Subtle dark gradient & border
    const gradient = (ny + 1) * 0.15;
    bgR = Math.round(18 + gradient * 15);
    bgG = Math.round(20 + gradient * 18);
    bgB = Math.round(26 + gradient * 25);

    // Shelf/Cube Geometry in center
    // Isometric 3D box coordinates:
    // Center is (0, 0)
    // Scale factor
    const s = 0.52;
    const px = nx / s;
    const py = ny / s;

    // Isometric projection:
    // Top face, Left face, Right face
    const inTop = py < -0.1 && Math.abs(px) * 0.58 + Math.abs(py + 0.45) < 0.55;
    const inLeft = px < 0 && py >= -0.1 && py <= 0.6 && (px > -0.65) && (py - px * 0.58 <= 0.7);
    const inRight = px >= 0 && py >= -0.1 && py <= 0.6 && (px < 0.65) && (py + px * 0.58 <= 0.7);

    // 3D Grid 3x3 shelf motif inside
    if (Math.abs(px) < 0.7 && Math.abs(py) < 0.7) {
      // Draw stylized 3D Shelf / Grid Box
      const gridX = Math.floor((px + 0.6) / 0.4);
      const gridY = Math.floor((py + 0.6) / 0.4);
      const subX = (px + 0.6) % 0.4;
      const subY = (py + 0.6) % 0.4;

      const isBorder = (subX < 0.06 || subY < 0.06 || Math.abs(px) > 0.56 || Math.abs(py) > 0.56);

      if (Math.abs(px) <= 0.6 && Math.abs(py) <= 0.6) {
        if (isBorder) {
          return [
            Math.round(45 * edgeAlpha),
            Math.round(91 * edgeAlpha),
            Math.round(88 * edgeAlpha),
            Math.round(255 * edgeAlpha)
          ]; // #2d5b58
        } else {
          // Inner cells with glowing accent
          if (gridX === 1 && gridY === 1) {
            // Center cell: vibrant orange accent #c46843
            return [
              Math.round(196 * edgeAlpha),
              Math.round(104 * edgeAlpha),
              Math.round(67 * edgeAlpha),
              Math.round(255 * edgeAlpha)
            ];
          } else if ((gridX + gridY) % 2 === 0) {
            return [
              Math.round(35 * edgeAlpha),
              Math.round(40 * edgeAlpha),
              Math.round(48 * edgeAlpha),
              Math.round(255 * edgeAlpha)
            ];
          } else {
            return [
              Math.round(28 * edgeAlpha),
              Math.round(32 * edgeAlpha),
              Math.round(38 * edgeAlpha),
              Math.round(255 * edgeAlpha)
            ];
          }
        }
      }
    }

    return [bgR, bgG, bgB, Math.round(255 * edgeAlpha)];
  } else {
    // Maskable (full bleed background)
    const s = 0.42;
    const px = nx / s;
    const py = ny / s;

    if (Math.abs(px) <= 0.6 && Math.abs(py) <= 0.6) {
      const subX = (px + 0.6) % 0.4;
      const subY = (py + 0.6) % 0.4;
      const gridX = Math.floor((px + 0.6) / 0.4);
      const gridY = Math.floor((py + 0.6) / 0.4);
      const isBorder = (subX < 0.06 || subY < 0.06 || Math.abs(px) > 0.56 || Math.abs(py) > 0.56);

      if (isBorder) {
        return [45, 91, 88, 255];
      } else if (gridX === 1 && gridY === 1) {
        return [196, 104, 67, 255];
      } else if ((gridX + gridY) % 2 === 0) {
        return [35, 40, 48, 255];
      } else {
        return [28, 32, 38, 255];
      }
    }
    return [17, 18, 21, 255];
  }
}

// Generate PNG files
console.log('Generating icons...');
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPNG(192, 192, (x, y, w, h) => renderIconPixel(x, y, w, h, false)));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPNG(512, 512, (x, y, w, h) => renderIconPixel(x, y, w, h, false)));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192.png'), createPNG(192, 192, (x, y, w, h) => renderIconPixel(x, y, w, h, true)));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), createPNG(512, 512, (x, y, w, h) => renderIconPixel(x, y, w, h, true)));

// Generate SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1b1d24" />
      <stop offset="100%" stop-color="#0f1013" />
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b7a76" />
      <stop offset="100%" stop-color="#244d4a" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ea7a4e" />
      <stop offset="100%" stop-color="#c46843" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#c46843" flood-opacity="0.35" />
    </filter>
  </defs>
  <!-- Background squircle -->
  <rect x="24" y="24" width="464" height="464" rx="104" fill="url(#bgGrad)" stroke="#2b2e38" stroke-width="6" />
  
  <!-- 3D Shelf Grid Grid3X3 -->
  <g transform="translate(106, 106)">
    <!-- Outer shelf frame -->
    <rect x="0" y="0" width="300" height="300" rx="28" fill="#181a20" stroke="url(#primaryGrad)" stroke-width="12" />
    
    <!-- Vertical Dividers -->
    <line x1="100" y1="0" x2="100" y2="300" stroke="url(#primaryGrad)" stroke-width="10" stroke-linecap="round" />
    <line x1="200" y1="0" x2="200" y2="300" stroke="url(#primaryGrad)" stroke-width="10" stroke-linecap="round" />
    
    <!-- Horizontal Shelves -->
    <line x1="0" y1="100" x2="300" y2="100" stroke="url(#primaryGrad)" stroke-width="10" stroke-linecap="round" />
    <line x1="0" y1="200" x2="300" y2="200" stroke="url(#primaryGrad)" stroke-width="10" stroke-linecap="round" />
    
    <!-- Center Showcase 3D Cube with Accent Glow -->
    <rect x="114" y="114" width="72" height="72" rx="14" fill="url(#accentGrad)" filter="url(#glow)" />
    
    <!-- 3D depth indicators / highlights -->
    <rect x="26" y="26" width="48" height="48" rx="8" fill="#23262f" />
    <rect x="226" y="26" width="48" height="48" rx="8" fill="#23262f" />
    <rect x="26" y="226" width="48" height="48" rx="8" fill="#23262f" />
    <rect x="226" y="226" width="48" height="48" rx="8" fill="#23262f" />
    
    <circle cx="150" cy="50" r="14" fill="#3b7a76" opacity="0.8" />
    <circle cx="150" cy="250" r="14" fill="#3b7a76" opacity="0.8" />
    <circle cx="50" cy="150" r="14" fill="#3b7a76" opacity="0.8" />
    <circle cx="250" cy="150" r="14" fill="#3b7a76" opacity="0.8" />
  </g>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), svgContent);
console.log('Icons generated successfully!');
