# カレンダー管理サイト（/admin/）

活動予定のカレンダーを、画面から**追加・編集・削除**します。見た目は公開サイトのカレンダーと同じです。

## 仕組み

```
/admin/（この画面）──PINつきで依頼──▶ Netlify Functions（netlify/functions/calendar.js）
                                           │ GitHubのAPIで更新
                                           ▼
                                  data/calendar.json（GitHub）
                                           │ 保存されると、Netlifyが自動で再公開（1分ほど）
                                           ▼
                                  公開サイトのカレンダー・申込ページ・トップの申込一覧
```

- 予定のデータは、`data/calendar.json`（サイトの中のファイル）に入っています。
- 変更のたびに、GitHubに履歴（コミット）が残るので、**間違えても、戻せます**。
- GitHubのトークンとPINは、Netlifyの**環境変数**に入れます（コードにも、画面にも、出ません）。
- 教室の一覧は、スプレッドシートの「活動内容」（公開用CSV）の「タイトル」の列から読みます。教室を増やすときは、そこに行を足すだけです。
- 申込・申込の確認（Googleフォームとスプレッドシート）は、これまでと同じです。

## 設定手順（最初の1回）

### 1. GitHubのトークンを作る
1. GitHub にログイン →右上の自分のアイコン → **Settings** → 左の一番下 **Developer settings**。
2. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
3. 次のように設定する。
   - Token name：`calendar-admin`
   - Expiration：選べる、一番長い期間（切れる日を、メモしておく）
   - Repository access：**Only select repositories** → このサイトのリポジトリ（`test-sports-terrace`）だけを選ぶ
   - Permissions → Repository permissions → **Contents：Read and write**（ほかは、すべて No access のまま）
4. **Generate token** を押して、表示された `github_pat_…` をコピーする（**この画面を閉じると、二度と見られない**）。

### 2. Netlifyに環境変数を入れる
1. Netlify のこのサイト → **Site configuration** → **Environment variables** → **Add a variable**。
2. 次の3つ（または4つ）を入れる。

| Key | Value |
|---|---|
| `ADMIN_PIN` | 決めたPIN（**6桁以上**の数字がおすすめ） |
| `GITHUB_TOKEN` | さっきコピーしたトークン |
| `GITHUB_REPO` | `negi1223/test-sports-terrace`（`ユーザー名/リポジトリ名`） |
| `GITHUB_BRANCH` | `main`（省略可） |

3. 保存したら、**Deploys → Trigger deploy → Deploy site** で、再公開する（環境変数は、再公開のあとに反映される）。

### 3. 使ってみる
`https://（サイトのURL）/admin/` を開いて、PINを入れる。予定を追加して、1分ほど待って、公開サイトのカレンダーに出るか確認する。

## 練習モード
URLの最後に `?mock=1` を付けて開くと（例：`/admin/?mock=1`）、見本データで動きます。PINは `1234` で、実際のデータには、書き込みません。

## 教室を増やす・減らすとき（コードの変更は不要）
1. スプレッドシートの「活動内容」に、行を足す（タイトルは「新しい教室（補足）」の形。「（」より前が、教室名になる）。
2. 申込フォームの「教室」の質問の選択肢に、**同じ教室名**を足す（違うと、サイトから申込が送れません）。
3. 管理サイトを開き直すと、プルダウンに増えている。

## 注意
- **管理サイトのURLとPINは、先生と更新担当の人だけ**に伝える。検索には出ない設定にしてあるが、URLを知っていれば、PINの入力画面までは、開ける。
- PINは、間違えるたびに、少し待たされる（総当たりを遅くするため）。
- トークンの**有効期限**が切れると、保存できなくなる。切れる前に、新しいトークンを作って、`GITHUB_TOKEN` を入れ替える。
- 同時に2人が保存すると、あとの人が、自動でやり直す（それでも重なったときは、エラーが出るので、もう一度）。
- 動作確認：`node netlify/functions/calendar.test.js`（GitHubの代わりの偽物で、窓口の動きを確かめる）。
