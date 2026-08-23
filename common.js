/* =========================================================================
   全ページ共通の小さな関数集
   （script.js / news-archive.js で同じ処理が必要になる部分をここにまとめています）
   ========================================================================= */

// HTMLに埋め込む前に、危険な文字（<script>タグなど）を無害な表記に変換する
const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

// "2026.06.01" "2026/6/1" "2026-06-01" のどの区切り文字でも読み取れるようにする
const extractYMD = (str) => {
  const s = String(str || '').trim();
  const m = s.match(/(\d{4})[.\/\-](\d{1,2})[.\/\-](\d{1,2})/);
  return m ? { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) } : null;
};
const parseDateValue = (str) => {
  const ymd = extractYMD(str);
  return ymd ? ymd.y * 10000 + ymd.mo * 100 + ymd.d : null;
};

// ニュース1件ごとの「日付＋タイトル」から、ページをまたいでも同じ値になる識別子を作る
const newsItemSlug = (item) => {
  const raw = `${item.date}__${item.title}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  return 'n' + Math.abs(hash).toString(36);
};

// 「補足」欄にURLだけが入力されていたら、テキストのまま出さずにクリックできる
// リンクに変換する。Googleマップのリンクだと分かる場合は「Googleマップで見る →」、
// それ以外のURLは「詳しく見る →」というボタン文字にする（別タブで開く）
const renderNoteContent = (note) => {
  const trimmed = String(note || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    const isMapUrl = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(trimmed);
    const label = isMapUrl ? 'Googleマップで見る →' : '詳しく見る →';
    return `<a href="${escapeHtml(trimmed)}" target="_blank" rel="noopener">${label}</a>`;
  }
  return escapeHtml(trimmed);
};

// ニュース1件の画像を配列で取り出す。スプレッドシート連携なら images（複数対応）、
// data.js の手書きデータなら image（1枚だけ）しか無いこともあるので、どちらでも動くようにする
const newsImages = (n) => (n.images && n.images.length ? n.images : (n.image ? [n.image] : []));

// 予定の種別（活動日／イベント／大会）ごとの表示ラベルと色クラス
const CALENDAR_TYPE_LABEL = { activity: "活動日", event: "イベント", tournament: "大会" };
const calendarTypeClass = (type) => `cal-tag cal-tag--${type || 'activity'}`;

// 全ページ共通のヘッダー・フッター（ロゴ表記・年号・モバイルメニュー開閉）を初期化する。
// 各HTMLの <head> より後、</body> の直前で data.js → common.js の順に読み込んだ後に呼び出す
function initSiteChrome() {
  document.querySelectorAll('.js-org-name-jp').forEach((el) => { el.textContent = siteData.orgNameJp; });
  document.querySelectorAll('.js-org-name-short').forEach((el) => { el.textContent = siteData.orgNameShort; });
  document.querySelectorAll('.js-org-name-en').forEach((el) => { el.textContent = siteData.orgNameEn; });
  document.querySelectorAll('.js-logo-initial').forEach((el) => { el.textContent = siteData.logoInitial; });

  const footerCopy = document.getElementById('footerCopy');
  if (footerCopy) {
    const startYear = Number(siteData.copyrightYear);
    const nowYear = new Date().getFullYear();
    const yearLabel = nowYear > startYear ? `${startYear} - ${nowYear}` : `${startYear}`;
    footerCopy.textContent = `© ${yearLabel} ${siteData.copyrightEn}`;
  }

  const navToggle = document.getElementById('navToggle');
  const primaryNav = document.getElementById('primaryNav');
  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = primaryNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }
}
