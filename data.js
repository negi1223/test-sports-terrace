/* =========================================================================
   このファイルを編集するだけでサイトの内容を更新できます。
   HTMLやCSSは基本的に触らずに、下の { ... } や [ ... ] の中身を
   書き換え・追加・削除するだけでOKです。

   ・配列（[ ... ]）の1件分は { } で囲まれた「オブジェクト」です
   ・1件をコピー＆ペーストして値を書き換えれば、項目を増やせます
   ・末尾のカンマ「,」を消し忘れないよう注意してください
   ・画像を追加したいときは images フォルダにファイルを置いて、
     このファイルの該当箇所に "images/ファイル名" と書くだけです

   ※このサイトは「徳島文理大学サッカー部公式サイト」と同じ仕組み
     （Googleスプレッドシートと連携して更新できる静的サイト）を踏襲しています。
     まだ内容が未確定の項目は「仮」「準備中」として仮データを入れているので、
     決まり次第それぞれ書き換えてください。
   ========================================================================= */


/* -------------------------------------------------------------------------
   -1. Googleスプレッドシート連携の設定（ニュース・予定・スタッフ・Q&A）
   ここにURLを貼ると、data.js の下の各データの代わりに、Googleスプレッドシート
   の内容が自動でサイトに表示されます。

   【設定手順】
   ① Googleフォーム（ニュース・予定）またはGoogleスプレッドシート（スタッフ・Q&A）を用意する
   ② スプレッドシートを開き、上部メニューの「ファイル」→「共有」→「ウェブに公開」を選択
   ③ 公開する範囲でシート名を選び、形式を「カンマ区切りの値（.csv）」にして「公開」
   ④ 表示されたURLを、下の対応するCsvUrl に "" で囲んで貼り付ける

   ※空欄（""）のままなら、今まで通り下の newsData / calendarData などが
     そのまま使われます（壊れる心配なく、準備ができてから設定できます）
   ------------------------------------------------------------------------- */
const sheetsSyncConfig = {
  newsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJIN9q-lmoofocT3PUb5TDEHrTr3C8jdp98evNPkvc--bP8pJskRfyMqpin1P8Sls3JrL0D65ghgFZ/pub?gid=2140409168&single=true&output=csv",       // ニュース・お知らせ（Googleフォーム経由を想定）
  calendarCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJIN9q-lmoofocT3PUb5TDEHrTr3C8jdp98evNPkvc--bP8pJskRfyMqpin1P8Sls3JrL0D65ghgFZ/pub?gid=766434590&single=true&output=csv",   // 活動日・イベント・大会の予定（Googleフォーム経由を想定）
  staffCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJIN9q-lmoofocT3PUb5TDEHrTr3C8jdp98evNPkvc--bP8pJskRfyMqpin1P8Sls3JrL0D65ghgFZ/pub?gid=1135220272&single=true&output=csv",      // コーチ・スタッフ紹介（スプレッドシート直接編集を想定）
  faqCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJIN9q-lmoofocT3PUb5TDEHrTr3C8jdp98evNPkvc--bP8pJskRfyMqpin1P8Sls3JrL0D65ghgFZ/pub?gid=288856310&single=true&output=csv",        // よくある質問（スプレッドシート直接編集を想定）
  activitiesCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJIN9q-lmoofocT3PUb5TDEHrTr3C8jdp98evNPkvc--bP8pJskRfyMqpin1P8Sls3JrL0D65ghgFZ/pub?gid=1766825701&single=true&output=csv", // 活動内容（スプレッドシート直接編集を想定）
  settingsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJIN9q-lmoofocT3PUb5TDEHrTr3C8jdp98evNPkvc--bP8pJskRfyMqpin1P8Sls3JrL0D65ghgFZ/pub?gid=1295917267&single=true&output=csv", // トップ・About・連絡先などの文言まとめ（下の「★「その他」シートについて」を参照）

  newsMaxItems: 6, // トップページに新しい順で表示するニュースの件数
};

/* -------------------------------------------------------------------------
   ★「その他」シート（sheetsSyncConfig.settingsCsvUrl）について

   トップの見出し・紹介文、Aboutのスローガン・紹介文・各項目カード、連絡先の
   メールアドレス・お問い合わせフォームURL、公式Instagramリンクをまとめて
   1つのスプレッドシートで変更できます（Googleフォームは使いません）。

   「1件＝1行」ではなく、「1つの設定＝1行」という表になります。

   【設定手順】
   ① 新しくGoogleスプレッドシートを作る（フォームは作らない）
   ② 1行目に自由に「記入例」を書く（自動的に読み飛ばされ、サイトには使われません）
   ③ 2行目（見出し行）に「項目」「表示される内容」「補足説明(あれば)」の3つを入力する
   ④ 3行目から、変更したい項目だけ1行ずつ入力する（変更しない項目の行は
     作らなくてOK。空欄のまま残しておいても無視されます）
   ⑤ 「ファイル」→「共有」→「ウェブに公開」→ 形式を「カンマ区切りの値(.csv)」にして公開
   ⑥ 表示されたURLを sheetsSyncConfig.settingsCsvUrl に貼る

   【「項目」に入力する内容】
     トップ画面のタイトル → トップの大見出し。「表示される内容」欄でAlt+Enter
                          （Mac: ⌥+Enter）を押すと改行できる。「補足説明」欄に
                          書いた文字列と一致する部分だけ、自動で色付きの
                          アクセント表示になる
                          （例）内容="サッカーを通じて、↵笑顔があふれる場所へ。"、
                              　補足="笑顔" → 「笑顔」の部分だけ色が変わる
     トップの「紹介文」    → トップ見出しの下にある説明文
     トップの「写真」     → トップの活動写真（images/ は省略可）。セルの中でAlt+Enter
                          （Mac: ⌥+Enter）を押して複数行入力すると、自動でスライド
                          ショーになる（1行だけなら静止画1枚のまま）
     Aboutのスローガン    → Aboutのスローガン
     Aboutの「紹介文」    → Aboutの団体紹介文（段落）
     Aboutの「写真」     → Aboutセクションの写真（images/ は省略可）
     Aboutの「◯◯」       → ◯◯という名前のAbout項目カードを追加・上書きする
                          （例：「Aboutの「月謝・入会案内」」と書けば、その
                          カードの内容・補足だけを差し替えられる。data.jsの
                          aboutData.factsに無い新しい項目名を書けば、カードが
                          自動で増える）
     公式Instagramリンク  → 公式Instagramへのリンク
     お問い合わせフォームURL → 体験申し込み・お問い合わせ用Googleフォームのリンク
     連絡先メール         → お問い合わせ用のメールアドレス

   ※上のどれにも当てはまらない項目名の行は、無視されます
   ※「Aboutの」「トップの」などの前置き部分は、多少の入力ミスがあっても
     認識されるように作ってありますが、心配な場合はこの例の書き方を
     そのままコピーしてもらうのが確実です

   例）
   項目,表示される内容,補足説明(あれば)
   トップ画面のタイトル,サッカーを通じて、↵笑顔があふれる場所へ。,笑顔
   Aboutのスローガン,「スポーツで、地域に笑顔を。」,
   Aboutの「月謝・入会案内」,月額3000円（予定）,※2026年10月確定予定
   連絡先メール,info@tokushima-sports-terrace.example.com,
   ------------------------------------------------------------------------- */


const siteData = {
  orgNameJp: "一般社団法人 徳島スポーツテラス",
  orgNameShort: "徳島スポーツテラス",
  orgNameEn: "TOKUSHIMA SPORTS TERRACE",
  logoInitial: "T",              // ヘッダー左上の丸アイコンの文字（logoImageが空のときに使われます）
  logoImage: "images/logo.jpg",                 // ロゴ画像ができたら "images/logo.png" のように入れる

  // 公式Instagram。フッターとお問い合わせ欄にリンクが出る（@ハンドル名はURLから自動で取り出される）
  // ※その他シートの「公式Instagramリンク」でも差し替えられる（そちらが優先される）
  instagramUrl: "https://www.instagram.com/tokushima.st/",

  // 見学・体験申し込みに関する問い合わせ先
  adviserName: "顧問の金子先生",
  contactEmail: "info@example.com", // 仮のメールアドレス。正式なものに差し替えてください

  // 体験申し込み・お問い合わせ用Googleフォーム（未設定の間はメール表記のみ使われます）
  contactFormUrl: "", // 例: "https://docs.google.com/forms/d/e/xxxx/viewform"

  copyrightYear: "2026", // 法人を設立した年
  copyrightEn: "Tokushima Sports Terrace. All Rights Reserved."
};


/* -------------------------------------------------------------------------
   1. トップビジュアル（HEROセクション）
   photo: 写真を1枚だけ使いたい場合は "images/hero.jpg" のように文字列で指定する。
          複数枚を自動スライドショーにしたい場合は、配列で並べる。
          空のまま（""または[]）にするとダミー表示のままになります
   ------------------------------------------------------------------------- */
const heroData = {
  eyebrow: "TOKUSHIMA SPORTS TERRACE",
  headline: "サッカーを通じて、",
  headlineAccent: "笑顔",
  headlineSuffix: "があふれる場所へ。",
  sub: "一般社団法人徳島スポーツテラスは、徳島文理大学のグラウンドで、子どもから大人までが楽しめるスポーツの場をつくっています。スポーツを通して、人と人、大学と地域をつなぎます。",
  // 複数枚にしたい場合は配列にする（例: ["images/a.jpg", "images/b.jpg"]）と自動でスライドショーになる。
  // ※その他シート（sheetsSyncConfig.settingsCsvUrl）の「トップの写真」でも差し替えられる（そちらが優先される）
  photo: "images/about-team.webp",
  photoAlt: "活動中の様子",
  // ヒーローの数字カード（対象・活動地域・設立）は、伝わる内容が薄いため、なくした。使うときは、{ label, value, suffix } を並べる
  stats: []
};


/* -------------------------------------------------------------------------
   2. 団体の紹介・活動日時（ABOUTセクション）
   ------------------------------------------------------------------------- */
// 経営理念（「大切にすること」の3つと署名）。出どころ：公式インスタの設立理念の投稿（代表理事 金子 憲一）
const philosophyData = {
  points: [
    { title: "子どもたちの成長", text: "スポーツを通して、子どもたちの成長を支えます。" },
    { title: "学生の学び", text: "大学生が、運営を支える立場で関わり、外部の方々との交流を通して、学びを深めます。" },
    { title: "地域の活性化", text: "大学と地域のつながりを深め、地域の活性化に貢献します。" }
  ],
  sign: "代表理事　金子 憲一"
};

const aboutData = {
  // ※その他シート（sheetsSyncConfig.settingsCsvUrl）の「Aboutの写真」でも差し替えられる（そちらが優先される）
  photo: "images/activity-soccer-coaching.webp",
  slogan: "スポーツを通して、人と人、大学と地域をつなぐ。",
  text: "徳島文理大学のグラウンドでは、10年以上にわたり、大学やサッカー協会による事業が行われ、学生も運営を支えながら成長してきました。その歩みを土台に、地域とのつながりをさらに深めるため、一般社団法人徳島スポーツテラスを設立しました。",
  facts: [
    { label: "活動場所", value: "徳島文理大学 サッカーグラウンド", note: "https://maps.app.goo.gl/qZpGdwkUb7jbqfn17" },
  ]
};


/* -------------------------------------------------------------------------
   2-2. 活動内容（ACTIVITIESセクション）
   ※Googleスプレッドシート連携（sheetsSyncConfig.activitiesCsvUrl）を設定している
     場合は、このデータの代わりにスプレッドシートの内容が表示されます。

   【スプレッドシートでの設定手順】
     ① 新しくGoogleスプレッドシートを作る（フォームは作らない）
     ② 1行目に自由に「記入例」を書く（自動的に読み飛ばされます）
     ③ 2行目（見出し行）に「タイトル」「説明」「画像ファイル名」の3つを入力する
     ④ 3行目から、活動内容1つにつき1行ずつ入力する
     ⑤ 「ファイル」→「共有」→「ウェブに公開」→ 形式を「カンマ区切りの値(.csv)」にして公開
     ⑥ 表示されたURLを sheetsSyncConfig.activitiesCsvUrl に貼る

   images: 1つの活動につき複数枚の写真を並べられる（配列）。data.js に直接書く場合は
           他の画像と同じく "images/ファイル名" の形式で配列に並べる。
           スプレッドシート側では「画像ファイル名」の欄でセルの中でAlt+Enter
           （Mac: ⌥+Enter）を押して複数行入力すると、行ごとに1枚として扱われる
           （Googleドライブの共有リンクを貼った場合は自動でサムネイルに変換される）
   ------------------------------------------------------------------------- */
const activitiesData = [
  {
    title: "キッズ教室（年中〜年長）",
    price: "10回 7,000円（1回700円）",
    text: "体を動かす楽しさを知る、幼稚園児向けのクラスです。10回パックで、1回あたり700円（最初に7,000円）です。",
    images: ["images/activity-soccer-coaching.webp", "images/activity-soccer-drill.webp"]
  },
  {
    title: "GKスクール（毎週木曜日）",
    price: "1回 1,000円（初回無料）",
    text: "ゴールキーパーの基礎から学べるスクールです。木曜19:45〜21:00（小5〜中1・中2〜高校生は日程が分かれます）。1回1,000円、初回無料。",
    images: ["images/activity-match-action.webp"]
  },
  {
    title: "大人の夜サカ（ゆるサカ）",
    price: "1回 1,000円",
    text: "大人のための「夜サカ」です。金曜19:45〜21:00、参加費1,000円（高校生不可）。",
    images: ["images/activity-community-event.webp"]
  },
  {
    title: "かけっこ教室",
    price: "初回無料／以降1回 500円",
    text: "小学生向けのかけっこ教室です。正しい走り方を身につけます。初回体験無料、以降は1回500円。",
    images: []
  }
];


/* -------------------------------------------------------------------------
   3. ニュース・お知らせ（NEWSセクション）
   ※Googleフォーム連携（sheetsSyncConfig.newsCsvUrl）を設定している場合は、
     このデータの代わりにスプレッドシートの内容が表示されます。
   tag:    "info"（お知らせ） / "event"（イベント） / "recruit"（募集）
   image:  ニュースに添える画像（省略可）。トップページのカードには先頭の1枚だけ
           表示される。data.js に直接書く場合は他の画像と同じく "images/ファイル名"
           の形式で指定する
   images: 画像が複数ある場合の配列（省略可）。更新一覧ページ（news.html）では
           このimagesに入っている画像を全部表示する
           Googleフォーム連携（newsCsvUrl）を使う場合は、フォーム側で「ファイル
           アップロード」形式の質問を追加し、質問文に「画像」という文字を含めれば
           （例：「(もしあれば)画像をアップロードしてください」）、複数枚アップロード
           された画像も自動ですべて認識される。Googleドライブの共有リンクを
           サイト側（sheets-sync.js）が自動でサムネイル表示用のURLに変換するので、
           特別な作業は不要
   ------------------------------------------------------------------------- */
const newsData = [
  {
    tag: "info",
    date: "2026.08.24",
    title: "サイトを準備中です",
    text: "一般社団法人徳島スポーツテラスの公式サイトを準備しています。詳しい情報は決まり次第お知らせします。",
    pinned: true
  }
];


/* -------------------------------------------------------------------------
   4. 活動日・イベント・大会の予定（SCHEDULE・カレンダー）
   ※Googleフォーム連携（sheetsSyncConfig.calendarCsvUrl）を設定している場合は、
     このデータの代わりにスプレッドシートの内容が表示されます。

   date： "2026-09-05" のように「年-月-日」の形式で入力する
   type： "activity"（活動日） / "event"（イベント） / "tournament"（大会）
   title： カレンダーに短く表示するタイトル
   detail： 予定をクリックした時に表示する詳しい内容（省略可）
   ------------------------------------------------------------------------- */
const calendarData = [
  { date: "2026-08-30", type: "activity", title: "サッカー教室（仮）", detail: "内容は準備中です。決まり次第更新します。" },
  { date: "2026-09-06", type: "activity", title: "サッカー教室（仮）", detail: "" },
  { date: "2026-09-13", type: "event", title: "地域交流イベント（仮）", detail: "" }
];


/* -------------------------------------------------------------------------
   5. コーチ・スタッフ紹介（STAFFセクション）
   photo: 顔写真を使いたい場合は画像パスを入れる（例: "images/staff-kaneko.jpg"）
          入れなければ名前の1文字目が丸背景に表示されます
   ------------------------------------------------------------------------- */
const staffData = [
  { role: "代表理事", name: "金子 憲一", comment: "徳島文理大学男子サッカー部監督。", photo: "images/kaneko.webp" },
  { role: "コーチ（GKスクール担当）", name: "池田 隼", comment: "徳島文理大学サッカー部GKコーチ。サッカーBライセンス、GKライセンスレベル2。", photo: "images/ikeda.webp" }
  // ↑ 仮データです。他のコーチ・スタッフの情報が決まり次第、この形式でコピーして追加してください
];


/* -------------------------------------------------------------------------
   6. よくある質問（FAQセクション）
   ------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------
   お問い合わせ・教室申込フォームの送信先（Googleフォーム）
   action は各フォームの formResponse のURL、fields は各質問の entry.数字。
   ※フォームの質問はすべて「記述式」にしておくこと（ラジオ・プルダウンだと送信が弾かれます）
   ※回答用のスプレッドシートは「ウェブに公開」しないこと（個人情報が入ります）
   ------------------------------------------------------------------------- */
const formConfig = {
  contact: {
    action: "https://docs.google.com/forms/d/e/1FAIpQLSferlDi6XNOAAFUPrm14Sg_kYioCgkrsy_IxORlx8AIxAQv0g/formResponse",
    fields: { name: "entry.492602656", email: "entry.998459030", message: "entry.2006959654" }
  },
  apply: {
    action: "https://docs.google.com/forms/d/e/1FAIpQLSexvLbice-_NIzJh06iTTa5Oy3E8A3CM3rEuXFFFf7W0bV00w/formResponse",
    fields: { name: "entry.271299143", furigana: "entry.518971899", guardian: "entry.1578384817", email: "entry.1640369488", grade: "entry.2101327197", contact: "entry.1530020141", className: "entry.915421559", date: "entry.1345185932", consent: "entry.382244478", term: "entry.1744206597" },
    // 承諾事項のチェックボックスの選択肢。フォーム側の選択肢と1文字も違わないこと
    consentValue: "確認しました。",
    // 学年の選択肢。フォーム側の「学年」の選択肢と1文字も違わないこと
    gradeOptions: ["年中", "年長", "小学1年生", "小学2年生", "小学3年生", "小学4年生", "小学5年生", "小学6年生", "中学1年生", "中学2年生", "中学3年生", "高校1年生", "高校2年生", "高校3年生"]
  }
};


const faqData = [
  {
    q: "見学・体験はできますか？",
    a: "体験申し込みの受付方法は準備中です。決まり次第、お問い合わせのご案内をこちらに掲載します。"
  },
  {
    q: "月謝はかかりますか？",
    a: "現在確認中です。決まり次第お知らせします。"
  }
];
