/* =========================================================================
   schedule.html（活動日・イベント・大会カレンダー）の描画ロジック
   カレンダーは1枚だけ表示し、「前の月」「次の月」ボタンで切り替える方式。
   日付をクリックすると、その日の予定だけが下に表示される。
   予定は data.js の calendarData（またはGoogleスプレッドシート連携）から読み込む。
   ========================================================================= */

function currentCalendarData() {
  if (Array.isArray(window.__syncedCalendarData)) return window.__syncedCalendarData;
  return calendarData;
}

// 表示中の月（今月を0として、前後に何ヶ月ずらしているか）
let monthOffset = 0;
// クリックで選ばれている日付（"YYYY-MM-DD"）。null の間は「今日」があればそれを自動選択する
let selectedDateKey = null;

function todayKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 活動（教室）ごとの色。色の割り当ては「活動内容」の並び順で決まるので、月が変わっても同じ色になる。
// 活動内容に無い名前の予定は、その後ろの色を順に使う。教室名は「（」より前の部分で見分ける。
// c=ドット用のはっきりした色 / pale=ピルの背景 / ink=ピルの文字色
const CAL_PALETTE = [
  { c: '#1E8A54', pale: '#DDF1E4', ink: '#146238' },
  { c: '#2FA6D8', pale: '#DDF1FA', ink: '#17688C' },
  { c: '#F08A00', pale: '#FFF1DA', ink: '#9A5B00' },
  { c: '#D9455F', pale: '#FDE4E9', ink: '#A52440' },
  { c: '#7A5BC7', pale: '#EBE4FA', ink: '#50359A' },
  { c: '#A0713C', pale: '#F3E8DA', ink: '#704A1E' },
  { c: '#159A8C', pale: '#D9F2EF', ink: '#0B6A60' }
];

function calendarClassNames() {
  const acts = Array.isArray(window.__syncedActivitiesData) ? window.__syncedActivitiesData : activitiesData;
  const names = acts.map((a) => classCoreName(a.title));
  currentCalendarData().forEach((ev) => names.push(classCoreName(ev.title)));
  return [...new Set(names.filter(Boolean))];
}

function calendarColorStyle(title, names) {
  const p = CAL_PALETTE[Math.max(names.indexOf(classCoreName(title)), 0) % CAL_PALETTE.length];
  return `--c:${p.c};--c-pale:${p.pale};--c-ink:${p.ink}`;
}

function renderCalendar() {
  const classNames = calendarClassNames();
  const base = new Date();
  const viewDate = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-11

  document.getElementById('calMonthLabel').textContent = `${year}年 ${month + 1}月`;

  // その月の予定を日付ごとにまとめる（key: "YYYY-MM-DD"）
  const eventsByDay = {};
  currentCalendarData().forEach((ev) => {
    const ymd = extractYMD(ev.date);
    if (!ymd) return;
    if (ymd.y !== year || ymd.mo !== month + 1) return;
    const key = `${ymd.y}-${String(ymd.mo).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`;
    (eventsByDay[key] = eventsByDay[key] || []).push(ev);
  });

  // カレンダーグリッド（前後の月の空白セル込みで6週間分＝42マス固定）
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 月曜始まり(0=月)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = todayKeyOf(new Date());

  // 選択中の日付：明示的にクリックされていなければ、表示中の月に「今日」があればそれを自動選択
  const effectiveKey = selectedDateKey || (todayKey.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) ? todayKey : null);

  let cells = '';
  for (let i = 0; i < firstWeekday; i++) cells += '<div class="cal-cell cal-cell--empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = eventsByDay[key] || [];
    const isToday = key === todayKey;
    const isSelected = key === effectiveKey;
    const tags = dayEvents.map((ev) => `
      <span class="cal-tag" style="${calendarColorStyle(ev.title, classNames)}" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</span>
    `).join('');
    cells += `
      <button type="button" class="cal-cell${isToday ? ' cal-cell--today' : ''}${isSelected ? ' cal-cell--selected' : ''}" data-date="${key}">
        <span class="cal-date">${d}</span>
        <div class="cal-tags">${tags}</div>
      </button>
    `;
  }
  const totalCells = firstWeekday + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += '<div class="cal-cell cal-cell--empty"></div>';

  document.getElementById('calGrid').innerHTML = cells;

  // 凡例：表示中の月に出てくる活動だけ、色の見本を並べる
  const legendNames = classNames.filter((n) => Object.values(eventsByDay).some((evs) => evs.some((ev) => classCoreName(ev.title) === n)));
  document.getElementById('calLegend').innerHTML = legendNames
    .map((n) => `<span class="cal-legend-item" style="${calendarColorStyle(n, classNames)}"><i></i>${escapeHtml(n)}</span>`).join('');

  // 下は「選択中の1日分」の予定だけを表示する
  const listEl = document.getElementById('calEventList');
  if (!effectiveKey) {
    listEl.innerHTML = '<p class="empty-note">日付をクリックすると、その日の予定が表示されます。</p>';
  } else {
    const dayEvents = eventsByDay[effectiveKey] || [];
    const d = Number(effectiveKey.split('-')[2]);
    if (!dayEvents.length) {
      listEl.innerHTML = `<p class="cal-list-date">${month + 1}月${d}日</p><p class="empty-note">この日の予定はまだ登録されていません。</p>`;
    } else {
      const items = dayEvents.map((ev) => `
        <li class="cal-list-item" style="${calendarColorStyle(ev.title, classNames)}">
          <span class="cal-list-title">${escapeHtml(ev.title)}</span>
          ${ev.detail ? `<span class="cal-list-detail">${escapeHtml(ev.detail)}</span>` : ''}
          ${ev.type !== 'tournament' && effectiveKey >= todayKey ? `<a class="cal-apply" href="${escapeHtml(applyUrl(ev.title, effectiveKey))}">申し込む →</a>` : ''}
        </li>
      `).join('');
      listEl.innerHTML = `<div class="cal-list-day"><p class="cal-list-date">${month + 1}月${d}日</p><ul>${items}</ul></div>`;
    }
  }

  document.getElementById('calSyncWarning').hidden = !window.__calendarSyncFailed;
}

function initCalendarControls() {
  document.getElementById('calPrev').addEventListener('click', () => { monthOffset -= 1; selectedDateKey = null; renderCalendar(); });
  document.getElementById('calNext').addEventListener('click', () => { monthOffset += 1; selectedDateKey = null; renderCalendar(); });
  document.getElementById('calToday').addEventListener('click', () => { monthOffset = 0; selectedDateKey = null; renderCalendar(); });

  // 日付セルのクリックはグリッドごと作り直されるので、親要素に1つだけリスナーを付ける（イベント委任）
  document.getElementById('calGrid').addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-cell[data-date]');
    if (!cell) return;
    selectedDateKey = cell.dataset.date;
    renderCalendar();
  });
}

async function initSchedulePage() {
  if (typeof loadSheetsData === 'function') {
    await loadSheetsData();
  }
  initSiteChrome();
  initCalendarControls();
  renderCalendar();
}

initSchedulePage();
