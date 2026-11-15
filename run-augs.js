/** augs.js のランチャー v1.1: 空き RAM が最大のクラウドサーバーへ
 *  augs.js を転送して実行し、終わるまで待つ。
 *  v1.1: worker がサーバーを埋めていて起動できない問題への対応。
 *    空きが足りない場合は最大サーバーの worker を止めてから実行する
 *    （止めた worker は次回の deploy で再配備される）。
 *  使い方: run run-augs.js
 *  @param {NS} ns */
export async function main(ns) {
  const NEED = 400; // augs.js の必要量（計算値 338GB）＋余裕
  if (!ns.fileExists("augs.js", "home")) {
    ns.tprint("run-augs: home に augs.js がありません。先に wget してください");
    return;
  }
  let best = null;
  let bestFree = -1;
  let bestMax = 0;
  for (const host of ns.cloud.getServerNames()) {
    const free = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    if (free > bestFree) {
      bestFree = free;
      best = host;
    }
    if (ns.getServerMaxRam(host) > bestMax) bestMax = ns.getServerMaxRam(host);
  }
  if (!best) {
    ns.tprint("run-augs: クラウドサーバーがありません");
    return;
  }
  if (bestFree < NEED) {
    // 空きが足りない: 最大サーバーの worker を止めて場所を空ける
    let biggest = null;
    for (const host of ns.cloud.getServerNames()) {
      if (ns.getServerMaxRam(host) === bestMax) biggest = host;
    }
    ns.tprint(`run-augs: 空き RAM が足りないため、${biggest} の worker を止めて augs.js を実行します（次回 deploy で再配備されます）`);
    ns.killall(biggest);
    best = biggest;
    await ns.sleep(1000);
  }
  const ok = await ns.scp("augs.js", best, "home");
  if (!ok) {
    ns.tprint(`run-augs: augs.js の転送に失敗しました（転送先: ${best}）`);
    return;
  }
  const pid = ns.exec("augs.js", best, 1);
  if (pid === 0) {
    ns.tprint("run-augs: augs.js の起動に失敗しました");
    return;
  }
  while (ns.isRunning(pid, best)) {
    await ns.sleep(2000);
  }
}
