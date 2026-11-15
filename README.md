# bitburner-scripts

Bitburner (https://bitburner-official.github.io/) 用のスクリプト置き場。
甘山愛那が作成し、ゲーム内ターミナルの `wget` で取り込むための専用リポジトリ。

## 取り込み方

ゲームのターミナルで:

```
wget https://raw.githubusercontent.com/RoboMaskBoy/bitburner-scripts/main/<ファイル名> <ファイル名>
```

まとめて更新するなら、ゲーム内で `run update.js`（道具箱一式を取り直す）。

## スクリプト一覧

- `first-hack.js` — n00dles固定の weaken / grow / hack 判断ループ（最初のスクリプト）
- `hack-worker.js` — 標的を引数で受け取る汎用 worker
- `deploy.js` v4.2 — ネットワーク全体を走査し、root取得と worker 配備を自動でやる司令塔。標的は本体の式による定常モデル（成功率・所要時間・成長率込み）で選定。`--exp` で経験値モード（経験値専用 worker を配備）。稼働中 worker は配備し直さない
- `manager.js` v2 — deploy → solve → gather を順に回し続ける定期実行マネージャ
- `gather.js` v1.2 — .js 以外のファイル（.lit 等）を home に回収する収集屋。契約は場所だけ報告
- `solve.js` v1.2 — コーディング契約を巡回して解く。対応5種（分割数／最大素因数／最大部分配列和／株取引I／カエサル暗号）
- `go.js` v1.1 — `run go.js <サーバー名>` で、そのサーバーまで自動で connect する
- `update.js` — 道具箱一式を main ブランチから取り直し、solve.js を avmnite-02h へ送る
