import { GOAL } from './types';

export type StageKey = 'calm' | 'half' | 'near' | 'final';

/** 今の1000体の残りから、ゴールへの近さの段階を決める。見た目の盛り上がりに使う。 */
export function stage(remaining: number, goal = GOAL): { key: StageKey; label: string } {
  if (remaining <= 50) return { key: 'final', label: 'ラストスパート' };
  if (remaining <= goal * 0.2) return { key: 'near', label: 'あと少し' };
  if (remaining <= goal * 0.5) return { key: 'half', label: '折り返し地点を通過' };
  return { key: 'calm', label: '' };
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** 数字を動かすときの途中の値。t は経過の割合（0〜1）。 */
export function tween(from: number, to: number, t: number): number {
  const p = easeOutCubic(Math.min(Math.max(t, 0), 1));
  return Math.round(from + (to - from) * p);
}
