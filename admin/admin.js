/* =========================================================================
   カレンダー管理サイト（一覧・追加・編集・削除）
   見た目は公開サイトのカレンダーと同じ。データは Netlify Functions の窓口（/.netlify/functions/calendar）で、
   GitHub上の data/calendar.json を読み書きする。
   URLに ?mock=1 を付けて開くと、見本データで動く練習モード（実際のデータには、書き込まない）。
   ========================================================================= */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
// 公開サイトの calendar.js と同じ色。割り当ては CONFIG.classes の並び順
const PALETTE = [
  { c: '#1E8A54', pale: '#DDF1E4', ink: '#146238' },
  { c: '#2FA6D8', pale: '#DDF1FA', ink: '#17688C' },
  { c: '#F08A00', pale: '#FFF1DA', ink: '#9A5B00' },
  { c: '#D9455F', pale: '#FDE4E9', ink: '#A52440' },
  { c: '#7A5BC7', pale: '#EBE4FA', ink: '#50359A' },
  { c: '#A0713C', pale: '#F3E8DA', ink: '#704A1E' },
  { c: '#159A8C', pale: '#D9F2EF', ink: '#0B6A60' }
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const core = (t) => String(t || '').split(/[（(]/)[0].trim();

let items = [];
let classes = CONFIG.classes.slice(); // 教室の一覧。通常は、窓口(Apps Script)が「活動内容」のタブから返す。取れないときだけ config.js の値を使う
let multi = false;                    // 「複数の日にまとめて追加」モード
const picked = new Set();             // まとめて追加する日付
let pin = '';
let monthOffset = 0;
let selected = null; // "YYYY-MM-DD"
let busy = false;

const MOCK = new URLSearchParams(location.search).has('mock'); // ?mock=1 を付けて開くと、見本データで動く練習モード（PINは 1234）
try { pin = sessionStorage.getItem('calAdminPin') || ''; } catch (e) { pin = ''; }

/* ---------- 通信 ---------- */
async function api(action, payload) {
  const body = { action, pin, ...(payload || {}) };
  if (MOCK) return mockApi(body);
  const res = await fetch(CONFIG.api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// 教室の一覧を、公開サイトの「活動内容」シート（公開用CSV）の「タイトル」の列から読む。
// 「GKスクール（毎週木曜日）」→「GKスクール」のように、「（」より前を教室名にする。読めなければ config.js の値のまま
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
async function loadClasses() {
  if (!CONFIG.activitiesCsvUrl) return;
  try {
    const res = await fetch(CONFIG.activitiesCsvUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const rows = parseCsv(await res.text());
    const h = rows.slice(0, 6).findIndex((r) => r.some((c) => c.trim() === 'タイトル'));
    if (h < 0) return;
    const col = rows[h].findIndex((c) => c.trim() === 'タイトル');
    const names = [];
    rows.slice(h + 1).forEach((r) => {
      const n = core(r[col]);
      if (n && !names.includes(n)) names.push(n);
    });
    if (names.length) classes = names;
  } catch (e) { /* 読めなかったときは、config.js の一覧のまま */ }
}

// 練習モード用の、メモリ上の見本データ
const mock = { items: null };
function mockApi(req) {
  if (!mock.items) {
    const t = new Date();
    const day = (n) => { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n); return keyOf(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    mock.items = [
      { id: 'm1', date: day(1), cls: 'GKスクール', detail: '19:45〜21:00 / 1,000円（初回無料）' },
      { id: 'm2', date: day(2), cls: '大人の夜サカ(ゆるサカ)', detail: '19:45〜21:00 / 1,000円（高校生不可）' },
      { id: 'm3', date: day(4), cls: 'かけっこ教室', detail: '14:00〜15:00 / 小学生' },
      { id: 'm4', date: day(4), cls: 'シニアサッカー', detail: '15:30〜17:00' }
    ];
  }
  return new Promise((resolve) => setTimeout(() => {
    if (String(req.pin) !== '1234') return resolve({ ok: false, error: 'PINが違います' });
    if (req.action === 'add') (req.dates && req.dates.length ? req.dates : [req.date]).forEach((d, i) => mock.items.push({ id: 'm' + Date.now() + '-' + i, date: d, cls: req.cls, detail: req.detail || '' }));
    if (req.action === 'update') { const it = mock.items.find((x) => x.id === req.id); if (!it) return resolve({ ok: false, error: '予定が見つかりません' }); Object.assign(it, { date: req.date, cls: req.cls, detail: req.detail || '' }); }
    if (req.action === 'delete') { const ids = req.ids && req.ids.length ? req.ids : [req.id]; mock.items = mock.items.filter((x) => !ids.includes(x.id)); }
    resolve({ ok: true, items: mock.items.map((x) => ({ ...x })) });
  }, 250));
}

/* ---------- 画面の出し分け ---------- */
function toast(msg, ok) {
  const el = $('toast');
  el.hidden = false;
  el.textContent = msg;
  el.className = 'form-status ' + (ok ? 'is-ok' : 'is-error');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 5000);
}

function showApp() {
  $('loginView').hidden = true;
  $('appView').hidden = false;
  $('logoutBtn').hidden = false;
  render();
}
function showLogin(msg) {
  $('loginView').hidden = false;
  $('appView').hidden = true;
  $('logoutBtn').hidden = true;
  const st = $('loginStatus');
  st.hidden = !msg;
  st.textContent = msg || '';
  st.className = 'form-status is-error';
  $('pinInput').value = '';
  $('pinInput').focus();
}

/* ---------- 色 ---------- */
function classNames() {
  const names = classes.map(core);
  items.forEach((it) => { const c = core(it.cls); if (c && !names.includes(c)) names.push(c); });
  return names;
}
function colorStyle(cls) {
  const p = PALETTE[Math.max(classNames().indexOf(core(cls)), 0) % PALETTE.length];
  return `--c:${p.c};--c-pale:${p.pale};--c-ink:${p.ink}`;
}

/* ---------- 描画 ---------- */
function render() {
  renderCalendar();
  renderDay();
}

function renderCalendar() {
  const now = new Date();
  const view = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const y = view.getFullYear();
  const m = view.getMonth();
  $('calMonthLabel').textContent = `${y}年 ${m + 1}月`;

  const byDay = {};
  items.forEach((it) => {
    const mm = String(it.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!mm || Number(mm[1]) !== y || Number(mm[2]) !== m + 1) return;
    (byDay[it.date] = byDay[it.date] || []).push(it);
  });

  const first = (new Date(y, m, 1).getDay() + 6) % 7; // 月曜始まり
  const days = new Date(y, m + 1, 0).getDate();
  const today = keyOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="cal-cell cal-cell--empty"></div>';
  for (let d = 1; d <= days; d++) {
    const k = keyOf(y, m + 1, d);
    const tags = (byDay[k] || []).map((it) => `<span class="cal-tag" style="${colorStyle(it.cls)}" title="${esc(it.cls)}">${esc(it.cls)}</span>`).join('');
    cells += `
      <button type="button" class="cal-cell${k === today ? ' cal-cell--today' : ''}${multi ? (picked.has(k) ? ' cal-cell--selected' : '') : (k === selected ? ' cal-cell--selected' : '')}" data-date="${k}">
        <span class="cal-date">${d}</span>
        <div class="cal-tags">${tags}</div>
      </button>`;
  }
  const trailing = (7 - ((first + days) % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += '<div class="cal-cell cal-cell--empty"></div>';
  $('calGrid').innerHTML = cells;

  const present = classNames().filter((n) => Object.values(byDay).some((list) => list.some((it) => core(it.cls) === n)));
  $('calLegend').innerHTML = present.map((n) => `<span class="cal-legend-item" style="${colorStyle(n)}"><i></i>${esc(n)}</span>`).join('');
}

function fmtJa(k) {
  const mm = k.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = new Date(Number(mm[1]), Number(mm[2]) - 1, Number(mm[3]));
  return `${mm[1]}年${Number(mm[2])}月${Number(mm[3])}日（${WEEKDAYS[d.getDay()]}）`;
}

// 「複数の日にまとめて追加」モードのパネル：選んだ日を一覧し、教室と内容を入れて、まとめて追加する
function renderMulti() {
  const days = [...picked].sort();
  $('dayPanel').innerHTML = `
    <h2>複数の日にまとめて追加</h2>
    <p class="empty-note">カレンダーの日付を、追加したい日だけ、押してください（もう一度押すと、選びなおせます）。</p>
    <p><strong>選んだ日（${days.length}日）：</strong>${days.length ? days.map((k) => esc(fmtJa(k))).join('、') : 'まだ選んでいません'}</p>
    <form class="site-form admin-form" id="multiForm">
      <label><span class="lbl">教室 <span class="req">必須</span></span>
        <select name="cls" required>${classes.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label><span class="lbl">詳しい内容（時間・料金など）</span>
        <textarea name="detail" rows="3" maxlength="500" placeholder="例：19:45〜21:00 / 1,000円"></textarea></label>
      <div class="row">
        <button type="submit" class="btn btn-cta" ${days.length ? '' : 'disabled'}>${days.length}日分を追加する</button>
        <button type="button" class="btn btn-ghost" id="multiCancel">やめる</button>
      </div>
    </form>`;
  $('multiForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const ds = [...picked].sort();
    multi = false;
    picked.clear();
    run('add', { dates: ds, cls: f.cls.value, detail: f.detail.value.trim() }, `${ds.length}日分を追加しました`);
  });
  $('multiCancel').addEventListener('click', () => { multi = false; picked.clear(); $('multiBtn').textContent = '複数の日にまとめて追加'; render(); });
}

function renderDay() {
  const panel = $('dayPanel');
  if (multi) return renderMulti();
  if (!selected) {
    panel.innerHTML = '<p class="empty-note">日付を押すと、その日の予定が表示されます。予定の追加・編集・削除は、ここからできます。</p>';
    return;
  }
  const list = items.filter((it) => it.date === selected);
  panel.innerHTML = `
    <h2>${esc(fmtJa(selected))}</h2>
    ${list.length ? `<ul class="admin-list">${list.map((it) => `
      <li class="admin-item" style="${colorStyle(it.cls)}">
        <input type="checkbox" class="admin-check" data-pick="${esc(it.id)}" aria-label="選ぶ">
        <div class="admin-item-main"><strong>${esc(it.cls)}</strong>${it.detail ? `<small>${esc(it.detail)}</small>` : ''}</div>
        <div class="admin-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit="${esc(it.id)}">編集</button>
          <button type="button" class="btn btn-danger btn-sm" data-del="${esc(it.id)}">削除</button>
        </div>
      </li>`).join('')}</ul>
      <p class="admin-bulk"><button type="button" class="btn btn-danger btn-sm" id="bulkDel" disabled>選んだ予定を削除</button></p>` : '<p class="empty-note">この日の予定は、まだありません。</p>'}
    <div id="formArea"><button type="button" class="btn btn-cta btn-sm" id="addBtn">この日に予定を追加</button></div>`;
}

function openForm(item) {
  const isEdit = !!item;
  const cur = item || { id: '', date: selected, cls: classes[0], detail: '' };
  const known = classes.includes(cur.cls) ? classes : [cur.cls, ...classes];
  $('formArea').innerHTML = `
    <form class="site-form admin-form" id="evForm">
      <label><span class="lbl">日付 <span class="req">必須</span></span>
        <input type="date" name="date" value="${esc(cur.date)}" required></label>
      <label><span class="lbl">教室 <span class="req">必須</span></span>
        <select name="cls" required>${known.map((c) => `<option${c === cur.cls ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label><span class="lbl">詳しい内容（時間・料金など）</span>
        <textarea name="detail" rows="3" maxlength="500" placeholder="例：19:45〜21:00 / 1,000円">${esc(cur.detail)}</textarea></label>
      <div class="row">
        <button type="submit" class="btn btn-cta">${isEdit ? '変更を保存' : '追加する'}</button>
        <button type="button" class="btn btn-ghost" id="cancelBtn">キャンセル</button>
      </div>
    </form>`;
  $('evForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    run(isEdit ? 'update' : 'add', { id: cur.id, date: f.date.value, cls: f.cls.value, detail: f.detail.value.trim() },
      isEdit ? '変更しました' : '追加しました');
  });
  $('cancelBtn').addEventListener('click', renderDay);
  $('evForm').elements.cls.focus();
}

/* ---------- 操作 ---------- */
async function run(action, payload, doneMsg) {
  if (busy) return;
  busy = true;
  document.body.style.cursor = 'progress';
  try {
    const r = await api(action, payload);
    if (!r.ok) {
      if (/PIN/.test(r.error || '')) { sessionStorage.removeItem('calAdminPin'); showLogin(r.error); return; }
      throw new Error(r.error || '失敗しました');
    }
    items = r.items;
    if (r.classes && r.classes.length) classes = r.classes;
    const shown = payload && (payload.date || (payload.dates && payload.dates[0]));
    if (shown && action !== 'delete') {
      selected = shown; // 追加・変更した日を表示する
      const mm = shown.match(/^(\d{4})-(\d{2})/);
      const now = new Date();
      monthOffset = (Number(mm[1]) - now.getFullYear()) * 12 + (Number(mm[2]) - 1 - now.getMonth());
    }
    render();
    if (doneMsg) toast(doneMsg + '（公開サイトへの反映には、1分ほどかかります）', true);
  } catch (err) {
    toast('できませんでした：' + (err.message || err) + '。通信を確認して、もう一度お試しください', false);
  } finally {
    busy = false;
    document.body.style.cursor = '';
  }
}

async function login(p) {
  pin = p;
  const st = $('loginStatus');
  st.hidden = false;
  st.className = 'form-status';
  st.textContent = '確認しています…';
  try {
    const r = await api('list');
    if (!r.ok) throw new Error(r.error || 'ログインできませんでした');
    items = r.items;
    await loadClasses();
    try { sessionStorage.setItem('calAdminPin', pin); } catch (e) { /* 保存できなくても動く */ }
    const now = new Date();
    selected = keyOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
    showApp();
  } catch (err) {
    showLogin(String(err.message || err));
  }
}

/* ---------- 初期化 ---------- */
$('mockNote').hidden = !MOCK;
$('loginForm').addEventListener('submit', (e) => { e.preventDefault(); login($('pinInput').value.trim()); });
$('logoutBtn').addEventListener('click', () => {
  try { sessionStorage.removeItem('calAdminPin'); } catch (e) { /* 何もしない */ }
  pin = '';
  showLogin('');
});
$('calPrev').addEventListener('click', () => { monthOffset -= 1; renderCalendar(); });
$('calNext').addEventListener('click', () => { monthOffset += 1; renderCalendar(); });
$('calToday').addEventListener('click', () => {
  monthOffset = 0;
  const n = new Date();
  selected = keyOf(n.getFullYear(), n.getMonth() + 1, n.getDate());
  render();
});
$('calGrid').addEventListener('click', (e) => {
  const cell = e.target.closest('.cal-cell[data-date]');
  if (!cell) return;
  const k = cell.dataset.date;
  if (multi) {
    // まとめて追加モード：押すたびに、選ぶ／外すを切り替える（月をまたいでも選べる）
    if (picked.has(k)) picked.delete(k); else picked.add(k);
  } else {
    selected = k;
  }
  render();
});
$('multiBtn').addEventListener('click', () => {
  multi = !multi;
  picked.clear();
  $('multiBtn').textContent = multi ? '複数選択をやめる' : '複数の日にまとめて追加';
  render();
});
$('dayPanel').addEventListener('change', (e) => {
  if (!e.target.matches('.admin-check')) return;
  $('bulkDel').disabled = !document.querySelector('.admin-check:checked');
});
$('dayPanel').addEventListener('click', (e) => {
  if (e.target.closest('#bulkDel')) {
    const ids = [...document.querySelectorAll('.admin-check:checked')].map((c) => c.dataset.pick);
    if (ids.length && confirm(`${fmtJa(selected)}\n選んだ${ids.length}件の予定を削除します。よろしいですか？`)) run('delete', { ids }, `${ids.length}件を削除しました`);
    return;
  }
  if (e.target.closest('#addBtn')) return openForm(null);
  const edit = e.target.closest('[data-edit]');
  if (edit) return openForm(items.find((it) => it.id === edit.dataset.edit));
  const del = e.target.closest('[data-del]');
  if (del) {
    const it = items.find((x) => x.id === del.dataset.del);
    if (it && confirm(`${fmtJa(it.date)}\n「${it.cls}」を削除します。よろしいですか？`)) run('delete', { id: it.id }, '削除しました');
  }
});

if (pin) login(pin); else showLogin('');
