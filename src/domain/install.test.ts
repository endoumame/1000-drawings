import { describe, expect, it } from 'vitest';
import { DISMISS_MS, installHint, isIos, type InstallEnv } from './install';

const env = (over: Partial<InstallEnv>): InstallEnv => ({
  standalone: false,
  ios: false,
  canPrompt: false,
  dismissedAt: null,
  now: 1_000_000_000,
  ...over,
});

describe('installHint', () => {
  it('ブラウザがインストール画面を出せるなら、ボタンつきの案内を出す', () => {
    expect(installHint(env({ canPrompt: true }))).toBe('prompt');
  });

  it('iPhone では手順の案内を出す', () => {
    expect(installHint(env({ ios: true }))).toBe('ios');
  });

  it('インストールの手段がないブラウザでは何も出さない', () => {
    expect(installHint(env({}))).toBe('none');
  });

  it('すでにアプリとして開いているなら何も出さない', () => {
    expect(installHint(env({ standalone: true, canPrompt: true }))).toBe('none');
    expect(installHint(env({ standalone: true, ios: true }))).toBe('none');
  });

  it('閉じてからしばらくは出さない', () => {
    const now = 1_000_000_000;
    expect(installHint(env({ ios: true, now, dismissedAt: now - DISMISS_MS + 1 }))).toBe('none');
  });

  it('閉じてから期間が過ぎたらまた出す', () => {
    const now = 1_000_000_000;
    expect(installHint(env({ ios: true, now, dismissedAt: now - DISMISS_MS }))).toBe('ios');
  });
});

describe('isIos', () => {
  it('iPhone を見分ける', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
    expect(isIos(ua, 5)).toBe(true);
  });

  it('Mac のふりをする iPad も見分ける', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
    expect(isIos(ua, 5)).toBe(true);
    expect(isIos(ua, 0)).toBe(false);
  });

  it('Android は iPhone 扱いしない', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
    expect(isIos(ua, 5)).toBe(false);
  });
});
