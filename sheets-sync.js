/* =========================================================================
   Googleスプレッドシート連携（ニュース・予定・スタッフ・Q&A）
   =========================================================================
   ここは「data.js を直接書き換えなくても、Googleスプレッドシートに入力するだけで
   サイトの内容が更新できる」ための仕組みです。

   ★このファイルは基本的に編集不要です。
   　設定するのは data.js の sheetsSyncConfig（URLを貼るだけ）です。

   ★列名は「完全一致」ではなく「キーワードを含むか」で自動的に探します。
   　質問文の中に「日付」というキーワードが含まれていれば自動的にその列だと
   　判断するので、質問文を多少書き換えても壊れません。

   ★安全設計：
   　- URLが未設定／通信に失敗した場合は、自動的に data.js の内容（今まで通りの
   　  手書きデータ）が使われます。サイトが真っ白になることはありません。
   　- 通信は最大4秒でタイムアウトします（失敗時は0.4秒待って1回だけ再試行）。
   ========================================================================= */

(function () {
  const FETCH_TIMEOUT_MS = 4000;
  const SAFETY_MAX_ROWS = 200;

  const NEWS_KEYWORDS = [
    ["date", "日付"],
    ["tag", "種類"],
    ["title", "タイトル"],
    ["text", ["簡単な説明", "本文", "内容"]],
    ["pinned", "固定"],
    ["image", ["画像", "写真"]]
  ];
  const NEWS_TAG_MAP = { "イベント": "event", "お知らせ": "info", "募集": "recruit" };

  const CALENDAR_KEYWORDS = [
    ["date", "日付"],
    ["type", "種別"],
    ["title", "タイトル"],
    ["detail", ["詳細", "詳しい"]]
  ];
  const CALENDAR_TYPE_MAP = { "活動日": "activity", "イベント": "event", "大会": "tournament" };

  const STAFF_KEYWORDS = [
    ["photo", "写真"],
    ["comment", "コメント"],
    ["role", "役職"],
    ["name", "名前"]
  ];

  const FAQ_KEYWORDS = [
    ["q", "質問"],
    ["a", "回答"]
  ];

  const ACTIVITIES_KEYWORDS = [
    ["images", ["画像", "写真"]],
    ["title", "タイトル"],
    ["text", "説明"]
  ];

  // 「その他」シート：1列目＝項目名／2列目＝内容／3列目＝補足 の行を読み取る。
  // 決まったキーワード・かぎカッコの形で、トップ・About・連絡先まわりの文言をまとめて上書きできる
  const SETTINGS_ROW_KEYWORDS = [
    ["item", "項目"],
    ["value", "内容"],
    ["note", "補足"]
  ];

  // ---- タイムアウト付きfetch ----
  async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error("HTTPエラー: " + res.status);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function fetchWithRetry(url) {
    try {
      return await fetchWithTimeout(url);
    } catch (err) {
      await wait(400);
      return await fetchWithTimeout(url);
    }
  }

  // ---- CSVパーサー（ダブルクォート・カンマ入りの値に対応した最小実装） ----
  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\r") {
        // 無視
      } else if (c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // skipExampleRow=true なら「1行目＝記入例（読み飛ばす）／2行目＝見出し」（スタッフ・Q&A用）
  // false なら「1行目＝見出し」（ニュース・予定用）
  function csvToTable(csvText, skipExampleRow) {
    const rows = parseCsv(csvText).filter((r) => r.some((v) => v !== ""));
    const headerRowIndex = skipExampleRow ? 1 : 0;
    if (rows.length <= headerRowIndex) return { headers: [], objects: [] };
    const headers = rows[headerRowIndex].map((h) => h.trim());
    const objects = rows.slice(headerRowIndex + 1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
      return obj;
    });
    return { headers, objects };
  }

  const includesLoose = (haystack, needle) => haystack.toLowerCase().includes(needle.toLowerCase());

  function resolveColumns(headers, keywordEntries) {
    const remaining = headers.slice();
    const resolved = {};
    keywordEntries.forEach(([key, keywordOrList]) => {
      const keywords = Array.isArray(keywordOrList) ? keywordOrList : [keywordOrList];
      let idx = -1;
      for (const kw of keywords) {
        idx = remaining.findIndex((h) => includesLoose(h, kw));
        if (idx !== -1) break;
      }
      if (idx !== -1) {
        resolved[key] = remaining[idx];
        remaining.splice(idx, 1);
      } else {
        resolved[key] = null;
      }
    });
    return resolved;
  }

  const getVal = (obj, cols, key) => (cols[key] ? (obj[cols[key]] || "") : "");

  // Googleフォームの「ファイルアップロード」質問は、回答スプレッドシートにGoogleドライブの
  // 共有リンク（例："https://drive.google.com/open?id=XXXX" や ".../file/d/XXXX/view?usp=drivesdk"）
  // がそのまま入力される。これを、元画像そのものではなく「軽量なサムネイル」を返すURL形式に
  // 変換する（sz=w800 は幅800pxのサムネイルという意味。元画像が大きくてもここで軽くなる）。
  // ※Googleドライブの正式なCDN機能ではないため、将来的にこの形式が使えなくなる可能性は
  //   ゼロではないが、装飾目的のニュース画像用途としては許容している。
  const resolveDriveImage = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return "";
    if (!v.includes("drive.google.com")) return v; // Driveのリンクでなければそのまま使う（images/の直接指定など）
    const idMatch = v.match(/[?&]id=([^&]+)/) || v.match(/\/d\/([^/]+)/);
    const fileId = idMatch ? idMatch[1] : "";
    if (!fileId) return "";
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  };

  // 1つのセルに複数の画像（Googleフォームのファイルアップロードなら複数のDriveリンクが
  // 改行・カンマ区切りで、スプレッドシート直接編集ならAlt+Enterで複数行のファイル名が）
  // 入っている場合に、それぞれをサイトで使えるURLの配列に変換する
  const resolveImageList = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return [];
    return v.split(/\r?\n|,(?=\s*(?:https?:\/\/|images\/))/)
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => (line.includes("drive.google.com") ? resolveDriveImage(line) : resolveImagePath(line)))
      .filter((url) => url);
  };

  const resolveImagePath = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return "";
    return v.startsWith("images/") ? v : `images/${v}`;
  };

  function buildNewsData(headers, objects) {
    const cols = resolveColumns(headers, NEWS_KEYWORDS);
    return objects
      .map((o) => {
        const pinnedRaw = getVal(o, cols, "pinned");
        const pinned = pinnedRaw.includes("しない") ? false : pinnedRaw.includes("する");
        // images：投稿された画像すべて（news.html の一覧で全部表示する用）
        // image：先頭の1枚だけ（トップページのカードに使う用）
        const images = resolveImageList(getVal(o, cols, "image"));
        return {
          tag: NEWS_TAG_MAP[getVal(o, cols, "tag")] || "info",
          date: getVal(o, cols, "date"),
          title: getVal(o, cols, "title"),
          text: getVal(o, cols, "text"),
          pinned,
          image: images[0] || "",
          images
        };
      })
      .filter((n) => n.title)
      .slice(-SAFETY_MAX_ROWS);
  }

  function buildCalendarData(headers, objects) {
    const cols = resolveColumns(headers, CALENDAR_KEYWORDS);
    return objects
      .map((o) => ({
        date: getVal(o, cols, "date"),
        type: CALENDAR_TYPE_MAP[getVal(o, cols, "type")] || "activity",
        title: getVal(o, cols, "title"),
        detail: getVal(o, cols, "detail")
      }))
      .filter((c) => c.date && c.title)
      .slice(0, SAFETY_MAX_ROWS);
  }

  function buildStaffData(headers, objects) {
    const cols = resolveColumns(headers, STAFF_KEYWORDS);
    return objects
      .map((o) => ({
        role: getVal(o, cols, "role"),
        name: getVal(o, cols, "name"),
        comment: getVal(o, cols, "comment"),
        photo: resolveImagePath(getVal(o, cols, "photo"))
      }))
      .filter((s) => s.name)
      .slice(0, SAFETY_MAX_ROWS);
  }

  function buildFaqData(headers, objects) {
    const cols = resolveColumns(headers, FAQ_KEYWORDS);
    return objects
      .map((o) => ({ q: getVal(o, cols, "q"), a: getVal(o, cols, "a") }))
      .filter((f) => f.q)
      .slice(0, SAFETY_MAX_ROWS);
  }

  // 「その他」シート専用：判定の優先順位は上から順にチェックし、最初に当てはまったものを使う
  //   1. 「Aboutの「◯◯」」の形（かぎカッコ入り）→ ◯◯という名前のAbout項目カード。
  //      ただし「紹介文」だけは特別に、Aboutの紹介文（段落）として扱う
  //   2. それ以外は決まったキーワードで判定（スローガン／トップのタイトル・紹介文／Instagram／
  //      フォームURL／連絡先メール）
  function buildSettingsData(headers, objects) {
    const cols = resolveColumns(headers, SETTINGS_ROW_KEYWORDS);
    const result = { aboutFacts: {} };
    objects.forEach((o) => {
      const label = getVal(o, cols, "item");
      const value = getVal(o, cols, "value");
      const note = getVal(o, cols, "note");
      if (!label || !value) return;
      const bracketMatch = label.match(/「(.+?)」/);

      if (includesLoose(label, "About") && bracketMatch) {
        const innerLabel = bracketMatch[1];
        if (innerLabel.includes("紹介文")) result.aboutText = value;
        else result.aboutFacts[innerLabel] = { value, note };
        return;
      }
      if (includesLoose(label, "スローガン")) { result.aboutSlogan = value; return; }
      if (label.includes("トップ") && label.includes("タイトル")) { result.heroTitle = value; result.heroTitleAccent = note; return; }
      if (label.includes("トップ") && (label.includes("紹介文") || label.includes("サブ"))) { result.heroSub = value; return; }
      if (includesLoose(label, "Instagram")) { result.instagramUrl = value; return; }
      if (label.includes("フォーム")) { result.contactFormUrl = value; return; }
      if (label.includes("メール")) { result.contactEmail = value; return; }
    });
    return result;
  }

  function buildActivitiesData(headers, objects) {
    const cols = resolveColumns(headers, ACTIVITIES_KEYWORDS);
    return objects
      .map((o) => ({
        title: getVal(o, cols, "title"),
        text: getVal(o, cols, "text"),
        images: resolveImageList(getVal(o, cols, "images"))
      }))
      .filter((a) => a.title)
      .slice(0, SAFETY_MAX_ROWS);
  }

  // ---- メイン処理：data.js の sheetsSyncConfig を見て、あれば読み込む ----
  window.loadSheetsData = async function loadSheetsData() {
    if (typeof sheetsSyncConfig === "undefined") return;

    const tasks = [];

    if (sheetsSyncConfig.newsCsvUrl) {
      tasks.push(
        fetchWithRetry(sheetsSyncConfig.newsCsvUrl)
          .then((text) => {
            const { headers, objects } = csvToTable(text);
            window.__syncedNewsData = buildNewsData(headers, objects);
            window.__newsSyncFailed = false;
          })
          .catch((err) => {
            window.__newsSyncFailed = true;
            console.warn("[news連携] 読み込みに失敗したため、data.js の内容を表示します:", err);
          })
      );
    }

    if (sheetsSyncConfig.calendarCsvUrl) {
      tasks.push(
        fetchWithRetry(sheetsSyncConfig.calendarCsvUrl)
          .then((text) => {
            const { headers, objects } = csvToTable(text);
            window.__syncedCalendarData = buildCalendarData(headers, objects);
            window.__calendarSyncFailed = false;
          })
          .catch((err) => {
            window.__calendarSyncFailed = true;
            console.warn("[予定連携] 読み込みに失敗したため、data.js の内容を表示します:", err);
          })
      );
    }

    if (sheetsSyncConfig.staffCsvUrl) {
      tasks.push(
        fetchWithRetry(sheetsSyncConfig.staffCsvUrl)
          .then((text) => {
            const { headers, objects } = csvToTable(text, true);
            window.__syncedStaffData = buildStaffData(headers, objects);
            window.__staffSyncFailed = false;
          })
          .catch((err) => {
            window.__staffSyncFailed = true;
            console.warn("[スタッフ連携] 読み込みに失敗したため、data.js の内容を表示します:", err);
          })
      );
    }

    if (sheetsSyncConfig.faqCsvUrl) {
      tasks.push(
        fetchWithRetry(sheetsSyncConfig.faqCsvUrl)
          .then((text) => {
            const { headers, objects } = csvToTable(text, true);
            window.__syncedFaqData = buildFaqData(headers, objects);
            window.__faqSyncFailed = false;
          })
          .catch((err) => {
            window.__faqSyncFailed = true;
            console.warn("[Q&A連携] 読み込みに失敗したため、data.js の内容を表示します:", err);
          })
      );
    }

    if (sheetsSyncConfig.activitiesCsvUrl) {
      tasks.push(
        fetchWithRetry(sheetsSyncConfig.activitiesCsvUrl)
          .then((text) => {
            const { headers, objects } = csvToTable(text, true);
            window.__syncedActivitiesData = buildActivitiesData(headers, objects);
            window.__activitiesSyncFailed = false;
          })
          .catch((err) => {
            window.__activitiesSyncFailed = true;
            console.warn("[活動内容連携] 読み込みに失敗したため、data.js の内容を表示します:", err);
          })
      );
    }

    if (sheetsSyncConfig.settingsCsvUrl) {
      tasks.push(
        fetchWithRetry(sheetsSyncConfig.settingsCsvUrl)
          .then((text) => {
            const { headers, objects } = csvToTable(text, true); // 2行目は記入例として読み飛ばす
            window.__syncedSettings = buildSettingsData(headers, objects);
            window.__settingsSyncFailed = false;
          })
          .catch((err) => {
            window.__settingsSyncFailed = true;
            console.warn("[その他設定連携] 読み込みに失敗したため、data.js の内容を表示します:", err);
          })
      );
    }

    await Promise.allSettled(tasks);
  };
})();
