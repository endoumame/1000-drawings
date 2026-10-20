import { parseBackup, serializeBackup } from './domain/backup';
import { MODES, type Entry, type Mode } from './domain/types';

const ENTRIES_KEY = '1000-drawings:entries';
const MODE_KEY = '1000-drawings:mode';

/** 保存は書き出しと同じ形式にして、読み込みと同じ検証を通す。 */
export function loadEntries(): Entry[] {
  const raw = read(ENTRIES_KEY);
  if (raw === null) return [];
  try {
    return parseBackup(raw);
  } catch {
    // 読めないデータは上書きで失わないよう、別のキーに退避してから空で始める
    write(`${ENTRIES_KEY}:broken:${Date.now()}`, raw);
    return [];
  }
}

export function saveEntries(entries: Entry[]): void {
  write(ENTRIES_KEY, serializeBackup(entries, new Date().toISOString()));
}

export function loadMode(): Mode {
  const raw = read(MODE_KEY);
  return MODES.includes(raw as Mode) ? (raw as Mode) : '30';
}

export function saveMode(mode: Mode): void {
  write(MODE_KEY, mode);
}

/** ブラウザに保存データを勝手に消さないよう頼む（応じるかはブラウザ次第）。 */
export function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できない環境（プライベートモードなど）でも画面は動かし続ける
  }
}
