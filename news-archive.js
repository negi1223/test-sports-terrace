/* =========================================================================
   news.html（お知らせ一覧）の描画ロジック
   ========================================================================= */

function currentNewsData() {
  if (Array.isArray(window.__syncedNewsData)) return window.__syncedNewsData;
  return newsData;
}

const NEWS_TAG_LABEL = { info: 'お知らせ', event: 'イベント', recruit: '募集' };

function renderNewsArchive() {
  const items = [...currentNewsData()].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (parseDateValue(b.date) || 0) - (parseDateValue(a.date) || 0);
  });

  const list = document.getElementById('newsArchiveList');
  list.innerHTML = items.map((n) => `
    <details class="accordion-item" id="${newsItemSlug(n)}">
      <summary>
        <span class="news-tag news-tag--${escapeHtml(n.tag || 'info')}">${escapeHtml(NEWS_TAG_LABEL[n.tag] || 'お知らせ')}${n.pinned ? ' ・ 固定' : ''}</span>
        <time>${escapeHtml(n.date)}</time>
        <span class="news-archive-title">${escapeHtml(n.title)}</span>
      </summary>
      <div class="accordion-body">
        ${escapeHtml(n.text)}
        ${n.image ? `<img class="news-archive-img" src="${escapeHtml(n.image)}" alt="" loading="lazy">` : ''}
      </div>
    </details>
  `).join('') || '<p class="empty-note">お知らせは準備中です。</p>';

  document.getElementById('newsSyncWarning').hidden = !window.__newsSyncFailed;

  // #n1a2b3 のようなURLで直接開いた場合、該当のアコーディオンを自動で開く
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target && target.tagName === 'DETAILS') {
      target.open = true;
      target.scrollIntoView({ block: 'center' });
    }
  }
}

async function initNewsPage() {
  if (typeof loadSheetsData === 'function') {
    await loadSheetsData();
  }
  initSiteChrome();
  renderNewsArchive();
}

initNewsPage();
