import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "src");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);
const swPath = resolve(dist, "sw.js");
const sw = await readFile(swPath, "utf8");
await writeFile(swPath, sw.replaceAll("__BUILD_VERSION__", stamp));

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function tennisIcon(size) {
  const rows = [];
  const center = (size - 1) / 2;
  const radius = size * 0.34;
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const d = Math.hypot(dx, dy);
      let color = [9, 53, 47, 255];
      if (d < radius) color = [217, 239, 76, 255];
      const seamA = Math.abs(dx - 0.0023 * dy * dy + size * 0.17) < size * 0.013;
      const seamB = Math.abs(dx + 0.0023 * dy * dy - size * 0.17) < size * 0.013;
      if (d < radius && (seamA || seamB)) color = [255, 255, 235, 255];
      row.set(color, 1 + x * 4);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

await mkdir(resolve(dist, "icons"), { recursive: true });
await Promise.all([
  writeFile(resolve(dist, "icons/icon-192.png"), tennisIcon(192)),
  writeFile(resolve(dist, "icons/icon-512.png"), tennisIcon(512))
]);
console.log(`Built ${dist} (${stamp})`);
