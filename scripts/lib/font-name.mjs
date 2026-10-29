/**
 * Rename the family/style names inside an OpenType font without touching its
 * glyphs or layout tables.
 *
 * Why this exists: the bundled Scheherazade New files are *subsets*, and the
 * SIL Open Font License reserves the names "Scheherazade" and "SIL" for the
 * unmodified original (OFL 1.1, condition 3). A renamed subset keeps the
 * original copyright + license strings (nameIDs 0 and 13/14) intact while
 * presenting a different primary family name to users.
 *
 * Only the `name` table is rewritten; every other table is copied byte for
 * byte. The sfnt checksums and `head.checkSumAdjustment` are recomputed.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import fontverter from 'fontverter';

const TABLE_DIRECTORY_SIZE = 12;
const TABLE_RECORD_SIZE = 16;
const HEAD_CHECKSUM_MAGIC = 0xb1b0afba;

/** @param {Buffer} sfnt */
export function readTableDirectory(sfnt) {
  const version = sfnt.readUInt32BE(0);
  const numTables = sfnt.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < numTables; i += 1) {
    const record = TABLE_DIRECTORY_SIZE + i * TABLE_RECORD_SIZE;
    const tag = sfnt.toString('latin1', record, record + 4);
    const offset = sfnt.readUInt32BE(record + 8);
    const length = sfnt.readUInt32BE(record + 12);
    tables.push({ tag, data: Buffer.from(sfnt.subarray(offset, offset + length)) });
  }
  return { version, tables };
}

/** @param {Buffer} data */
export function tableChecksum(data) {
  const padded = Buffer.alloc(data.length + ((4 - (data.length % 4)) % 4));
  data.copy(padded);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) {
    sum = (sum + padded.readUInt32BE(i)) >>> 0;
  }
  return sum;
}

/**
 * @param {number} version
 * @param {{ tag: string, data: Buffer }[]} tables
 */
export function writeSfnt(version, tables) {
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const numTables = sorted.length;
  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 16 * 2 ** entrySelector;
  const rangeShift = numTables * 16 - searchRange;
  const bodyStart = TABLE_DIRECTORY_SIZE + numTables * TABLE_RECORD_SIZE;

  const head = sorted.find((table) => table.tag === 'head');
  if (head) {
    // The head checksum is defined over the table with checkSumAdjustment zeroed.
    head.data.writeUInt32BE(0, 8);
  }

  const records = [];
  const bodies = [];
  let offset = bodyStart;
  for (const table of sorted) {
    const data = Buffer.from(table.data);
    const padded = Buffer.alloc(data.length + ((4 - (data.length % 4)) % 4));
    data.copy(padded);
    records.push({
      tag: table.tag,
      checkSum: tableChecksum(data),
      offset,
      length: data.length,
    });
    bodies.push(padded);
    offset += padded.length;
  }

  const out = Buffer.alloc(offset);
  out.writeUInt32BE(version, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(rangeShift, 10);
  records.forEach((record, i) => {
    const at = TABLE_DIRECTORY_SIZE + i * TABLE_RECORD_SIZE;
    out.write(record.tag, at, 4, 'latin1');
    out.writeUInt32BE(record.checkSum, at + 4);
    out.writeUInt32BE(record.offset, at + 8);
    out.writeUInt32BE(record.length, at + 12);
  });
  bodies.forEach((body, i) => {
    body.copy(out, records[i].offset);
  });

  if (head) {
    const headOffset = records.find((record) => record.tag === 'head').offset;
    const adjustment = (HEAD_CHECKSUM_MAGIC - tableChecksum(out)) >>> 0;
    out.writeUInt32BE(adjustment, headOffset + 8);
  }
  return out;
}

/** Decode a `name` table string for the given platform. */
function decodeNameString(platformID, raw) {
  if (platformID === 1) {
    return raw.toString('latin1');
  }
  const swapped = Buffer.from(raw);
  swapped.swap16();
  return swapped.toString('utf16le');
}

/** Encode a `name` table string for the given platform. */
function encodeNameString(platformID, value) {
  if (platformID === 1) {
    return Buffer.from(value, 'latin1');
  }
  const buffer = Buffer.from(value, 'utf16le');
  buffer.swap16();
  return buffer;
}

/** @param {Buffer} data */
export function readNameTable(data) {
  const count = data.readUInt16BE(2);
  const stringOffset = data.readUInt16BE(4);
  const records = [];
  for (let i = 0; i < count; i += 1) {
    const at = 6 + i * 12;
    const platformID = data.readUInt16BE(at);
    const encodingID = data.readUInt16BE(at + 2);
    const languageID = data.readUInt16BE(at + 4);
    const nameID = data.readUInt16BE(at + 6);
    const length = data.readUInt16BE(at + 8);
    const offset = data.readUInt16BE(at + 10);
    const raw = data.subarray(stringOffset + offset, stringOffset + offset + length);
    records.push({
      platformID,
      encodingID,
      languageID,
      nameID,
      value: decodeNameString(platformID, raw),
    });
  }
  return records;
}

/** @param {{ platformID: number, encodingID: number, languageID: number, nameID: number, value: string }[]} records */
export function buildNameTable(records) {
  const headerSize = 6 + records.length * 12;
  const encoded = records.map((record) => encodeNameString(record.platformID, record.value));
  const storageSize = encoded.reduce((total, buffer) => total + buffer.length + (buffer.length % 2), 0);
  const table = Buffer.alloc(headerSize + storageSize);
  table.writeUInt16BE(0, 0); // name table format 0
  table.writeUInt16BE(records.length, 2);
  table.writeUInt16BE(headerSize, 4);

  let cursor = 0;
  records.forEach((record, i) => {
    const at = 6 + i * 12;
    const string = encoded[i];
    table.writeUInt16BE(record.platformID, at);
    table.writeUInt16BE(record.encodingID, at + 2);
    table.writeUInt16BE(record.languageID, at + 4);
    table.writeUInt16BE(record.nameID, at + 6);
    table.writeUInt16BE(string.length, at + 8);
    table.writeUInt16BE(cursor, at + 10);
    string.copy(table, headerSize + cursor);
    cursor += string.length + (string.length % 2);
  });
  return table;
}

/**
 * @param {Buffer} sfnt
 * @param {{ family: string, subfamily: string, postscript: string, vendor: string }} options
 */
export function renameSfntNames(sfnt, options) {
  const { version, tables } = readTableDirectory(sfnt);
  const nameTable = tables.find((table) => table.tag === 'name');
  if (!nameTable) {
    throw new Error('font has no name table');
  }
  const records = readNameTable(nameTable.data);
  const fullName =
    options.subfamily.toLowerCase() === 'regular' ? options.family : `${options.family} ${options.subfamily}`;
  const versionRecord = records.find((record) => record.nameID === 5);
  const versionString = (versionRecord?.value ?? '').replace(/^Version\s*/i, '').trim();

  const renamed = records.map((record) => {
    let value;
    switch (record.nameID) {
      case 1: // Font Family
      case 16: // Typographic Family
      case 21: // WWS Family
        value = options.family;
        break;
      case 2: // Font Subfamily
      case 17: // Typographic Subfamily
      case 22: // WWS Subfamily
        value = options.subfamily;
        break;
      case 3: // Unique identifier
        value = `${options.vendor}: ${options.postscript}${versionString ? ` ${versionString}` : ''} (subset)`;
        break;
      case 4: // Full name
      case 18: // Compatible full name
        value = fullName;
        break;
      case 6: // PostScript name
        value = options.postscript;
        break;
      default:
        return record;
    }
    return { ...record, value };
  });

  nameTable.data = buildNameTable(renamed);
  return writeSfnt(version, tables);
}

/**
 * Rename a WOFF2 font file.
 *
 * @param {string} path
 * @param {{ family: string, subfamily: string, postscript: string, vendor: string }} options
 * @param {{ write?: boolean }} [config]
 */
export async function renameWoff2File(path, options, config = {}) {
  const original = readFileSync(path);
  const sfnt = Buffer.from(await fontverter.convert(original, 'sfnt', 'woff2'));
  const renamed = renameSfntNames(sfnt, options);
  const woff2 = Buffer.from(await fontverter.convert(renamed, 'woff2', 'sfnt'));
  if (config.write !== false) {
    writeFileSync(path, woff2);
  }
  return { before: original.length, after: woff2.length, woff2, sfnt: renamed };
}
