/* =========================================================================
   apply.html（教室・イベントの申込ページ）の処理
   選べる日程は、カレンダー（スプレッドシート）の「これから先の活動日・イベント」から
   自動で作る。送信内容はGoogleフォーム（data.js の formConfig.apply）に1日程＝1回答で届く。
   URLの ?class=教室名&date=YYYY-MM-DD で、教室の絞り込みと最初のチェックを指定できる。

   ・「教室」「学年」はGoogleフォーム側が選択式なので、選択肢と同じ文字列を送る必要がある
     （教室は予定のタイトルの「（」より前の部分。選択肢に無い教室は弾かれる）
   ・対象が「子ども」の教室を選んだときだけ、保護者氏名と学年の欄を出す
     （活動内容シートの「対象」列。無ければタイトルに「大人」「シニア」を含むかで判断）
   ・活動内容シートの「注意事項」列を、選んだ教室ごとに表示する
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

// 教室名（「（」より前）→ 活動内容の情報（対象・注意事項）
function activityInfo(coreName) {
  const list = Array.isArray(window.__syncedActivitiesData) ? window.__syncedActivitiesData : activitiesData;
  const a = list.find((x) => classCoreName(x.title) === coreName) || {};
  const audience = a.audience || (/大人|シニア/.test(coreName) ? '大人' : '子ども');
  return { audience, notes: a.notes || '' };
}

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

function pickedEvents(form, events) {
  return [...form.querySelectorAll('input[name="event"]:checked')].map((el) => events[Number(el.value)]);
}

// 選んだ教室に合わせて、子ども向けの欄と注意事項を出し分ける
function updateDynamicFields(form, events) {
  const cores = [...new Set(pickedEvents(form, events).map((ev) => classCoreName(ev.title)))];
  const infos = cores.map((c) => ({ core: c, ...activityInfo(c) }));
  const forKids = infos.some((i) => i.audience === '子ども');

  document.getElementById('kidFields').hidden = !forKids;
  form.elements.guardian.required = forKids;
  form.elements.grade.required = forKids;

  const notes = infos.filter((i) => i.notes);
  const box = document.getElementById('applyNotes');
  box.hidden = !notes.length;
  box.innerHTML = notes.map((i) => `<div class="apply-note"><strong>${escapeHtml(i.core)}の注意事項</strong><p>${escapeHtml(i.notes)}</p></div>`).join('');
}

async function initApplyPage() {
  if (typeof loadSheetsData === 'function') await loadSheetsData();
  initSiteChrome();
  const events = renderApplyPage();

  const form = document.getElementById('applyForm');
  form.elements.grade.innerHTML = '<option value="">選んでください</option>' +
    formConfig.apply.gradeOptions.map((g) => `<option>${escapeHtml(g)}</option>`).join('');
  form.addEventListener('change', () => updateDynamicFields(form, events));
  updateDynamicFields(form, events);

  initSiteForm(form, formConfig.apply, (showError) => {
    const f = form.elements;
    const picked = pickedEvents(form, events);
    if (!picked.length) {
      showError('参加したい日程を、1つ以上選んでください。', false);
      return null;
    }
    const forKids = !document.getElementById('kidFields').hidden;
    return picked.map((ev) => ({
      name: f.name.value.trim(),
      furigana: f.furigana.value.trim(),
      guardian: forKids ? f.guardian.value.trim() : '',
      email: f.email.value.trim(),
      grade: forKids ? f.grade.value : '',
      contact: f.contact.value.trim(),
      className: classCoreName(ev.title),
      date: ymdKey(ev),
      consent: '承諾する'
    }));
  });
}

initApplyPage();
