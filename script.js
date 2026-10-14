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
  if (s.heroPhoto) heroData.photo = s.heroPhoto;

  if (s.aboutSlogan) aboutData.slogan = s.aboutSlogan;
  if (s.aboutText) aboutData.text = s.aboutText;
  if (s.aboutPhoto) aboutData.photo = s.aboutPhoto;
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

  if (s.messageText) {
    messageData.paragraphs = s.messageText.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
    messageData.lead = '';
    if (s.messageSign) messageData.sign = s.messageSign;
  }

  if (s.instagramUrl) { siteData.instagramUrl = s.instagramUrl; renderInstagramLinks(); }
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
    // 読み込みが終わるまでは下地の色だけを見せておき、読み込めたらふわっとフェードインさせる
    // （壊れた画像アイコンや真っ白な一瞬が見えないようにするための簡易ロード演出）
    photoEl.addEventListener('load', () => photoEl.classList.add('is-loaded'), { once: true });
    photoEl.src = firstPhoto;
    photoEl.alt = heroData.photoAlt || '';
    if (photoEl.complete) photoEl.classList.add('is-loaded'); // キャッシュ済みで load イベントが発火しない場合の保険
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

  // ヒーローのボタンは、トップページの「活動の申し込み」へ
  document.getElementById('heroCta').href = '#apply';
}

// トップページの「活動の申し込み」：これからの活動日を、日付順に最大6件並べる
function renderApplySection() {
  const list = document.getElementById('applyList');
  const events = (Array.isArray(window.__syncedCalendarData) ? window.__syncedCalendarData : calendarData)
    .filter((ev) => ev.type !== 'tournament' && extractYMD(ev.date))
    .map((ev) => ({ ev, v: parseDateValue(ev.date) }));
  const now = new Date();
  const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const upcoming = events.filter((x) => x.v >= today).sort((a, b) => a.v - b.v).slice(0, 6);
  const wd = ['日', '月', '火', '水', '木', '金', '土'];
  list.innerHTML = upcoming.map(({ ev }) => {
    const { y, mo, d } = extractYMD(ev.date);
    const key = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return `
      <li>
        <span class="apply-date">${mo}/${d}（${wd[new Date(y, mo - 1, d).getDay()]}）</span>
        <span class="apply-title">${escapeHtml(ev.title)}${ev.detail ? `<small>${escapeHtml(ev.detail)}</small>` : ''}</span>
        <a class="btn btn-cta apply-btn" href="${escapeHtml(applyUrl(ev.title, key))}">申し込む</a>
      </li>`;
  }).join('') || '<li class="empty-note">現在、申し込みできる日程が登録されていません。下のボタンから、コースの申し込みもできます。</li>';
}

function renderAbout() {
  document.getElementById('aboutSlogan').textContent = aboutData.slogan;
  document.getElementById('aboutText').textContent = aboutData.text;
  document.getElementById('aboutPhoto').src = aboutData.photo || '';
  const factsEl = document.getElementById('aboutFacts');
  factsEl.innerHTML = aboutData.facts.map((f) => `
    <div class="fact">
      <dt>${escapeHtml(f.label)}</dt>
      <dd>${escapeHtml(f.value)}${f.note ? `<span class="fact-note">${renderNoteContent(f.note)}</span>` : ''}</dd>
    </div>
  `).join('');
}

function renderMessage() {
  const wrap = document.getElementById('messageBody');
  wrap.innerHTML = `
    ${messageData.lead ? `<p class="message-lead">${escapeHtml(messageData.lead)}</p>` : ''}
    ${messageData.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
    ${messageData.sign ? `<p class="message-sign">${escapeHtml(messageData.sign)}</p>` : ''}
  `;
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
        ${a.price ? `<p class="activity-price">${escapeHtml(a.price)}</p>` : ''}
        <p>${escapeHtml(a.text)}</p>
        ${/^https?:\/\//i.test(a.link || '')
          ? `<a class="btn btn-cta activity-btn" href="${escapeHtml(a.link)}" target="_blank" rel="noopener">参加はこちらから</a>`
          : `<a class="btn btn-cta activity-btn" href="${escapeHtml(applyUrl(a.title))}">参加はこちらから</a>`}
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
    <a class="news-card taped" href="news.html#${newsItemSlug(n)}">
      ${n.image ? `<img class="news-card-img" src="${escapeHtml(n.image)}" alt="" loading="lazy">` : ''}
      <div class="news-card-head">
        <span class="news-tag news-tag--${escapeHtml(n.tag || 'info')}">${escapeHtml(TAG_LABEL[n.tag] || 'お知らせ')}${n.pinned ? ' ・ 固定' : ''}</span>
        <time>${escapeHtml(n.date)}</time>
      </div>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.text)}</p>
    </a>
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
  wrap.innerHTML = list.map((f) => `
    <details class="accordion-item">
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

  const form = document.getElementById('contactForm');
  initSiteForm(form, formConfig.contact, () => {
    const f = form.elements;
    return [{ name: f.name.value.trim(), email: f.email.value.trim(), message: f.message.value.trim() }];
  });
}

async function init() {
  initSiteChrome();

  // ヒーロー画像は「その他」シートの内容だけ読み込めれば表示できる。ニュース・カレンダー等の
  // 他の同期（合計5件）を待つ必要は無いので、「その他」だけ先に読み込んでヒーローを表示する
  if (typeof loadSettingsOnly === 'function') {
    await loadSettingsOnly();
  }
  applySettings();
  renderHero();

  if (typeof loadSheetsData === 'function') {
    await loadSheetsData(); // 残りのセクション（ニュース・カレンダー等）はここでまとめて読み込む
  }
  renderAbout();
  renderMessage();
  renderActivities();
  renderNews();
  renderApplySection();
  renderStaff();
  renderFaq();
  renderContact();
}

init();
