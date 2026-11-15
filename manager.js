/** 定期実行マネージャ v2: deploy → solve → gather を順に回し続ける。
 *  使い方: run manager.js [間隔（分）]   例: run manager.js 10
 *  1周の内訳:
 *    deploy.js --quiet : 新しく届くようになったサーバーへ worker を配備
 *    solve.js  --quiet : 湧いたコーディング契約のうち対応済みの種類を解く
 *    gather.js --quiet : 新しく転がった .lit 等を home に回収
 *  どれも冪等なので、定期実行しても壊れない。同時には走らせず、
 *  前のスクリプトが終わってから次を起動する（home の RAM 32GB に収めるため）。
 *  各スクリプトの報告はそれぞれのログに出る。manager は1周ごとに
 *  終了の1行だけをターミナルへ出す。
 *  止め方: ターミナルで kill manager.js
 *  @param {NS} ns */
export async function main(ns) {
  const intervalMin = Number(ns.args[0]) || 10;
  ns.disableLog("sleep");
  ns.disableLog("exec");
  ns.disableLog("isRunning");

  async function runAndWait(file) {
    const pid = ns.exec(file, "home", 1, "--quiet");
    if (pid === 0) {
      ns.tprint(`manager: ${file} を起動できなかった（home の RAM 不足？）。この周は飛ばす`);
      return;
    }
    while (ns.isRunning(pid, "home")) {
      await ns.sleep(5000);
    }
  }

  ns.tprint(`manager v2: deploy → solve → gather を ${intervalMin} 分間隔で巡回します`);
  while (true) {
    const started = Date.now();
    await runAndWait("deploy.js");
    await runAndWait("solve.js");
    await runAndWait("gather.js");
    const secs = Math.round((Date.now() - started) / 1000);
    ns.tprint(`manager: 巡回1周が終わった（${secs} 秒）。詳細は各スクリプトのログへ`);
    await ns.sleep(intervalMin * 60 * 1000);
  }
}
