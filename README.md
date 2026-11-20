# 六本木ヒルズを引っこ抜け

港区のあちこちから、筍のようにニョキニョキ生えてくる六本木ヒルズを、上スワイプで引っこ抜く3Dブラウザゲームです。

## 遊び方
- ヒルズの近くで**上にスワイプ**すると引っこ抜ける。早く見つけるほど楽で、育つほど長いスワイプが必要
- 根付いたヒルズも、何回もスワイプすれば抜ける（30点）
- **顔を出したばかり**のヒルズほど高得点（極上の朝掘り 500点 → 育ちすぎ 40点）
- 育ちきったヒルズは数秒で**根付く**。根付いたヒルズが同時に5本になると港区陥落
- 制限時間は90秒。続けて抜くとコンボボーナス
- 大江戸線・日比谷線の近く（線路から300m以内）に生えたヒルズは、根っこに電車が絡まっていて、地下鉄ごと抜くと +100 点
- 抜いたヒルズは放物線を描いて飛び、横倒しに着地して土煙を上げる
- 結果画面の「結果をシェア」で、スマホでは共有メニュー（結果画像つき）、PCではXの投稿画面を開く
- 日本語・英語に対応。端末の言語で自動的に選び、タイトル画面のボタンで切り替えられる（文言は `i18n.js`）
- BGM・効果音はオリジナル。スタート前の読み込み中に WebAudio で音声データを作っておき、プレイ中は再生するだけ（右上の🔊でオン・オフ）

| 操作 | スマホ | PC |
|---|---|---|
| 引っこ抜く | ヒルズの近くで上スワイプ | 上ドラッグ |
| 回転 | 左右スワイプ | 左右ドラッグ / Q・E |
| 拡大・縮小 | 2本指ピンチ | ホイール / ＋－キー |
| 前進・後退 | 2本指で下（前進）・上（後退）にスワイプ | W・S / ↑↓ |
| 遠くへ移動 | 画面端の矢印・レーダーをタップ | 同じ |

## ステージ
- 六本木ヒルズ森タワーを原点に、緯度経度を 1単位=1m に変換して配置。ゲームエリアは半径5km
- 実際の位置に置いたランドマーク：東京タワー、東京スカイツリー、富士山（約96km先。地球の丸みによる沈み込みも計算）、麻布台ヒルズ、虎ノ門ヒルズ、東京ミッドタウン、東京都庁、渋谷スクランブルスクエア、ドコモタワー、レインボーブリッジ、皇居・明治神宮などの緑地、東京湾、隅田川
- 富士山は画面上の存在感を出すため 1.8倍に強調（`main.js` の `FUJI_SCALE`）
- 半径6km以内の建物は **国土交通省 Project PLATEAU の3D都市モデル（LOD1、2025年版）** の実データ。スマホでも動くよう、床面積80m²未満かつ高さ15m未満の建物は省き、約10万棟にしている。港・千代田・中央・新宿・文京・台東・江東・品川・目黒・渋谷の10区
- 地面は緑地とし、道路だけを PLATEAU の道路面（tran、LOD1）から描いた `data/roads.png`（12.3km四方、1ピクセル3m）で重ねている
- 半径6kmより外の遠景の建物は手続き生成

### 出典
建物データ：国土交通省 Project PLATEAU 3D都市モデル（https://www.mlit.go.jp/plateau/）を加工して作成。

### 建物データの作り直し
`tools/` に変換スクリプトがあります（Node.js と Python が必要）。

```bash
npm install draco3dgltf
```

1. PLATEAUのデータカタログ（`https://api.plateau.reearth.io/datacatalog/plateau-datasets`）を `catalog.json` に保存し、各区の LOD1 3D Tiles を `wards.json` にまとめる
2. `python3 tools/list_tiles.py` で半径6kmにかかるタイルを列挙してダウンロード（`tiles/`）
3. `node tools/convert.mjs` で `buildings.bin` を生成し、`node tools/slim.mjs buildings.bin data/buildings.bin` で軽くして置く
4. 道路：`python3 tools/roads.py`（区ごとの CityGML zip から道路ファイルだけを範囲指定で取得）→ `python3 tools/raster.py` で `roads.png` を生成し、`data/` に置く

## 構成
ビルド不要の静的サイトです。Three.js（MIT）は `lib/` に同梱しています。

```
index.html   画面構成・UI
style.css    スタイル
main.js      ゲーム本体（Three.js）
i18n.js      日本語・英語の文言
data/        PLATEAU から変換した建物データ（平面形＋高さ）
tools/       建物データの変換スクリプト
lib/         three.module.min.js と LICENSE
```

ローカルで動かす場合（ES Modules のため file:// では動きません）:

```bash
python3 -m http.server 8000
```

## GitHub Pages
リポジトリの Settings → Pages → Build and deployment で
「Deploy from a branch」→ ブランチ `main` / フォルダ `/ (root)` を選択して保存してください。

## Android アプリ

Capacitor でゲームのファイルをアプリに同梱しています（オフラインで遊べます）。パッケージ名は `jp.techgym.hills`。

- 動作確認用 APK（デバッグ署名・テスト広告）：https://github.com/techgymjp/hills/releases/tag/android-latest
  （APK 直接：https://github.com/techgymjp/hills/releases/latest/download/hills.apk）

  スマホのカメラで読み取ると、リリース画面が開きます。

  <img src="docs/apk-qr.png" alt="Android 版の動作確認用 APK のリリース画面の QR コード" width="200">

- 既定ブランチ（main）に push するたびに GitHub Actions（`.github/workflows/android.yml`）がビルドして、上の Release の APK を差し替えます
- GitHub Secrets（`ANDROID_KEYSTORE_BASE64` など 4 つ）を登録すると、Google Play 用の署名付き AAB（本番広告）も Actions の Artifact に作ります

| 広告 | 出す場面 |
| --- | --- |
| バナー | タイトル・遊び方・ポーズ・結果の画面だけ（画面の下中央） |
| 全画面広告 | プレイ開始、トップに戻る（遊び方・ポーズ・結果から）、ポーズからの再開、結果からもう一回 のたび |
| リワード | 港区陥落（根付いたヒルズが 5 本）のとき「広告を見て続ける」。根付いたヒルズを全部引っこ抜いて続けられる（1 ゲーム 1 回。結果画面とシェア文に「コンティニュー N 回」） |

AdMob のアプリ ID は `android/app/src/main/res/values/strings.xml` の `admob_app_id`、広告ユニット ID は `ads.js` の `UNITS.android.production` に入れます。
本番の広告ユニット ID が空の種類は、本番ビルドでは出しません（Android はバナー・インタースティシャル・リワードの 3 つとも設定済み）。

```bash
npm ci
npm run android:sync   # www/ を作って Android プロジェクトにコピー（テスト広告）
npm run android:open   # Android Studio で開く
```

アイコンと起動画面は `assets/` の元画像から `npx @capacitor/assets generate --android` で生成しています。

## ライセンス

ソースコード・画像・音声・文章の著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリとして公開・販売すること、名前・アイコン・画像を使うことを禁止します。テックジムの受講生が学習目的で複製・改変することは許可します（アプリストアでの公開・広告の掲載・販売などの商用利用は禁止、著作権表示は残す）。詳しくは `LICENSE` を見てください。

同梱している three.js（MIT License）と、PLATEAU の 3D 都市モデルから作ったデータ（`data/`）は、それぞれのライセンスに従います。
