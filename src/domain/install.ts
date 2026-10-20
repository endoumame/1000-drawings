/** 'prompt'：ブラウザのインストール画面を開ける（Android の Chrome など）。'ios'：手順を案内する。 */
export type InstallHint = 'none' | 'prompt' | 'ios';

export interface InstallEnv {
  /** ホーム画面のアプリとして開いている */
  standalone: boolean;
  ios: boolean;
  /** beforeinstallprompt を受け取っている */
  canPrompt: boolean;
  dismissedAt: number | null;
  now: number;
}

/** 案内を閉じたら、この間は出さない */
export const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export function installHint(env: InstallEnv): InstallHint {
  if (env.standalone) return 'none';
  if (env.dismissedAt !== null && env.now - env.dismissedAt < DISMISS_MS) return 'none';
  if (env.canPrompt) return 'prompt';
  if (env.ios) return 'ios';
  return 'none';
}

/** iPadOS の Safari は Mac と同じ UA を名乗るので、タッチ対応かどうかで見分ける */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
