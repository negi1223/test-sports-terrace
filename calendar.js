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

function renderCalendar() {
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
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=日
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
      <span class="${calendarTypeClass(ev.type)}" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</span>
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
        <li>
          <span class="${calendarTypeClass(ev.type)}">${escapeHtml(CALENDAR_TYPE_LABEL[ev.type] || '活動日')}</span>
          <span class="cal-list-title">${escapeHtml(ev.title)}</span>
          ${ev.detail ? `<span class="cal-list-detail">${escapeHtml(ev.detail)}</span>` : ''}
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
