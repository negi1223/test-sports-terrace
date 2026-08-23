/* =========================================================================
   トップページ（index.html）の描画ロジック
   data.js の内容（またはGoogleスプレッドシート連携の内容）をHTMLに反映します。
   ========================================================================= */

function currentNewsData() {
  if (Array.isArray(window.__syncedNewsData)) return window.__syncedNewsData;
  return newsData;
}
function currentStaffData() {
  if (Array.isArray(window.__syncedStaffData)) return window.__syncedStaffData;
  return staffData;
}
function currentFaqData() {
  if (Array.isArray(window.__syncedFaqData)) return window.__syncedFaqData;
  return faqData;
}
function currentActivitiesData() {
  if (Array.isArray(window.__syncedActivitiesData)) return window.__syncedActivitiesData;
  return activitiesData;
}

// 「その他」シート（sheetsSyncConfig.settingsCsvUrl）の内容を、heroData/aboutData/siteData に
// 上書きする。読み込めなかった・未設定の場合は何もせず data.js の内容のまま
function applySettings() {
  const s = window.__syncedSettings;
  if (!s) return;

  if (s.heroTitle) {
    const accent = s.heroTitleAccent || '';
    const idx = accent ? s.heroTitle.indexOf(accent) : -1;
    if (idx >= 0) {
      heroData.headline = s.heroTitle.slice(0, idx);
      heroData.headlineAccent = accent;
      heroData.headlineSuffix = s.heroTitle.slice(idx + accent.length);
    } else {
      heroData.headline = s.heroTitle;
      heroData.headlineAccent = '';
      heroData.headlineSuffix = '';
    }
  }
  if (s.heroSub) heroData.sub = s.heroSub;

  if (s.aboutSlogan) aboutData.slogan = s.aboutSlogan;
  if (s.aboutText) aboutData.text = s.aboutText;
  Object.keys(s.aboutFacts || {}).forEach((label) => {
    const { value, note } = s.aboutFacts[label];
    const existing = aboutData.facts.find((f) => f.label === label);
    if (existing) {
      existing.value = value;
      if (note) existing.note = note;
    } else {
      aboutData.facts.push({ label, value, note: note || '' });
    }
  });

  if (s.instagramUrl) siteData.instagramUrl = s.instagramUrl;
  if (s.contactFormUrl) siteData.contactFormUrl = s.contactFormUrl;
  if (s.contactEmail) siteData.contactEmail = s.contactEmail;

  document.getElementById('settingsSyncWarning').hidden = !window.__settingsSyncFailed;
}

function renderHero() {
  document.getElementById('heroEyebrow').textContent = heroData.eyebrow;
  document.getElementById('heroHeadline').innerHTML =
    `${escapeHtml(heroData.headline)}<span class="accent">${escapeHtml(heroData.headlineAccent)}</span>${escapeHtml(heroData.headlineSuffix)}`;
  document.getElementById('heroSub').textContent = heroData.sub;

  const photoEl = document.getElementById('heroPhoto');
  const firstPhoto = Array.isArray(heroData.photo) ? heroData.photo[0] : heroData.photo;
  if (firstPhoto) {
    photoEl.src = firstPhoto;
    photoEl.alt = heroData.photoAlt || '';
  } else {
    photoEl.hidden = true;
  }

  const statsEl = document.getElementById('heroStats');
  statsEl.innerHTML = heroData.stats.map((s) => `
    <div class="hero-stat">
      <dt>${escapeHtml(s.label)}</dt>
      <dd>${escapeHtml(s.value)}<span class="stat-suffix">${escapeHtml(s.suffix || '')}</span></dd>
    </div>
  `).join('');

  const contactCta = document.getElementById('heroCta');
  if (siteData.contactFormUrl) {
    contactCta.href = siteData.contactFormUrl;
  } else {
    contactCta.href = '#contact';
  }
}

function renderAbout() {
  document.getElementById('aboutSlogan').textContent = aboutData.slogan;
  document.getElementById('aboutText').textContent = aboutData.text;
  const factsEl = document.getElementById('aboutFacts');
  factsEl.innerHTML = aboutData.facts.map((f) => `
    <div class="fact">
      <dt>${escapeHtml(f.label)}</dt>
      <dd>${escapeHtml(f.value)}${f.note ? `<span class="fact-note">${escapeHtml(f.note)}</span>` : ''}</dd>
    </div>
  `).join('');
}

function renderActivities() {
  const wrap = document.getElementById('activitiesGrid');
  const list = currentActivitiesData();
  wrap.innerHTML = list.map((a) => {
    const photos = (a.images && a.images.length ? a.images : []).slice(0, 3);
    return `
    <div class="activity-row">
      <div class="activity-photos">
        ${photos.map((src) => `
          <div class="activity-photo-frame"><img src="${escapeHtml(src)}" alt="" loading="lazy"></div>
        `).join('') || '<p class="empty-note">写真は準備中です。</p>'}
      </div>
      <div class="activity-copy">
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.text)}</p>
      </div>
    </div>
  `;
  }).join('') || '<p class="empty-note">活動内容は準備中です。</p>';

  document.getElementById('activitiesSyncWarning').hidden = !window.__activitiesSyncFailed;
}

function renderNews() {
  const grid = document.getElementById('newsGrid');
  const items = [...currentNewsData()].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (parseDateValue(b.date) || 0) - (parseDateValue(a.date) || 0);
  });
  const shown = items.slice(0, sheetsSyncConfig.newsMaxItems || 6);

  const TAG_LABEL = { info: 'お知らせ', event: 'イベント', recruit: '募集' };
  grid.innerHTML = shown.map((n) => `
    <article class="news-card taped">
      ${n.image ? `<img class="news-card-img" src="${escapeHtml(n.image)}" alt="" loading="lazy">` : ''}
      <div class="news-card-head">
        <span class="news-tag news-tag--${escapeHtml(n.tag || 'info')}">${escapeHtml(TAG_LABEL[n.tag] || 'お知らせ')}${n.pinned ? ' ・ 固定' : ''}</span>
        <time>${escapeHtml(n.date)}</time>
      </div>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.text)}</p>
    </article>
  `).join('') || '<p class="empty-note">お知らせは準備中です。</p>';

  document.getElementById('newsSyncWarning').hidden = !window.__newsSyncFailed;
}

function renderStaff() {
  const wrap = document.getElementById('staffGrid');
  const list = currentStaffData();
  wrap.innerHTML = list.map((s) => `
    <div class="staff-card taped">
      ${s.photo
        ? `<img class="staff-photo" src="${escapeHtml(s.photo)}" alt="${escapeHtml(s.name)}" loading="lazy">`
        : `<div class="staff-photo staff-photo--placeholder">${escapeHtml((s.name || '').charAt(0))}</div>`}
      <p class="staff-role">${escapeHtml(s.role)}</p>
      <p class="staff-name">${escapeHtml(s.name)}</p>
      <p class="staff-comment">${escapeHtml(s.comment)}</p>
    </div>
  `).join('') || '<p class="empty-note">スタッフ情報は準備中です。</p>';

  document.getElementById('staffSyncWarning').hidden = !window.__staffSyncFailed;
}

function renderFaq() {
  const wrap = document.getElementById('faqAccordion');
  const list = currentFaqData();
  wrap.innerHTML = list.map((f, i) => `
    <details class="accordion-item" ${i === 0 ? 'open' : ''}>
      <summary>${escapeHtml(f.q)}</summary>
      <div class="accordion-body">${escapeHtml(f.a)}</div>
    </details>
  `).join('');

  document.getElementById('faqSyncWarning').hidden = !window.__faqSyncFailed;
}

function renderContact() {
  const emailLinks = document.querySelectorAll('.js-contact-email');
  emailLinks.forEach((el) => {
    el.textContent = siteData.contactEmail;
    el.href = `mailto:${siteData.contactEmail}`;
  });

  const gformButton = document.getElementById('gformButton');
  if (siteData.contactFormUrl) {
    gformButton.href = siteData.contactFormUrl;
  } else {
    gformButton.hidden = true;
    document.getElementById('gformPendingNote').hidden = false;
  }
}

async function init() {
  if (typeof loadSheetsData === 'function') {
    await loadSheetsData();
  }
  initSiteChrome();
  applySettings();
  renderHero();
  renderAbout();
  renderActivities();
  renderNews();
  renderStaff();
  renderFaq();
  renderContact();
}

init();
