import { tween } from './domain/motion';

/** 記録したときの演出に渡す値。残りは今の1000体の中での数。 */
export interface RecordEffect {
  fromRemaining: number;
  toRemaining: number;
  added: number;
  goal: number;
  lapCompleted: boolean;
  stepReached: boolean;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 記録したときに、数字を減らしながらリングを満たし、節目ならお祝いする。 */
export function playRecordEffect(root: HTMLElement, e: RecordEffect): void {
  navigator.vibrate?.(e.lapCompleted ? [30, 60, 30] : 12);
  if (reducedMotion()) return;

  const num = root.querySelector<HTMLElement>('[data-remaining]');
  const fill = root.querySelector<SVGCircleElement>('.ring-fill');
  const wrap = root.querySelector<HTMLElement>('.ring-wrap');
  if (!num || !fill || !wrap) {
    // ホーム以外から記録したときは、リングがないのでお祝いだけ
    if (e.lapCompleted) confetti('big');
    else if (e.stepReached) confetti('small');
    return;
  }

  const percent = (remaining: number) => ((e.goal - remaining) / e.goal) * 100;
  floatPlus(wrap, e.added);
  setRing(fill, percent(e.fromRemaining), false);
  num.textContent = String(e.fromRemaining);

  if (!e.lapCompleted) {
    setRing(fill, percent(e.toRemaining), true);
    countTo(num, e.fromRemaining, e.toRemaining, 800, () => {
      pop(num);
      if (e.stepReached) confetti('small', centerOf(wrap));
    });
    return;
  }

  // 1000体達成：いったん0まで減らしてリングを一周満たし、お祝いしてから次の1000体へ
  setRing(fill, 100, true);
  countTo(num, e.fromRemaining, 0, 600, () => {
    wrap.classList.add('is-complete');
    confetti('big');
    window.setTimeout(() => {
      wrap.classList.remove('is-complete');
      setRing(fill, 0, false);
      setRing(fill, percent(e.toRemaining), true);
      countTo(num, e.goal, e.toRemaining, 700, () => pop(num));
    }, 1100);
  });
}

/** 画面を開いたときやタブを切り替えたときに、リングを0から今の位置まで満たす。 */
export function playRingIn(root: HTMLElement): void {
  if (reducedMotion()) return;
  const fill = root.querySelector<SVGCircleElement>('.ring-fill');
  if (!fill) return;
  const target = Number(fill.dataset.percent);
  setRing(fill, 0, false);
  setRing(fill, target, true);
}

function setRing(fill: SVGCircleElement, percent: number, animate: boolean): void {
  fill.classList.toggle('no-anim', !animate);
  fill.classList.toggle('is-empty', percent <= 0);
  fill.style.strokeDashoffset = String(100 - percent);
  // 次の変更をアニメーションさせるため、ここで一度描画位置を確定させる
  if (!animate) fill.getBoundingClientRect();
}

function countTo(el: HTMLElement, from: number, to: number, ms: number, done: () => void): void {
  const start = performance.now();
  const step = (now: number) => {
    const t = (now - start) / ms;
    el.textContent = String(tween(from, to, t));
    if (t < 1) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}

function pop(el: HTMLElement): void {
  el.classList.remove('is-pop');
  void el.offsetWidth;
  el.classList.add('is-pop');
}

function floatPlus(wrap: HTMLElement, added: number): void {
  const badge = document.createElement('span');
  badge.className = 'float-plus';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = `+${added}`;
  badge.addEventListener('animationend', () => badge.remove());
  wrap.append(badge);
}

function centerOf(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
}

/** 紙吹雪。small は指定した位置から、big は画面の下の両端から打ち上げる。 */
export function confetti(size: 'small' | 'big', origin?: { x: number; y: number }): void {
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f6b66';
  const colors = [accent, '#e9b949', '#d97b66', '#7fa8a3', '#1f1d1a'];
  const pick = () => colors[Math.floor(Math.random() * colors.length)];
  const pieces: Piece[] = [];
  const launch = (x: number, y: number, angle: number, spread: number, speed: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.6 + Math.random() * 0.6);
      pieces.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: pick(),
      });
    }
  };

  if (size === 'big') {
    launch(0, H, -Math.PI / 3, 0.9, 19, 80);
    launch(W, H, (-2 * Math.PI) / 3, 0.9, 19, 80);
  } else {
    const o = origin ?? { x: W / 2, y: H / 3 };
    launch(o.x, o.y, -Math.PI / 2, Math.PI * 1.4, 9, 46);
  }

  const start = performance.now();
  const life = size === 'big' ? 3200 : 1800;
  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - life * 0.6) / (life * 0.4));
    for (const p of pieces) {
      p.vy += 0.38;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
      ctx.restore();
    }
    if (elapsed < life) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
