/** 司令塔: home の隣接サーバーを走査し、root を取って worker を配備する。
 *  使い方: run deploy.js
 *  ポート開けプログラムを持っていない序盤は、ポート0のサーバーだけ root を取る。
 *  worker の配備は、自分の Hacking レベルが足りているサーバーだけに行う。
 *  @param {NS} ns */
export async function main(ns) {
  const worker = "hack-worker.js";
  const workerRam = ns.getScriptRam(worker, "home");
  const myLevel = ns.getHackingLevel();
  const neighbors = ns.scan("home");

  for (const target of neighbors) {
    // root がなければ NUKE を試みる（ポート不足なら次の機会に回す）
    if (!ns.hasRootAccess(target)) {
      const ports = ns.getServerNumPortsRequired(target);
      if (ports > 0) {
        ns.tprint(`${target}: ポートが ${ports} 個必要。今は見送り`);
        continue;
      }
      ns.nuke(target);
      ns.tprint(`${target}: NUKE 成功、root 取得`);
    }

    // レベルが足りないサーバーは root だけ取って、配備はレベルが届いてから
    const required = ns.getServerRequiredHackingLevel(target);
    if (required > myLevel) {
      ns.tprint(`${target}: 要レベル ${required}（今は ${myLevel}）。配備は見送り`);
      continue;
    }

    // worker を送り込んで、そのサーバーの RAM いっぱいに起動する
    await ns.scp(worker, target, "home");
    const maxRam = ns.getServerMaxRam(target);
    const threads = Math.floor(maxRam / workerRam);
    ns.killall(target);
    if (threads < 1) {
      ns.tprint(`${target}: RAM ${maxRam}GB では worker を動かせない`);
      continue;
    }
    ns.exec(worker, target, threads, target);
    ns.tprint(`${target}: worker を ${threads} スレッドで配備`);
  }
  ns.tprint("配備おわり");
}
