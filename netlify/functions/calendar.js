/* =========================================================================
   カレンダー管理サイトの「書き込みの窓口」（Netlify Functions）
   管理サイト(/admin/)から、PINつきで依頼を受けて、GitHub上の data/calendar.json を更新する。
   更新されると、Netlifyが自動で再公開して、公開サイトのカレンダーに反映される（1分ほど）。

   必要な環境変数（Netlifyの「Environment variables」に設定する。コードには書かない）
     ADMIN_PIN     管理サイトの合言葉
     GITHUB_TOKEN  GitHubのトークン（このリポジトリの Contents を読み書きできる権限だけにする）
     GITHUB_REPO   例：negi1223/test-sports-terrace
     GITHUB_BRANCH 省略すると main
   ========================================================================= */

const crypto = require('crypto');

const FILE = 'data/calendar.json';
const MAX_DATES = 60;
const RETRY = 3;

const reply = (obj) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj)
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pinOk(given) {
  const real = process.env.ADMIN_PIN;
  if (!real) throw new Error('サーバーの設定（ADMIN_PIN）がありません');
  const a = Buffer.from(String(given == null ? '' : given));
  const b = Buffer.from(String(real));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- GitHub ---------- */
function ghHeaders() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) throw new Error('サーバーの設定（GITHUB_TOKEN / GITHUB_REPO）がありません');
  return {
    Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'calendar-admin',
    'Content-Type': 'application/json'
  };
}
const ghUrl = () => `https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${FILE}`;
const branch = () => process.env.GITHUB_BRANCH || 'main';

async function readFile() {
  const res = await fetch(`${ghUrl()}?ref=${encodeURIComponent(branch())}`, { headers: ghHeaders() });
  if (res.status === 404) return { items: [], sha: null };
  if (!res.ok) throw new Error('GitHubから読めませんでした（' + res.status + '）');
  const j = await res.json();
  const data = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
  return { items: Array.isArray(data.items) ? data.items : [], sha: j.sha };
}

// 戻り値 true＝保存できた／false＝同時に誰かが更新していた（やり直す）
async function writeFile(items, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify({ items }, null, 2) + '\n', 'utf8').toString('base64'),
    branch: branch()
  };
  if (sha) body.sha = sha;
  const res = await fetch(ghUrl(), { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if (res.ok) return true;
  if (res.status === 409 || res.status === 422) return false;
  throw new Error('GitHubに保存できませんでした（' + res.status + '）');
}

/* ---------- 入力の確認 ---------- */
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
function cleanFields(req) {
  const cls = String(req.cls || '').trim();
  if (!cls || cls.length > 60) throw new Error('教室を選んでください');
  const detail = String(req.detail || '').trim();
  if (detail.length > 500) throw new Error('詳しい内容は500文字までです');
  return { cls, detail };
}

/* ---------- 操作 ---------- */
function apply(items, req) {
  switch (req.action) {
    case 'add': {
      const dates = req.dates && req.dates.length ? req.dates : [req.date];
      if (dates.length > MAX_DATES) throw new Error(`一度に追加できるのは、${MAX_DATES}日分までです`);
      if (!dates.every(validDate)) throw new Error('日付の形式が正しくありません');
      const f = cleanFields(req);
      const added = dates.map((date) => ({ id: crypto.randomUUID(), date, cls: f.cls, detail: f.detail }));
      return { items: items.concat(added), message: `予定を${added.length}件追加（${added[0].cls}）` };
    }
    case 'update': {
      if (!validDate(req.date)) throw new Error('日付の形式が正しくありません');
      const f = cleanFields(req);
      if (!items.some((x) => x.id === req.id)) throw new Error('予定が見つかりません（ほかの人が先に削除した可能性があります）。画面を更新してください');
      return { items: items.map((x) => (x.id === req.id ? { id: x.id, date: req.date, cls: f.cls, detail: f.detail } : x)), message: `予定を変更（${f.cls}）` };
    }
    case 'delete': {
      const ids = req.ids && req.ids.length ? req.ids : [req.id];
      const rest = items.filter((x) => !ids.includes(x.id));
      if (rest.length === items.length) throw new Error('予定が見つかりません（ほかの人が先に削除した可能性があります）。画面を更新してください');
      return { items: rest, message: `予定を${items.length - rest.length}件削除` };
    }
    default:
      throw new Error('不明な操作です');
  }
}
const sortItems = (items) => items.slice().sort((a, b) => (a.date + a.cls).localeCompare(b.date + b.cls));

async function handle(req) {
  if (req.action === 'list') {
    const { items } = await readFile();
    return { ok: true, items: sortItems(items) };
  }
  for (let i = 0; i < RETRY; i++) {
    const { items, sha } = await readFile();
    const next = apply(items, req);
    const sorted = sortItems(next.items);
    if (await writeFile(sorted, sha, next.message)) return { ok: true, items: sorted };
  }
  throw new Error('ほかの人の更新と重なりました。少し待って、もう一度お試しください');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply({ ok: false, error: 'POSTだけ受け付けます' });
  try {
    const req = JSON.parse(event.body || '{}');
    if (!pinOk(req.pin)) {
      await sleep(Number(process.env.PIN_FAIL_DELAY_MS || 1500)); // 総当たりを遅くする
      return reply({ ok: false, error: 'PINが違います' });
    }
    return reply(await handle(req));
  } catch (err) {
    return reply({ ok: false, error: String(err.message || err) });
  }
};
