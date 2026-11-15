/** Augments モニタ: 加入中の全派閥について、購入可能な Augment と
 *  購入可能数を報告する。所持金と評価（rep）・前提 Augment を見て判定し、
 *  「高い順に買う」シミュレーション（1つ買うごとに価格 ×1.9）で
 *  実際にキューへ入れられる個数と総額も出す。
 *  使い方: run augs.js（338GB 以上のサーバーで実行すること。
 *  通常は run-augs.js が最大のクラウドサーバーへ転送して実行する）
 *
 *  RAM が大きい理由: 増強まわりの関数は Singularity 系で、BN1 では
 *  価格が16倍になる（SF4 を持てば元に戻る）。計算値 338.1GB。
 *  @param {NS} ns */
export async function main(ns) {
  const S = ns.singularity;
  const player = ns.getPlayer();
  const money = player.money;
  const owned = new Set(S.getOwnedAugmentations(true)); // キュー済みも含む
  const NEUROFLUX = "NeuroFlux Governor";

  const fmt$ = (v) =>
    v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "b" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "m" : "$" + Math.round(v / 1e3) + "k";
  const fmtRep = (v) => (v >= 1000 ? (v / 1000).toFixed(2) + "k" : v.toFixed(1));

  // 派閥ごとに候補を集める（同じ Augment が複数派閥に出る場合は統合する）
  const byAug = new Map(); // name -> { price, repReq, prereq, factions: [{name, rep}] }
  const perFaction = [];
  for (const faction of player.factions) {
    const rep = S.getFactionRep(faction);
    const list = S.getAugmentationsFromFaction(faction);
    let buyableHere = 0;
    for (const aug of list) {
      if (!byAug.has(aug)) {
        byAug.set(aug, {
          price: S.getAugmentationPrice(aug),
          repReq: S.getAugmentationRepReq(aug),
          prereq: S.getAugmentationPrereq(aug),
          factions: [],
        });
      }
      byAug.get(aug).factions.push({ name: faction, rep });
    }
    perFaction.push({ faction, rep, total: list.length });
    void buyableHere;
  }

  // 判定: 所持（キュー済み含む）／前提不足／評価不足／購入可能
  const buyable = [];
  const blocked = { prereq: [], rep: [] };
  let ownedCount = 0;
  for (const [aug, info] of byAug) {
    if (owned.has(aug) && aug !== NEUROFLUX) {
      ownedCount++;
      continue;
    }
    const prereqOk = info.prereq.every((p) => owned.has(p));
    if (!prereqOk) {
      blocked.prereq.push(aug);
      continue;
    }
    const repOk = info.factions.some((f) => f.rep >= info.repReq);
    if (!repOk) {
      blocked.rep.push(aug);
      continue;
    }
    buyable.push({ aug, ...info });
  }

  // 高い順に買うシミュレーション: 1つキューするごとに価格は ×1.9
  const sorted = [...buyable].sort((a, b) => b.price - a.price);
  let simCount = 0;
  let simTotal = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cost = sorted[i].price * Math.pow(1.9, i);
    if (simTotal + cost > money) break;
    simTotal += cost;
    simCount++;
  }

  ns.tprint("=== Augments モニタ ===");
  ns.tprint(`所持金: ${fmt$(money)}`);
  ns.tprint(
    `購入可能: ${buyable.length} 種（所持済み ${ownedCount} 種／前提不足 ${blocked.prereq.length} 種／評価不足 ${blocked.rep.length} 種）`,
  );
  ns.tprint(`高い順シミュレーション: ${simCount} 種までキュー可能、総額 ${fmt$(simTotal)}`);
  for (const pf of perFaction) {
    const here = buyable.filter((b) => b.factions.some((f) => f.name === pf.faction && f.rep >= b.repReq));
    ns.tprint(`[${pf.faction}] 評価 ${fmtRep(pf.rep)} — 購入可能 ${here.length}/${pf.total}`);
    for (const b of here.sort((a, b) => b.price - a.price)) {
      ns.tprint(`  ${b.aug} — ${fmt$(b.price)}`);
    }
  }
  if (blocked.rep.length > 0) ns.tprint(`評価不足: ${blocked.rep.join(", ")}`);
  if (blocked.prereq.length > 0) ns.tprint(`前提不足: ${blocked.prereq.join(", ")}`);
}
