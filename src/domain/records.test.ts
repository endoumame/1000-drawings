import { describe, expect, it } from 'vitest';
import {
  addEntry,
  dayTotal,
  deleteEntry,
  formatDate,
  summarize,
  updateEntry,
} from './records';
import type { Entry } from './types';

const entry = (over: Partial<Entry>): Entry => ({
  id: 'x',
  mode: '30',
  date: '2026-10-20',
  time: '12:00',
  count: 10,
  createdAt: '2026-10-20T12:00:00.000Z',
  ...over,
});

describe('formatDate', () => {
  it('月/日（曜日）の形にする', () => {
    expect(formatDate('2026-10-20')).toBe('10/20（火）');
    expect(formatDate('2026-01-04')).toBe('1/4（日）');
  });
});

describe('summarize', () => {
  const entries = [
    entry({ id: 'a', date: '2026-10-20', time: '19:45', count: 30 }),
    entry({ id: 'b', date: '2026-10-20', time: '08:10', count: 20 }),
    entry({ id: 'c', date: '2026-10-19', time: '22:00', count: 30 }),
    entry({ id: 'd', date: '2026-10-17', time: '21:15', count: 30 }),
    entry({ id: 'e', date: '2026-10-15', time: '07:50', count: 10 }),
    entry({ id: 'f', mode: '90', date: '2026-10-20', time: '20:10', count: 10 }),
  ];

  it('選んだ種類だけを合計し、1000から引いた残りを出す', () => {
    const s = summarize(entries, '30', '2026-10-20');
    expect(s.total).toBe(120);
    expect(s.remaining).toBe(880);
    expect(s.todayTotal).toBe(50);
  });

  it('同じ日の入力は1日にまとめ、新しい日付から並べる', () => {
    const s = summarize(entries, '30', '2026-10-20');
    expect(s.days.map((d) => [d.date, d.total])).toEqual([
      ['2026-10-20', 50],
      ['2026-10-19', 30],
      ['2026-10-17', 30],
      ['2026-10-15', 10],
    ]);
  });

  it('1日の内訳は時刻の早い順に並べる', () => {
    const s = summarize(entries, '30', '2026-10-20');
    expect(s.days[0].sessions.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('次の100体ごとの節目と、そこまでの残りを出す', () => {
    expect(summarize(entries, '30', '2026-10-20').nextMilestone).toEqual({ target: 200, rest: 80 });
  });

  it('ちょうど節目に届いたら次の節目を目指す', () => {
    const s = summarize([entry({ count: 100 })], '30', '2026-10-20');
    expect(s.nextMilestone).toEqual({ target: 200, rest: 100 });
  });

  it('記録がなければ残りは1000で、最初の節目は100', () => {
    const s = summarize([], '90', '2026-10-20');
    expect(s.remaining).toBe(1000);
    expect(s.todayTotal).toBe(0);
    expect(s.days).toEqual([]);
    expect(s.nextMilestone).toEqual({ target: 100, rest: 100 });
  });

  it('1000体を超えたら残りは0で、節目はなくなる', () => {
    const s = summarize([entry({ count: 1005 })], '30', '2026-10-20');
    expect(s.remaining).toBe(0);
    expect(s.progress).toBe(1);
    expect(s.nextMilestone).toBeNull();
  });
});

describe('dayTotal', () => {
  const entries = [
    entry({ id: 'a', count: 20 }),
    entry({ id: 'b', count: 30 }),
    entry({ id: 'c', mode: '90', count: 5 }),
    entry({ id: 'd', date: '2026-10-19', count: 7 }),
  ];

  it('その種類のその日の合計を出す', () => {
    expect(dayTotal(entries, '30', '2026-10-20')).toBe(50);
  });

  it('編集中の記録は除いて合計できる', () => {
    expect(dayTotal(entries, '30', '2026-10-20', 'a')).toBe(30);
  });
});

describe('記録の追加・編集・削除', () => {
  const base = [entry({ id: 'a', count: 20 })];

  it('追加すると末尾に新しい記録が入る', () => {
    const next = addEntry(base, { mode: '90', date: '2026-10-19', time: '09:30', count: 5 }, 'n', '2026-10-20T00:00:00.000Z');
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({
      id: 'n',
      mode: '90',
      date: '2026-10-19',
      time: '09:30',
      count: 5,
      createdAt: '2026-10-20T00:00:00.000Z',
    });
    expect(base).toHaveLength(1);
  });

  it('編集すると数・日付・時刻だけが変わる', () => {
    const next = updateEntry(base, 'a', { date: '2026-10-18', time: '10:00', count: 3 });
    expect(next[0]).toEqual({ ...base[0], date: '2026-10-18', time: '10:00', count: 3 });
  });

  it('削除するとその記録だけがなくなる', () => {
    const two = [...base, entry({ id: 'b' })];
    expect(deleteEntry(two, 'a').map((e) => e.id)).toEqual(['b']);
  });
});
