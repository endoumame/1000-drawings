import { MODES, type Entry, type Mode } from './types';

const APP = '1000-drawings';
const VERSION = 1;

export function serializeBackup(entries: Entry[], exportedAt: string): string {
  return JSON.stringify({ app: APP, version: VERSION, exportedAt, entries }, null, 2);
}

/** 書き出したファイルを読み戻す。少しでもおかしければ、今の記録を壊さないように丸ごと断る。 */
export function parseBackup(text: string): Entry[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('ファイルを読み取れませんでした');
  }
  if (!isObject(data) || data.app !== APP) {
    throw new Error('このアプリで書き出したファイルではありません');
  }
  if (data.version !== VERSION || !Array.isArray(data.entries)) {
    throw new Error('対応していない形式です');
  }
  const ids = new Set<string>();
  return data.entries.map((raw) => {
    const entry = toEntry(raw);
    if (!entry || ids.has(entry.id)) {
      throw new Error('おかしい記録があります');
    }
    ids.add(entry.id);
    return entry;
  });
}

function toEntry(raw: unknown): Entry | null {
  if (!isObject(raw)) return null;
  const { id, mode, date, time, count, createdAt } = raw;
  if (typeof id !== 'string' || id === '') return null;
  if (!MODES.includes(mode as Mode)) return null;
  if (typeof date !== 'string' || !isValidDate(date)) return null;
  if (typeof time !== 'string' || !isValidTime(time)) return null;
  if (!isValidCount(count)) return null;
  if (typeof createdAt !== 'string') return null;
  return { id, mode: mode as Mode, date, time, count, createdAt };
}

export function isValidDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function isValidCount(count: unknown): count is number {
  return typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= 9999;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
