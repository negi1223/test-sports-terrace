/* カレンダー管理サイトの設定（秘密の情報は入れない。PINとトークンは、Netlifyの環境変数に入れる） */
const CONFIG = {
  // 書き込みの窓口（Netlify Functions）
  api: "/.netlify/functions/calendar",

  // 教室の一覧は、公開サイトの「活動内容」シート（公開用CSV）の「タイトル」の列から読む。
  // 教室を増やすときは、そのシートに行を足すだけ。読めなかったときだけ、下の classes を使う
  activitiesCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJIN9q-lmoofocT3PUb5TDEHrTr3C8jdp98evNPkvc--bP8pJskRfyMqpin1P8Sls3JrL0D65ghgFZ/pub?gid=1766825701&single=true&output=csv",
  classes: [
    "キッズサッカースクール",
    "GKスクール",
    "大人の夜サカ",
    "かけっこ教室",
    "シニアサッカー"
  ]
};
