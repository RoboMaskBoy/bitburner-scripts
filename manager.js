/** 定期実行マネージャ: deploy.js を一定間隔で回し続ける。
 *  使い方: run manager.js [間隔（分）]   例: run manager.js 10
 *  deploy.js は冪等（何回回しても結果は同じ）なので、定期実行しても壊れない。
 *  報告は deploy 側のログに出る（--quiet で起動するため、画面には出ない）。
 *  止め方: ターミナルで kill manager.js
 *  @param {NS} ns */
export async function main(ns) {
  const intervalMin = Number(ns.args[0]) || 10;
  ns.tprint(`manager: deploy.js を ${intervalMin} 分ごとに定期実行します`);
  while (true) {
    const pid = ns.exec("deploy.js", "home", 1, "--quiet");
    if (pid === 0) {
      ns.tprint("manager: deploy.js を起動できなかった（home の RAM 不足？）。次の周期で再試行します");
    } else {
      while (ns.isRunning(pid, "home")) {
        await ns.sleep(5000);
      }
    }
    await ns.sleep(intervalMin * 60 * 1000);
  }
}
