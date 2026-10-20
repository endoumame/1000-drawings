import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { isValidCount, isValidDate, isValidTime, parseBackup, serializeBackup } from './domain/backup';
import { addEntry, dayTotal, deleteEntry, formatDate, summarize, updateEntry } from './domain/records';
import { GOAL, MODES, type Entry, type Mode } from './domain/types';
import { nowTime, today } from './clock';
import { loadEntries, loadMode, requestPersistence, saveEntries, saveMode } from './storage';

type Screen = 'home' | 'history' | 'settings';

interface Draft {
  count: number;
  date: string;
  time: string;
}

interface Sheet {
  kind: 'add' | 'edit';
  /** 編集中の記録 */
  id?: string;
  draft: Draft;
  confirmDelete: boolean;
  error: string;
  /** 開いた直後の描画だけ出てくる動きをつける（数を変えるたびに動かないように） */
  entering: boolean;
}

interface State {
  entries: Entry[];
  mode: Mode;
  screen: Screen;
  sheet: Sheet | null;
  pendingImport: Entry[] | null;
  settingsMessage: string;
}

const QUICK_STEPS = [1, 5, 10, 20];
const DEFAULT_COUNT = 10;
const TOAST_MS = 2600;

const state: State = {
  entries: loadEntries(),
  mode: loadMode(),
  screen: 'home',
  sheet: null,
  pendingImport: null,
  settingsMessage: '',
};

const app = document.querySelector<HTMLDivElement>('#app')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;

// ---- 描画 ----

const icon = {
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  flag: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/>',
};

const svg = (name: keyof typeof icon, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]}</svg>`;

const esc = (s: string | number) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const modeName = (mode: Mode) => `${mode}秒ドローイング`;

function render(): void {
  const focusKey = (document.activeElement as HTMLElement | null)?.dataset.key;
  document.documentElement.dataset.mode = state.mode;
  document.body.classList.toggle('is-locked', state.sheet !== null);

  const screen =
    state.screen === 'home' ? renderHome() : state.screen === 'history' ? renderHistory() : renderSettings();
  app.innerHTML = `
    ${screen}
    ${state.screen !== 'settings' ? `<button class="fab" data-action="open-add" data-key="fab">${svg('plus', 20)}描いた</button>` : ''}
    ${state.sheet ? renderSheet(state.sheet) : ''}
  `;
  if (state.sheet) state.sheet.entering = false;

  if (focusKey) {
    app.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
  }
}

function renderTabs(): string {
  return `
    <div class="tabs" role="group" aria-label="ドローイングの種類">
      ${MODES.map(
        (m) => `<button class="tab" data-action="mode" data-mode="${m}" data-key="tab-${m}" aria-pressed="${m === state.mode}">${m}秒</button>`,
      ).join('')}
    </div>`;
}

function renderHome(): string {
  const s = summarize(state.entries, state.mode, today());
  const milestone = s.nextMilestone
    ? `次の節目 ${s.nextMilestone.target}体まで、あと${s.nextMilestone.rest}体`
    : `${GOAL}体達成！ほんまにおつかれさま。`;
  const recent = s.days.slice(0, 3);

  return `
    <main class="screen">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">${svg('pencil', 16)}</span>1000体ドローイング</div>
        <div class="topbar-end">
          <span class="muted">${esc(formatDate(today()))}</span>
          <button class="icon-btn" data-action="go" data-screen="settings" data-key="go-settings" aria-label="設定">${svg('settings', 20)}</button>
        </div>
      </header>
      ${renderTabs()}
      <section class="card hero" aria-labelledby="remaining-label">
        <div class="hero-count">
          <h1 id="remaining-label" class="hero-label">${esc(modeName(state.mode))}　ゴールまで</h1>
          <p class="hero-number"><span class="num">${s.remaining}</span><span class="unit">体</span></p>
        </div>
        <div class="progress" role="progressbar" aria-label="描いた数" aria-valuemin="0" aria-valuemax="${GOAL}" aria-valuenow="${Math.min(s.total, GOAL)}">
          <div class="progress-bar" style="width: ${(s.progress * 100).toFixed(1)}%"></div>
        </div>
        <div class="hero-meta">
          <span>描いた数 <b>${s.total}</b> / ${GOAL}</span>
          <span>今日 <b>${s.todayTotal}</b> 体</span>
        </div>
        <p class="milestone">${svg('flag', 16)}${esc(milestone)}</p>
      </section>
      <section class="recent" aria-labelledby="recent-title">
        <div class="section-head">
          <h2 id="recent-title">最近の記録</h2>
          ${s.days.length > 0 ? `<button class="link-btn" data-action="go" data-screen="history" data-key="go-history">すべて見る</button>` : ''}
        </div>
        ${
          recent.length === 0
            ? `<p class="empty">まだ記録がありません。描いたら右下の「描いた」から記録できます。</p>`
            : `<ul class="list">${recent
                .map(
                  (d) => `
            <li class="row">
              <div>
                <div class="row-title">${d.date === today() ? '今日 ' : ''}${esc(formatDate(d.date))}</div>
                <div class="row-sub">${d.sessions.length}回に分けて</div>
              </div>
              <div class="row-total"><span class="num">${d.total}</span><span class="unit">体</span></div>
            </li>`,
                )
                .join('')}</ul>`
        }
      </section>
    </main>`;
}

function renderHistory(): string {
  const s = summarize(state.entries, state.mode, today());
  const avg = s.days.length ? Math.round(s.total / s.days.length) : 0;
  return `
    <main class="screen">
      <header class="topbar">
        <div class="topbar-start">
          <button class="icon-btn back" data-action="go" data-screen="home" data-key="back" aria-label="ホームに戻る">${svg('back', 22)}</button>
          <h1 class="page-title">これまでの記録</h1>
        </div>
      </header>
      ${renderTabs()}
      <div class="stats">
        <div class="stat"><div class="stat-label">合計</div><div class="num stat-value">${s.total}</div></div>
        <div class="stat"><div class="stat-label">描いた日数</div><div class="num stat-value">${s.days.length}</div></div>
        <div class="stat"><div class="stat-label">1日平均</div><div class="num stat-value">${avg}</div></div>
      </div>
      ${
        s.days.length === 0
          ? `<p class="empty">${esc(modeName(state.mode))}の記録はまだありません。</p>`
          : `<p class="hint">内訳をタップすると、直したり消したりできます。</p>
        <ul class="list">${s.days
          .map(
            (d) => `
          <li class="day">
            <div class="day-head">
              <h2 class="row-title">${d.date === today() ? '今日 ' : ''}${esc(formatDate(d.date))}</h2>
              <div class="row-total"><span class="num">${d.total}</span><span class="unit">体</span></div>
            </div>
            <div class="chips">
              ${d.sessions
                .map(
                  (e) =>
                    `<button class="chip" data-action="open-edit" data-id="${esc(e.id)}" data-key="edit-${esc(e.id)}" aria-label="${esc(formatDate(d.date))} ${esc(e.time)} の${e.count}体を編集">${esc(e.time)}　+${e.count}</button>`,
                )
                .join('')}
            </div>
          </li>`,
          )
          .join('')}</ul>`
      }
    </main>`;
}

function renderSettings(): string {
  const pending = state.pendingImport;
  return `
    <main class="screen">
      <header class="topbar">
        <div class="topbar-start">
          <button class="icon-btn back" data-action="go" data-screen="home" data-key="back" aria-label="ホームに戻る">${svg('back', 22)}</button>
          <h1 class="page-title">設定</h1>
        </div>
      </header>
      <section class="card panel" aria-labelledby="export-title">
        <h2 id="export-title">記録を書き出す</h2>
        <p>30秒と90秒のすべての記録を1つのファイルに保存します。機種変更のときや、念のための控えに使えます。</p>
        <button class="btn btn-primary" data-action="export" data-key="export">${svg('download', 18)}書き出す</button>
      </section>
      <section class="card panel" aria-labelledby="import-title">
        <h2 id="import-title">記録を読み込む</h2>
        <p>書き出したファイルを読み込みます。今の記録は、読み込んだ記録に置き換わります。</p>
        ${
          pending
            ? `<div class="confirm" role="alertdialog" aria-labelledby="import-confirm">
                <p id="import-confirm">今の記録（${state.entries.length}件）を消して、読み込んだ記録（${pending.length}件）に置き換えます。よろしいですか？</p>
                <div class="confirm-actions">
                  <button class="btn btn-secondary" data-action="import-cancel" data-key="import-cancel">やめる</button>
                  <button class="btn btn-danger" data-action="import-apply" data-key="import-apply">置き換える</button>
                </div>
              </div>`
            : `<label class="btn btn-secondary file-btn">${svg('upload', 18)}ファイルを選ぶ<input type="file" accept="application/json,.json" data-field="import" data-key="import"></label>`
        }
      </section>
      <p class="status" role="status">${esc(state.settingsMessage)}</p>
      <p class="footnote">記録はこの端末のブラウザの中に保存されています。ブラウザのデータを消すと記録も消えるので、ときどき書き出しておくと安心です。</p>
    </main>`;
}

function renderSheet(sheet: Sheet): string {
  const { draft } = sheet;
  const isEdit = sheet.kind === 'edit';
  const others = dayTotal(state.entries, state.mode, draft.date, sheet.id);
  const validDate = isValidDate(draft.date);
  const hint = !validDate
    ? '日付を選んでください'
    : isEdit
      ? `${formatDate(draft.date)}の合計は ${others + draft.count}体 になります`
      : others > 0
        ? `${formatDate(draft.date)}は ${others}体 → ${others + draft.count}体 にプラスされます`
        : `${formatDate(draft.date)}の記録として新しく追加されます`;
  const title = isEdit ? `${modeName(state.mode)}の記録を編集` : `${modeName(state.mode)}を追加`;

  return `
    <div class="overlay">
      <button class="scrim" data-action="close-sheet" aria-label="閉じる" tabindex="-1"></button>
      <div class="sheet${sheet.entering ? ' is-entering' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="grabber" aria-hidden="true"></div>
        <div class="sheet-head">
          <h2 id="sheet-title">${esc(title)}</h2>
          <button class="icon-btn round" data-action="close-sheet" data-key="close-sheet" aria-label="閉じる">${svg('close', 18)}</button>
        </div>
        <div class="stepper">
          <button class="step-btn" data-action="step" data-step="-1" data-key="dec" aria-label="1減らす">${svg('minus', 20)}</button>
          <p class="stepper-value" aria-live="polite"><span class="num">${draft.count}</span><span class="unit">体</span></p>
          <button class="step-btn" data-action="step" data-step="1" data-key="inc" aria-label="1増やす">${svg('plus', 20)}</button>
        </div>
        <div class="quick">
          ${QUICK_STEPS.map((n) => `<button class="quick-btn" data-action="step" data-step="${n}" data-key="quick-${n}">+${n}</button>`).join('')}
        </div>
        <div class="fields">
          <label class="field">日付
            <input type="date" value="${esc(draft.date)}" max="${today()}" data-field="date" data-key="date" required>
          </label>
          <label class="field">時刻
            <input type="time" value="${esc(draft.time)}" data-field="time" data-key="time" required>
          </label>
        </div>
        <p class="merge-hint">${esc(hint)}</p>
        ${sheet.error ? `<p class="error" role="alert">${esc(sheet.error)}</p>` : ''}
        <button class="btn btn-primary btn-lg" data-action="save" data-key="save">${isEdit ? '保存する' : '記録する'}</button>
        ${
          isEdit
            ? sheet.confirmDelete
              ? `<div class="confirm" role="alertdialog" aria-labelledby="delete-confirm">
                  <p id="delete-confirm">この記録を削除しますか？元には戻せません。</p>
                  <div class="confirm-actions">
                    <button class="btn btn-secondary" data-action="delete-cancel" data-key="delete-cancel">やめる</button>
                    <button class="btn btn-danger" data-action="delete-apply" data-key="delete-apply">削除する</button>
                  </div>
                </div>`
              : `<button class="btn btn-ghost-danger" data-action="delete" data-key="delete">この記録を削除</button>`
            : ''
        }
      </div>
    </div>`;
}

// ---- 操作 ----

let toastTimer: number | undefined;
function toast(message: string): void {
  toastEl.textContent = message;
  toastEl.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
    toastEl.textContent = '';
  }, TOAST_MS);
}

function commit(entries: Entry[]): void {
  state.entries = entries;
  saveEntries(entries);
}

function openAdd(): void {
  state.sheet = {
    kind: 'add',
    draft: { count: DEFAULT_COUNT, date: today(), time: nowTime() },
    confirmDelete: false,
    error: '',
    entering: true,
  };
  render();
  app.querySelector<HTMLElement>('[data-key="close-sheet"]')?.focus();
}

function openEdit(id: string): void {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return;
  state.sheet = {
    kind: 'edit',
    id,
    draft: { count: e.count, date: e.date, time: e.time },
    confirmDelete: false,
    error: '',
    entering: true,
  };
  render();
  app.querySelector<HTMLElement>('[data-key="close-sheet"]')?.focus();
}

function closeSheet(): void {
  const returnKey = state.sheet?.kind === 'edit' ? 'back' : 'fab';
  state.sheet = null;
  render();
  app.querySelector<HTMLElement>(`[data-key="${returnKey}"]`)?.focus();
}

function save(): void {
  const sheet = state.sheet;
  if (!sheet) return;
  const { draft } = sheet;
  if (!isValidDate(draft.date) || !isValidTime(draft.time) || !isValidCount(draft.count)) {
    sheet.error = '日付・時刻・数を確かめてください';
    render();
    return;
  }
  if (draft.date > today()) {
    sheet.error = '未来の日付は選べません';
    render();
    return;
  }

  const mode = state.mode;
  const before = summarize(state.entries, mode, today()).total;
  if (sheet.kind === 'add') {
    commit(addEntry(state.entries, { mode, ...draft }, crypto.randomUUID(), new Date().toISOString()));
  } else if (sheet.id) {
    commit(updateEntry(state.entries, sheet.id, draft));
  }
  const after = summarize(state.entries, mode, today()).total;
  const crossed = Math.floor(after / 100) > Math.floor(before / 100) ? Math.min(Math.floor(after / 100) * 100, GOAL) : 0;
  const dayAfter = dayTotal(state.entries, mode, draft.date);

  state.sheet = null;
  render();
  if (crossed) {
    toast(crossed >= GOAL ? `${GOAL}体達成！ほんまにおつかれさま。` : `${crossed}体達成！この調子。`);
  } else if (sheet.kind === 'add') {
    toast(`${mode}秒 +${draft.count}体！ ${formatDate(draft.date)}は合計${dayAfter}体になりました`);
  } else {
    toast('記録を直しました');
  }
}

async function exportEntries(): Promise<void> {
  const text = serializeBackup(state.entries, new Date().toISOString());
  const name = `1000-drawings-${today().replaceAll('-', '')}.json`;
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      state.settingsMessage = '書き出しました';
      render();
      return;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  state.settingsMessage = `${name} を書き出しました`;
  render();
}

async function readImport(input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;
  try {
    state.pendingImport = parseBackup(await file.text());
    state.settingsMessage = '';
  } catch (err) {
    state.pendingImport = null;
    state.settingsMessage = `読み込めませんでした：${err instanceof Error ? err.message : '不明なエラー'}`;
  }
  render();
  app.querySelector<HTMLElement>('[data-key="import-cancel"]')?.focus();
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) return;
  const sheet = state.sheet;

  switch (el.dataset.action) {
    case 'mode':
      state.mode = el.dataset.mode as Mode;
      saveMode(state.mode);
      render();
      break;
    case 'go':
      state.screen = el.dataset.screen as Screen;
      state.pendingImport = null;
      state.settingsMessage = '';
      render();
      window.scrollTo(0, 0);
      app.querySelector<HTMLElement>(state.screen === 'home' ? '[data-key="fab"]' : '[data-key="back"]')?.focus();
      break;
    case 'open-add':
      openAdd();
      break;
    case 'open-edit':
      openEdit(el.dataset.id ?? '');
      break;
    case 'close-sheet':
      closeSheet();
      break;
    case 'step':
      if (sheet) {
        sheet.draft.count = Math.min(9999, Math.max(1, sheet.draft.count + Number(el.dataset.step)));
        sheet.error = '';
        render();
      }
      break;
    case 'save':
      save();
      break;
    case 'delete':
    case 'delete-cancel':
      if (sheet) {
        sheet.confirmDelete = el.dataset.action === 'delete';
        render();
        app.querySelector<HTMLElement>(sheet.confirmDelete ? '[data-key="delete-cancel"]' : '[data-key="delete"]')?.focus();
      }
      break;
    case 'delete-apply':
      if (sheet?.id) {
        commit(deleteEntry(state.entries, sheet.id));
        state.sheet = null;
        render();
        app.querySelector<HTMLElement>('[data-key="back"]')?.focus();
        toast('記録を削除しました');
      }
      break;
    case 'export':
      void exportEntries();
      break;
    case 'import-cancel':
      state.pendingImport = null;
      state.settingsMessage = '読み込みをやめました';
      render();
      break;
    case 'import-apply':
      if (state.pendingImport) {
        commit(state.pendingImport);
        state.settingsMessage = `${state.pendingImport.length}件の記録を読み込みました`;
        state.pendingImport = null;
        render();
      }
      break;
  }
});

app.addEventListener('change', (ev) => {
  const input = ev.target as HTMLInputElement;
  const field = input.dataset.field;
  if (field === 'import') {
    void readImport(input);
    return;
  }
  const sheet = state.sheet;
  if (!sheet || (field !== 'date' && field !== 'time')) return;
  sheet.draft[field] = input.value;
  sheet.error = '';
  render();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state.sheet) closeSheet();
});

// 日付が変わったまま開きっぱなしでも「今日」がずれないよう、戻ってきたら描き直す
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !state.sheet) render();
});

render();
requestPersistence();
registerSW({ immediate: true });
