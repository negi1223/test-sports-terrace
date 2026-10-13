/* =========================================================================
   apply.html（教室・イベントの申込ページ）の処理
   選べる日程は、カレンダー（スプレッドシート）の「これから先の活動日・イベント」から
   自動で作る。送信内容はGoogleフォーム（data.js の formConfig.apply）に1日程＝1回答で届く。
   URLの ?class=教室名&date=YYYY-MM-DD で、教室の絞り込みと最初のチェックを指定できる。
   ========================================================================= */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function upcomingEvents() {
  const calendar = Array.isArray(window.__syncedCalendarData) ? window.__syncedCalendarData : calendarData;
  const now = new Date();
  const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return calendar
    .filter((ev) => ev.type !== 'tournament' && (parseDateValue(ev.date) || 0) >= today)
    .sort((a, b) => parseDateValue(a.date) - parseDateValue(b.date));
}

const ymdKey = (ev) => {
  const { y, mo, d } = extractYMD(ev.date);
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

function renderApplyPage() {
  const params = new URLSearchParams(location.search);
  const classParam = params.get('class') || '';
  const dateParam = params.get('date') || '';

  let events = upcomingEvents();
  const matched = classParam ? events.filter((ev) => classCoreName(ev.title) === classParam) : [];
  const filtered = matched.length > 0;
  if (filtered) events = matched;

  const list = document.getElementById('applyEvents');
  const hint = document.getElementById('applyHint');
  if (!events.length) {
    list.innerHTML = '<p class="empty-note">現在、申し込みできる日程が登録されていません。お手数ですが、<a href="index.html#contact">お問い合わせ</a>からご連絡ください。</p>';
    document.getElementById('applySubmit').disabled = true;
    return events;
  }
  list.innerHTML = events.map((ev, i) => {
    const { y, mo, d } = extractYMD(ev.date);
    const wd = WEEKDAYS[new Date(y, mo - 1, d).getDay()];
    const checked = dateParam && dateParam === ymdKey(ev) && (!classParam || classCoreName(ev.title) === classParam);
    return `
      <label class="check">
        <input type="checkbox" name="event" value="${i}"${checked ? ' checked' : ''}>
        <span><strong>${mo}/${d}（${wd}）</strong> ${escapeHtml(ev.title)}${ev.detail ? `<small>${escapeHtml(ev.detail)}</small>` : ''}</span>
      </label>`;
  }).join('');
  if (filtered) {
    hint.hidden = false;
    hint.innerHTML = `「${escapeHtml(classParam)}」の日程を表示しています。<a href="apply.html">すべての日程を見る</a>`;
  }
  return events;
}

async function initApplyPage() {
  if (typeof loadSheetsData === 'function') await loadSheetsData();
  initSiteChrome();
  const events = renderApplyPage();

  const form = document.getElementById('applyForm');
  initSiteForm(form, formConfig.apply, (showError) => {
    const f = form.elements;
    const picked = [...form.querySelectorAll('input[name="event"]:checked')].map((el) => events[Number(el.value)]);
    if (!picked.length) {
      showError('参加したい日程を、1つ以上選んでください。', false);
      return null;
    }
    return picked.map((ev) => ({
      name: f.name.value.trim(),
      grade: f.grade.value.trim(),
      contact: f.contact.value.trim(),
      className: ev.title,
      date: ymdKey(ev),
      note: f.note.value.trim()
    }));
  });
}

initApplyPage();
