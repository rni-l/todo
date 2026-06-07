import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, body, crc) {
  const nameBuffer = Buffer.from(name);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(body.length, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBuffer]);
}

function centralHeader(name, body, crc, offset) {
  const nameBuffer = Buffer.from(name);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(body.length, 20);
  header.writeUInt32LE(body.length, 24);
  header.writeUInt16LE(nameBuffer.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, nameBuffer]);
}

function endOfCentralDirectory(entryCount, centralSize, centralOffset) {
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0);
  footer.writeUInt16LE(0, 4);
  footer.writeUInt16LE(0, 6);
  footer.writeUInt16LE(entryCount, 8);
  footer.writeUInt16LE(entryCount, 10);
  footer.writeUInt32LE(centralSize, 12);
  footer.writeUInt32LE(centralOffset, 16);
  footer.writeUInt16LE(0, 20);
  return footer;
}

export async function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const body = file.buffer ?? await fs.readFile(file.path);
    const name = file.name.replaceAll('\\', '/').replace(/^\/+/, '');
    const crc = crc32(body);
    const local = localHeader(name, body, crc);
    localParts.push(local, body);
    centralParts.push(centralHeader(name, body, crc, offset));
    offset += local.length + body.length;
  }

  const centralOffset = offset;
  const central = Buffer.concat(centralParts);
  const footer = endOfCentralDirectory(files.length, central.length, centralOffset);
  return Buffer.concat([...localParts, central, footer]);
}

export function parseZip(buffer) {
  const entries = [];
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) break;

    const name = buffer.subarray(nameStart, nameEnd).toString('utf8');
    const data = buffer.subarray(dataStart, dataEnd);
    let content;
    if (method === 0) {
      content = data;
    } else if (method === 8) {
      content = zlib.inflateRawSync(data);
    } else {
      throw new Error(`Unsupported ZIP compression method: ${method}`);
    }

    entries.push({
      name,
      basename: path.basename(name),
      content
    });
    offset = dataEnd;
  }

  return entries;
}
