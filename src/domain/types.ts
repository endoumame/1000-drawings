export type Mode = '30' | '90';

export const MODES: readonly Mode[] = ['30', '90'];

export const GOAL = 1000;

/** 1回の「描いた」入力。日ごとの合計は表示のたびにここから計算する。 */
export interface Entry {
  id: string;
  mode: Mode;
  /** 端末の現地時刻での日付（YYYY-MM-DD） */
  date: string;
  /** HH:MM */
  time: string;
  count: number;
  createdAt: string;
}

export type EntryInput = Pick<Entry, 'mode' | 'date' | 'time' | 'count'>;
