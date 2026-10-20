import { GOAL, type Entry, type EntryInput, type Mode } from './types';

const MILESTONE_STEP = 100;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export interface DaySummary {
  date: string;
  total: number;
  sessions: Entry[];
}

export interface Summary {
  total: number;
  remaining: number;
  todayTotal: number;
  /** 0〜1 */
  progress: number;
  /** 1000体に届いたら null */
  nextMilestone: { target: number; rest: number } | null;
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
  const remaining = Math.max(goal - total, 0);
  const target = Math.min((Math.floor(total / MILESTONE_STEP) + 1) * MILESTONE_STEP, goal);

  return {
    total,
    remaining,
    todayTotal: sum(byDate.get(today) ?? []),
    progress: Math.min(total / goal, 1),
    nextMilestone: remaining === 0 ? null : { target, rest: target - total },
    days,
  };
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
