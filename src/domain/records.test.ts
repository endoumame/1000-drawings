import { describe, expect, it } from 'vitest';
import {
  addEntry,
  dayTotal,
  deleteEntry,
  formatDate,
  isValidEntryCount,
  milestoneReached,
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

  it('記録がなければ達成回数は0', () => {
    expect(summarize([], '30', '2026-10-20').laps).toBe(0);
  });
});

describe('summarize の繰り越し', () => {
  const at = (...counts: number[]) =>
    summarize(
      counts.map((count, i) => entry({ id: String(i), count })),
      '30',
      '2026-10-20',
    );

  it('残り10のところに20を入れると、超えた10を次の1000から引いて990になる', () => {
    const s = at(250, 250, 250, 240, 20);
    expect(s.total).toBe(1010);
    expect(s.remaining).toBe(990);
    expect(s.laps).toBe(1);
  });

  it('ちょうど0になったら、すぐ次の1000に戻る', () => {
    const s = at(250, 250, 250, 250);
    expect(s.remaining).toBe(1000);
    expect(s.laps).toBe(1);
    expect(s.progress).toBe(0);
    expect(s.nextMilestone).toEqual({ target: 100, rest: 100 });
  });

  it('進み具合と節目は、今の1000体の中で数える', () => {
    const s = at(250, 250, 250, 250, 250, 250, 250, 200, 30);
    expect(s.total).toBe(1980);
    expect(s.remaining).toBe(20);
    expect(s.progress).toBeCloseTo(0.98);
    expect(s.nextMilestone).toEqual({ target: 1000, rest: 20 });
  });

  it('何周しても合計は全期間で数える', () => {
    expect(at(250, 250, 250, 250, 250, 250, 250, 250, 5).total).toBe(2005);
    expect(at(250, 250, 250, 250, 250, 250, 250, 250, 5).laps).toBe(2);
  });
});

describe('milestoneReached', () => {
  it('1000の区切りを越えたら、何回目の達成かを返す', () => {
    expect(milestoneReached(990, 1010)).toEqual({ kind: 'goal', laps: 1 });
    expect(milestoneReached(1990, 2000)).toEqual({ kind: 'goal', laps: 2 });
  });

  it('100の区切りを越えたら、今の1000体の中での節目を返す', () => {
    expect(milestoneReached(90, 110)).toEqual({ kind: 'step', value: 100 });
    expect(milestoneReached(1190, 1210)).toEqual({ kind: 'step', value: 200 });
  });

  it('一度に複数の区切りを越えたら、いちばん大きい区切りを返す', () => {
    expect(milestoneReached(90, 320)).toEqual({ kind: 'step', value: 300 });
  });

  it('区切りを越えなければ何も返さない', () => {
    expect(milestoneReached(110, 150)).toBeNull();
  });

  it('減ったときは何も返さない', () => {
    expect(milestoneReached(1010, 990)).toBeNull();
  });
});

describe('isValidEntryCount', () => {
  it('1回の記録は1〜250の整数', () => {
    expect(isValidEntryCount(1)).toBe(true);
    expect(isValidEntryCount(250)).toBe(true);
    expect(isValidEntryCount(251)).toBe(false);
    expect(isValidEntryCount(0)).toBe(false);
    expect(isValidEntryCount(2.5)).toBe(false);
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
