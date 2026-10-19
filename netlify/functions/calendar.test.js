// 動作確認：  node netlify/functions/calendar.test.js
// GitHub の代わりに、メモリ上の偽物を使って、一覧・追加・編集・削除・PIN・同時更新を確かめる
const assert = require('assert');
process.env.ADMIN_PIN = '4321';
process.env.GITHUB_TOKEN = 'dummy';
process.env.GITHUB_REPO = 'owner/repo';
process.env.PIN_FAIL_DELAY_MS = '0';
const { handler } = require('./calendar.js');

// 偽のGitHub：data/calendar.json 1ファイルだけを持つ
let file = { sha: 's1', text: JSON.stringify({ items: [{ id: 'a', date: '2026-10-20', cls: 'GKスクール', detail: '19:45' }] }) };
let conflictOnce = false;
global.fetch = async (url, opts = {}) => {
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  if (!opts.method || opts.method === 'GET') {
    return json(200, { sha: file.sha, content: Buffer.from(file.text, 'utf8').toString('base64') });
  }
  const b = JSON.parse(opts.body);
  if (conflictOnce) { conflictOnce = false; file = { sha: 's' + Date.now(), text: file.text }; return json(409, {}); } // 同時に誰かが更新した
  if (b.sha !== file.sha) return json(409, {});
  file = { sha: 's' + Math.random(), text: Buffer.from(b.content, 'base64').toString('utf8') };
  return json(200, {});
};

const call = async (body) => JSON.parse((await handler({ httpMethod: 'POST', body: JSON.stringify({ pin: '4321', ...body }) })).body);

(async () => {
  let r = await call({ action: 'list' });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.items.length, 1);

  r = JSON.parse((await handler({ httpMethod: 'POST', body: JSON.stringify({ pin: '0000', action: 'list' }) })).body);
  assert.strictEqual(r.ok, false); assert.match(r.error, /PIN/);

  r = await call({ action: 'add', dates: ['2026-10-22', '2026-10-21'], cls: 'かけっこ教室', detail: ' 14:00 ' });
  assert.strictEqual(r.items.length, 3);
  assert.deepStrictEqual(r.items.map((x) => x.date), ['2026-10-20', '2026-10-21', '2026-10-22']); // 日付順
  assert.strictEqual(r.items[1].detail, '14:00'); // 前後の空白は、取り除く

  const id = r.items[1].id;
  r = await call({ action: 'update', id, date: '2026-10-25', cls: 'シニアサッカー', detail: 'x' });
  assert.strictEqual(r.items.find((x) => x.id === id).cls, 'シニアサッカー');

  conflictOnce = true; // 保存の瞬間に、ほかの人が更新していても、やり直して成功する
  r = await call({ action: 'delete', ids: [id, 'a'] });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.items.length, 1);

  r = await call({ action: 'add', date: '2026-02-31', cls: 'GKスクール' });
  assert.strictEqual(r.ok, false); // 存在しない日付は、断る
  r = await call({ action: 'delete', id: 'nothing' });
  assert.strictEqual(r.ok, false); // 存在しない予定は、断る

  console.log('すべて合格');
})().catch((e) => { console.error('失敗：', e); process.exit(1); });
