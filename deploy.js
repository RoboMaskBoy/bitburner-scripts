/** 司令塔 v3.1: ネットワーク全体を走査し、root を取って worker を配備する。
 *  使い方: run deploy.js
 *  home から scan をたどって全サーバーを列挙する（深さ制限なし）。
 *  ポート開けプログラム（BruteSSH.exe 等）を home に持っていれば、
 *  NUKE の前に自動でポートを開ける。
 *  worker の配備は、自分の Hacking レベルが足りているサーバーだけに行う。
 *  購入したクラウドサーバーは対象外（置き場所として温存する）。
 *  v3.1: 3.0.0 で削除された getPurchasedServers を cloud.getServerNames に差し替え。
 *  @param {NS} ns */
export async function main(ns) {
  const worker = "hack-worker.js";
  const workerRam = ns.getScriptRam(worker, "home");
  const myLevel = ns.getHackingLevel();
  const purchased = new Set(ns.cloud.getServerNames());

  // home を起点にネットワーク全体を列挙する
  const seen = new Set(["home"]);
  const queue = ["home"];
  const all = [];
  while (queue.length > 0) {
    const host = queue.shift();
    for (const next of ns.scan(host)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
        all.push(next);
      }
    }
  }

  // 持っているポート開けプログラムの一覧
  const openers = [
    ["BruteSSH.exe", (t) => ns.brutessh(t)],
    ["FTPCrack.exe", (t) => ns.ftpcrack(t)],
    ["relaySMTP.exe", (t) => ns.relaysmtp(t)],
    ["HTTPWorm.exe", (t) => ns.httpworm(t)],
    ["SQLInject.exe", (t) => ns.sqlinject(t)],
  ].filter(([file]) => ns.fileExists(file, "home"));

  let rooted = 0;
  let deployed = 0;
  let totalThreads = 0;

  for (const target of all) {
    if (purchased.has(target)) continue;

    // root がなければ、まず持っているプログラムでポートを開けてから NUKE
    if (!ns.hasRootAccess(target)) {
      for (const [, open] of openers) open(target);
      const ports = ns.getServerNumPortsRequired(target);
      if (openers.length < ports) {
        continue; // ポート不足は静かに見送る（報告は最後の集計のみ）
      }
      ns.nuke(target);
      ns.tprint(`${target}: NUKE 成功、root 取得`);
    }
    if (ns.hasRootAccess(target)) rooted++;

    // レベルが足りないサーバーは root だけ取って、配備はレベルが届いてから
    const required = ns.getServerRequiredHackingLevel(target);
    if (required > myLevel) {
      continue;
    }

    // worker を送り込んで、そのサーバーの RAM いっぱいに起動する
    await ns.scp(worker, target, "home");
    const maxRam = ns.getServerMaxRam(target);
    const threads = Math.floor(maxRam / workerRam);
    if (threads < 1) {
      continue; // RAM 0 のサーバーは root のみ（backdoor の踏み台にはなる）
    }
    ns.killall(target);
    ns.exec(worker, target, threads, target);
    deployed++;
    totalThreads += threads;
    ns.tprint(`${target}: worker を ${threads} スレッドで配備`);
  }
  ns.tprint(`配備おわり: 走査 ${all.length} 台 / root ${rooted} 台 / worker 配備 ${deployed} 台・${totalThreads} スレッド`);
}
