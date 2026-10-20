import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup';
import type { Entry } from './types';

const sample: Entry[] = [
  { id: 'a', mode: '30', date: '2026-10-20', time: '08:10', count: 20, createdAt: '2026-10-20T08:10:00.000Z' },
  { id: 'b', mode: '90', date: '2026-10-19', time: '21:00', count: 5, createdAt: '2026-10-19T21:00:00.000Z' },
];

describe('serializeBackup / parseBackup', () => {
  it('書き出したものを読み込むと同じ記録に戻る', () => {
    const text = serializeBackup(sample, '2026-10-20T12:00:00.000Z');
    expect(parseBackup(text)).toEqual(sample);
  });

  it('書き出しにはアプリ名と形式の版を入れる', () => {
    const data = JSON.parse(serializeBackup(sample, '2026-10-20T12:00:00.000Z'));
    expect(data.app).toBe('1000-drawings');
    expect(data.version).toBe(1);
    expect(data.exportedAt).toBe('2026-10-20T12:00:00.000Z');
  });
});

describe('parseBackup の検証', () => {
  const wrap = (entries: unknown) => JSON.stringify({ app: '1000-drawings', version: 1, entries });

  it('JSON でなければ読み込まない', () => {
    expect(() => parseBackup('not json')).toThrow('ファイルを読み取れませんでした');
  });

  it('このアプリの書き出しでなければ読み込まない', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', version: 1, entries: [] }))).toThrow(
      'このアプリで書き出したファイルではありません',
    );
  });

  it('知らない版の形式は読み込まない', () => {
    expect(() => parseBackup(JSON.stringify({ app: '1000-drawings', version: 2, entries: [] }))).toThrow(
      '対応していない形式です',
    );
  });

  it.each([
    ['種類', { mode: '60' }],
    ['日付', { date: '2026-13-01' }],
    ['日付', { date: '20261020' }],
    ['時刻', { time: '25:00' }],
    ['数', { count: 0 }],
    ['数', { count: 1.5 }],
    ['数', { count: '10' }],
    ['ID', { id: '' }],
  ])('%s がおかしい記録があれば読み込まない', (_label, over) => {
    expect(() => parseBackup(wrap([{ ...sample[0], ...over }]))).toThrow('おかしい記録があります');
  });

  it('同じ ID の記録が重なっていれば読み込まない', () => {
    expect(() => parseBackup(wrap([sample[0], sample[0]]))).toThrow('おかしい記録があります');
  });

  it('記録にない余分な項目は捨てる', () => {
    expect(parseBackup(wrap([{ ...sample[0], extra: '<b>x</b>' }]))).toEqual([sample[0]]);
  });
});
