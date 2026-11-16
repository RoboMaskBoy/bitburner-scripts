/** 定期実行マネージャ v2.3: deploy → solve → gather（→ shop）を順に回し続ける。
 *  使い方: run manager.js [間隔（秒）] [--exp] [--shop] [--reserve <百万$>] [--max <GB>]
 *  間隔を省略すると 600 秒（10分）。末尾に m を付けると分単位（例: 10m）。
 *  --exp を付けると deploy を経験値モードで回す（レベル上げ専用巡回）。
 *  --shop を付けると、1周の最後に buy-server.js --auto を1回呼ぶ
 *  （リザーブ超えの余剰でクラウドサーバーを購入/増設。既定はオフ）。
 *  --reserve / --max は shop の判断にそのまま渡る（既定 300 / 8192）。
 *  v2.3: shop 工程（buy-server.js --auto）を追加。
 *  v2.2: deploy への --exp 引き継ぎに対応。
 *  v2.1: 間隔を秒単位で指定できるようにした（v2 までは分単位）。
 *  どれも冪等なので、定期実行しても壊れない。同時には走らせず、
 *  前のスクリプトが終わってから次を起動する（home の RAM に収めるため）。
 *  各スクリプトの報告はそれぞれのログに出る。manager は1周ごとに
 *  終了の1行だけをターミナルへ出す。
 *  止め方: 引数が違うと kill manager.js では止まらない。ps で PID を
 *  見て kill <PID> する。
 *  @param {NS} ns */
export async function main(ns) {
  const strArgs = ns.args.map(String);
  const expMode = strArgs.includes("--exp");
  const shopMode = strArgs.includes("--shop");
  const rawArg = strArgs.find((a) => /^\d+m?$/.test(a)) || "600";
  const intervalSec = rawArg.endsWith("m")
    ? Number(rawArg.slice(0, -1)) * 60
    : Number(rawArg) || 600;
  const shopArgs = ["--auto"];
  for (const flag of ["--reserve", "--max"]) {
    const i = strArgs.indexOf(flag);
    if (i >= 0 && i + 1 < strArgs.length) shopArgs.push(flag, strArgs[i + 1]);
  }
  ns.disableLog("sleep");
  ns.disableLog("exec");
  ns.disableLog("isRunning");

  async function runAndWait(file, extraArgs = []) {
    const pid = ns.exec(file, "home", 1, "--quiet", ...extraArgs);
    if (pid === 0) {
      ns.tprint(`manager: ${file} を起動できなかった（home の RAM 不足？）。この周は飛ばす`);
      return;
    }
    while (ns.isRunning(pid, "home")) {
      await ns.sleep(5000);
    }
  }

  ns.tprint(`manager v2.3: deploy → solve → gather${shopMode ? " → shop" : ""} を ${intervalSec} 秒間隔で巡回します${expMode ? "（deploy は経験値モード）" : ""}`);
  while (true) {
    const started = Date.now();
    await runAndWait("deploy.js", expMode ? ["--exp"] : []);
    await runAndWait("solve.js");
    await runAndWait("gather.js");
    if (shopMode) await runAndWait("buy-server.js", shopArgs);
    const secs = Math.round((Date.now() - started) / 1000);
    ns.tprint(`manager: 巡回1周が終わった（${secs} 秒）。詳細は各スクリプトのログへ`);
    await ns.sleep(intervalSec * 1000);
  }
}
