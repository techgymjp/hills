# 六本木ヒルズを引っこ抜け

港区のあちこちから、筍のようにニョキニョキ生えてくる六本木ヒルズを、上スワイプで引っこ抜く3Dブラウザゲームです。

## 遊び方
- ヒルズの近くで**上にスワイプ**すると引っこ抜ける。早く見つけるほど楽で、育つほど長いスワイプが必要
- 根付いたヒルズも、何回もスワイプすれば抜ける（30点）
- **顔を出したばかり**のヒルズほど高得点（極上の朝掘り 500点 → 育ちすぎ 40点）
- 育ちきったヒルズは数秒で**根付く**。根付いたヒルズが同時に5本になると港区陥落
- 制限時間は90秒。続けて抜くとコンボボーナス
- 抜いたヒルズは放物線を描いて飛び、横倒しに着地して土煙を上げる
- BGM・効果音はオリジナル。スタート前の読み込み中に WebAudio で音声データを作っておき、プレイ中は再生するだけ（右上の🔊でオン・オフ）

| 操作 | スマホ | PC |
|---|---|---|
| 引っこ抜く | ヒルズの近くで上スワイプ | 上ドラッグ |
| 回転 | 左右スワイプ | 左右ドラッグ / Q・E |
| 拡大・縮小 | 2本指ピンチ | ホイール / ＋－キー |
| 移動 | 画面端の矢印・レーダーをタップ | 同じ / WASD |

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
