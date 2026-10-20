const pad = (n: number) => String(n).padStart(2, '0');

/** 端末の現地時刻での今日（YYYY-MM-DD） */
export function today(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 端末の現地時刻での今の時刻（HH:MM） */
export function nowTime(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
