import { describe, expect, it } from 'vitest';
import { easeOutCubic, stage, tween } from './motion';

describe('stage', () => {
  it('半分までは段階の表示を出さない', () => {
    expect(stage(1000)).toEqual({ key: 'calm', label: '' });
    expect(stage(501)).toEqual({ key: 'calm', label: '' });
  });

  it('半分を過ぎたら折り返し', () => {
    expect(stage(500)).toEqual({ key: 'half', label: '折り返し地点を通過' });
  });

  it('残り2割を切ったらあと少し', () => {
    expect(stage(201).key).toBe('half');
    expect(stage(200)).toEqual({ key: 'near', label: 'あと少し' });
  });

  it('残り50体以下はラストスパート', () => {
    expect(stage(51).key).toBe('near');
    expect(stage(50)).toEqual({ key: 'final', label: 'ラストスパート' });
    expect(stage(1)).toEqual({ key: 'final', label: 'ラストスパート' });
  });
});

describe('easeOutCubic', () => {
  it('始まりは0、終わりは1で、途中は速く進んでからゆっくりになる', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('tween', () => {
  it('経過の割合に応じて整数で途中の値を返す', () => {
    expect(tween(1000, 990, 0)).toBe(1000);
    expect(tween(1000, 990, 1)).toBe(990);
    expect(tween(100, 0, 0.5)).toBe(Math.round(100 - 100 * easeOutCubic(0.5)));
  });

  it('割合が範囲の外でも端の値にとどめる', () => {
    expect(tween(10, 0, -1)).toBe(10);
    expect(tween(10, 0, 2)).toBe(0);
  });
});
