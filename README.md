# 🍻 ドリンク会計＋🎟️ 当日券（簡易POS）

スマホで ± ボタンを押して数を数え、合計金額を表示するシンプルなPOS。
**全端末リアルタイム同期**対応（どの端末で押しても全員の画面に即反映）。

## ページ
- **ドリンク会計** `index.html` … ソフトドリンク¥300 / アルコール¥500 / スタッフ（無料・ソフト合計に計上）
- **当日券** `tickets.html` … A¥5,000 / S¥10,000 / SS¥15,000

公開URL（GitHub Pages）:
- ドリンク: https://riogroup-tokyo.github.io/drink-pos/
- 当日券: https://riogroup-tokyo.github.io/drink-pos/tickets.html

## 機能
- ± ボタンでカウント、小計・合計金額・合計数をリアルタイム表示
- **複数端末でカウント共有**（Supabaseリアルタイム）。同時タップしてもDB側加算でズレない
- オフラインでも操作可、復帰時に自動再送（ステータス表示：ローカル/接続中/同期中/オフライン）
- リセットは全端末に反映（確認ダイアログあり）
- 各ページにURLのQRコード表示ボタン
- モバイル最適化（大きなタップ領域・ズーム防止・バイブ反応）

## 使い方
公開URLをスマホで開くだけ。インストール不要。ホーム画面に追加するとアプリのように使えます。

## 同期の仕組み（Supabase）
`sync.js` の先頭に接続情報を設定します（publishableキーは公開用なので埋め込みOK）。
```js
const SUPABASE_URL      = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_...";
const ROOM              = "rio-pos"; // 合言葉。全端末で同じ値（変えると別集計）
```
未設定のときは各端末ローカルのみで動作します（同期オフ）。

DBは `counters` テーブル＋ `bump()` / `reset_fields()` 関数で構成（セットアップSQLはセットアップ時に実行済み）。
書き込みはこの2関数経由のみに制限（RLS有効・anonは閲覧と関数実行のみ）。

## カスタマイズ
価格は各HTMLの `PRICES` を編集:
```js
// index.html
const PRICES = { soft: 300, alc: 500, staff: 0 };
// tickets.html
const PRICES = { a: 5000, s: 10000, ss: 15000 };
```

## 技術
HTML / CSS / Vanilla JS（ESモジュール）。同期は Supabase（@supabase/supabase-js をCDNから読み込み）。
