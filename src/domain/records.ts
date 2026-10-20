import { GOAL, MAX_ENTRY_COUNT, type Entry, type EntryInput, type Mode } from './types';

const MILESTONE_STEP = 100;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export interface DaySummary {
  date: string;
  total: number;
  sessions: Entry[];
}

/**
 * 1000体を何周でも繰り返す。0に届いたらすぐ次の1000体が始まり、超えた分は次の1000体から引く。
 */
export interface Summary {
  /** 全期間の合計 */
  total: number;
  /** 1000体を達成した回数 */
  laps: number;
  /** 今の1000体の残り（1〜1000） */
  remaining: number;
  todayTotal: number;
  /** 今の1000体の進み具合（0〜1未満） */
  progress: number;
  /** 今の1000体の中での次の100体ごとの節目 */
  nextMilestone: { target: number; rest: number };
  /** 新しい日付が先頭 */
  days: DaySummary[];
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${weekday}）`;
}

const sum = (entries: Entry[]) => entries.reduce((n, e) => n + e.count, 0);

export function summarize(entries: Entry[], mode: Mode, today: string, goal = GOAL): Summary {
  const own = entries.filter((e) => e.mode === mode);
  const byDate = new Map<string, Entry[]>();
  for (const e of own) {
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      total: sum(list),
      sessions: [...list].sort((a, b) => a.time.localeCompare(b.time)),
    }));

  const total = sum(own);
  const done = total % goal;
  const target = (Math.floor(done / MILESTONE_STEP) + 1) * MILESTONE_STEP;

  return {
    total,
    laps: Math.floor(total / goal),
    remaining: goal - done,
    todayTotal: sum(byDate.get(today) ?? []),
    progress: done / goal,
    nextMilestone: { target, rest: target - done },
    days,
  };
}

export type Milestone = { kind: 'goal'; laps: number } | { kind: 'step'; value: number };

/** 合計が before から after に増えたとき、越えた区切りのうちいちばん大きいもの */
export function milestoneReached(before: number, after: number, goal = GOAL): Milestone | null {
  if (after <= before) return null;
  const laps = Math.floor(after / goal);
  if (laps > Math.floor(before / goal)) return { kind: 'goal', laps };
  const step = Math.floor(after / MILESTONE_STEP);
  if (step > Math.floor(before / MILESTONE_STEP)) return { kind: 'step', value: (step * MILESTONE_STEP) % goal };
  return null;
}

/** 1回に記録できる数 */
export function isValidEntryCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= MAX_ENTRY_COUNT;
}

export function dayTotal(entries: Entry[], mode: Mode, date: string, excludeId?: string): number {
  return sum(entries.filter((e) => e.mode === mode && e.date === date && e.id !== excludeId));
}

export function addEntry(entries: Entry[], input: EntryInput, id: string, createdAt: string): Entry[] {
  return [...entries, { id, ...input, createdAt }];
}

export function updateEntry(
  entries: Entry[],
  id: string,
  patch: Pick<Entry, 'date' | 'time' | 'count'>,
): Entry[] {
  return entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
}

export function deleteEntry(entries: Entry[], id: string): Entry[] {
  return entries.filter((e) => e.id !== id);
}
