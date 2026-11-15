/** 経験値専用 worker: 標的のお金は無視して hack を繰り返す。
 *  警戒度が最低値 + 5 を超えたら weaken で戻す。grow はしない。
 *  経験値は hack の成否だけで入り、所持金とは無関係なため、
 *  お金狙いの worker より経験値の回転が速い（deploy --exp が配備する）。
 *  使い方: run exp-worker.js [標的]
 *  @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0];
  while (true) {
    if (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target) + 5) {
      await ns.weaken(target);
    } else {
      await ns.hack(target);
    }
  }
}
