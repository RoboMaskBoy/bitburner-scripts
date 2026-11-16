/** Augments モニタ v2（静的カタログ版）: 加入中の派閥について、
 *  購入可能な Augment と購入可能数を報告する。
 *  使い方: run augs.js [CS=評価] [NS=評価] [S12=評価] [SS=評価]
 *    例: run augs.js NS=5000（NiteSec の評価を 5000 として計算）
 *
 *  v2 の事情: 増強まわりの API（Singularity）は Source-File 4 がないと
 *  実行自体ができない（BN1 ではロック）。そこでカタログ（価格・必要評価・
 *  前提）は本体データから写した静的な物を使い、所持金だけ実物を読む。
 *  評価は REPS の記録値（出典は下記）を使い、引数で上書きできる。
 *  SF4 を取った後は API 版（git の履歴に保存）が使えるようになる。
 *
 *  カタログ: 本体データ Augmentations.ts から転記（2026-11-16）。
 *  価格は基準価格。実際の価格は「キュー済みの数 ×1.9 倍」で上がる。
 *  NeuroFlux Governor はレベル制: 価格・必要評価とも ×1.14^レベル。
 *  @param {NS} ns */

// 評価の記録値（2026-11-16 20:25 の銀行セーブより）。増えたら引数で上書き。
const REPS = { CyberSec: 712.87, NiteSec: 2736.66, "Sector-12": 3420.13, "Slum Snakes": 172.75 };
const REP_KEYS = { CS: "CyberSec", NS: "NiteSec", S12: "Sector-12", SS: "Slum Snakes" };
// 所持済み Augment（2026-11-16 13:06 にインストールした8個）
const OWNED = [
  "Cranial Signal Processors - Gen I",
  "Cranial Signal Processors - Gen II",
  "Neurotrainer II",
  "BitWire",
  "Synaptic Enhancement Implant",
  "Neurotrainer I",
  "Wired Reflexes",
  "NeuroFlux Governor",
];
const NF_LEVEL = 1; // NeuroFlux Governor の現在レベル
const NF = "NeuroFlux Governor";

// [名前, 派閥, 基準価格, 必要評価, 前提]
const CATALOG = [
  ["Artificial Synaptic Potentiation", ["NiteSec"], 8e7, 6.25e3, []],
  ["BitWire", ["CyberSec", "NiteSec"], 1e7, 3.75e3, []],
  ["CRTX42-AA Gene Modification", ["NiteSec"], 2.25e8, 4.5e4, []],
  ["CashRoot Starter Kit", ["Sector-12"], 1.25e8, 1.25e4, []],
  ["Combat Rib I", ["Slum Snakes"], 2.375e7, 7.5e3, []],
  ["Cranial Signal Processors - Gen I", ["CyberSec", "NiteSec"], 7e7, 1e4, []],
  ["Cranial Signal Processors - Gen II", ["CyberSec", "NiteSec"], 1.25e8, 1.875e4, ["Cranial Signal Processors - Gen I"]],
  ["Cranial Signal Processors - Gen III", ["NiteSec"], 5.5e8, 5e4, ["Cranial Signal Processors - Gen II", "Cranial Signal Processors - Gen I"]],
  ["DataJack", ["NiteSec"], 4.5e8, 1.125e5, []],
  ["Embedded Netburner Module", ["NiteSec"], 2.5e8, 1.5e4, []],
  ["LuminCloaking-V1 Skin Implant", ["Slum Snakes"], 5e6, 1.5e3, []],
  ["LuminCloaking-V2 Skin Implant", ["Slum Snakes"], 3e7, 5e3, ["LuminCloaking-V1 Skin Implant"]],
  ["Neural-Retention Enhancement", ["NiteSec"], 2.5e8, 2e4, []],
  ["Neuralstimulator", ["Sector-12"], 3e9, 5e4, []],
  ["NeuroFlux Governor", ["CyberSec", "NiteSec", "Sector-12", "Slum Snakes"], 750e3, 500, []],
  ["Neurotrainer I", ["CyberSec"], 4e6, 1e3, []],
  ["Neurotrainer II", ["NiteSec"], 4.5e7, 1e4, []],
  ["SmartSonar Implant", ["Slum Snakes"], 7.5e7, 2.25e4, []],
  ["Speech Processor Implant", ["Sector-12"], 5e7, 7.5e3, []],
  ["Synaptic Enhancement Implant", ["CyberSec"], 7.5e6, 2e3, []],
  ["Augmented Targeting I", ["Sector-12", "Slum Snakes"], 1.5e7, 5e3, []],
  ["Augmented Targeting II", ["Sector-12"], 4.25e7, 8.75e3, ["Augmented Targeting I"]],
  ["Wired Reflexes", ["Sector-12", "Slum Snakes"], 2.5e6, 1.25e3, []],
  ["Neural Wit Amplifier", ["Slum Snakes"], 1e7, 5e3, []],
];

export async function main(ns) {
  for (const a of ns.args) {
    const m = String(a).match(/^(CS|NS|S12|SS)=([\d.]+)$/);
    if (m) REPS[REP_KEYS[m[1]]] = Number(m[2]);
  }
  const money = ns.getPlayer().money;
  const owned = new Set(OWNED);
  const fmt$ = (v) =>
    v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "b" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "m" : "$" + Math.round(v / 1e3) + "k";
  const fmtRep = (v) => (v >= 1000 ? (v / 1000).toFixed(2) + "k" : v.toFixed(1));

  const repReqOf = (name, base) => (name === NF ? base * Math.pow(1.14, NF_LEVEL) : base);
  const repOk = (factions, req) => factions.some((f) => (REPS[f] ?? 0) >= req);

  // 判定（前提は所持済みのみで見る素の判定）
  const buyableNow = [];
  const blockedRep = [];
  const blockedPrereq = [];
  for (const [name, factions, price, rep, prereq] of CATALOG) {
    if (owned.has(name)) continue;
    const prereqNg = !prereq.every((p) => owned.has(p));
    const repNg = !repOk(factions, repReqOf(name, rep));
    if (prereqNg) blockedPrereq.push(name);
    if (repNg) blockedRep.push(name);
    if (prereqNg || repNg) continue;
    buyableNow.push({ name, factions, price, rep });
  }

  // 購入シミュレーション: 前提を満たす中で一番高い物から買う。
  // 価格はキュー済みの数だけ ×1.9 されていく。NeuroFlux は最後に残金で。
  const picked = new Set(owned);
  const order = [];
  let spent = 0;
  let nfLevel = NF_LEVEL;
  const remaining = CATALOG.filter(
    ([name, factions, , rep]) => name !== NF && !owned.has(name) && repOk(factions, repReqOf(name, rep)),
  );
  for (;;) {
    const candidates = remaining
      .filter(([name, , , , prereq]) => !order.some((o) => o.name === name) && prereq.every((p) => picked.has(p)))
      .sort((a, b) => b[2] - a[2]);
    const next = candidates.find(([, , base]) => spent + base * Math.pow(1.9, order.length) <= money);
    if (!next) break;
    const [name, , base] = next;
    const cost = base * Math.pow(1.9, order.length);
    spent += cost;
    order.push({ name, cost });
    picked.add(name);
  }
  // 残金で NeuroFlux を追加購入（価格 ×1.14^レベル × 1.9^キュー数）
  let nfBought = 0;
  if (repOk(CATALOG.find((c) => c[0] === NF)[1], repReqOf(NF, 500))) {
    for (;;) {
      const cost = 750e3 * Math.pow(1.14, nfLevel) * Math.pow(1.9, order.length);
      if (spent + cost > money) break;
      spent += cost;
      order.push({ name: `${NF} (Lv${nfLevel + 1})`, cost });
      nfLevel++;
      nfBought++;
    }
  }

  ns.tprint("=== Augments モニタ v2（静的カタログ版）===");
  ns.tprint(`所持金: ${fmt$(money)}`);
  ns.tprint(
    `評価（記録値）: CyberSec ${fmtRep(REPS.CyberSec)} / NiteSec ${fmtRep(REPS.NiteSec)} / Sector-12 ${fmtRep(REPS["Sector-12"])} / Slum Snakes ${fmtRep(REPS["Slum Snakes"])}`,
  );
  for (const faction of Object.keys(REPS)) {
    const here = buyableNow.filter((b) => b.factions.includes(faction) && (REPS[faction] ?? 0) >= repReqOf(b.name, b.rep));
    const total = CATALOG.filter((c) => c[1].includes(faction)).length;
    ns.tprint(`[${faction}] 購入可能 ${here.length}/${total}`);
    for (const b of here.sort((x, y) => y.price - x.price)) {
      ns.tprint(`  ${b.name} — ${fmt$(b.price)}`);
    }
  }
  ns.tprint(`購入シミュレーション: ${order.length} 件キュー可能、総額 ${fmt$(spent)}（NeuroFlux ${nfBought} レベル含む）`);
  for (const o of order) ns.tprint(`  ${o.name} — ${fmt$(o.cost)}`);
  if (blockedRep.length > 0) ns.tprint(`評価不足: ${blockedRep.join(", ")}`);
  if (blockedPrereq.length > 0) ns.tprint(`前提不足（束買いでは解消）: ${blockedPrereq.join(", ")}`);
}
