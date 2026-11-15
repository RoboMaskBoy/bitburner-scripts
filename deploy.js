/** 司令塔 v4: ネットワーク全体を走査し、root を取って worker を配備する。
 *  使い方: run deploy.js [--quiet]
 *  home から scan をたどって全サーバーを列挙する（深さ制限なし）。
 *  ポート開けプログラム（BruteSSH.exe 等）を home に持っていれば、
 *  NUKE の前に自動でポートを開ける。
 *  worker の配備は、自分の Hacking レベルが足りているサーバーだけに行う。
 *  --quiet を付けると報告はログ行き（manager.js からの定期実行用）。
 *  v4: 全 worker の標的を「一番金持ちのサーバー」1つに統一した。
 *    各 worker が自分のいる貧弱なサーバーを叩く形では稼ぎが頭打ちになるため。
 *    標的の選定は、root 済み・レベル到達済み・所持金のあるサーバーの中から
 *    「最大所持金 ÷ 最低警戒度」が最大の物（金が多く、回転が速い所）。
 *  v3.4: worker が同じスレッド数・同じ標的で稼働中なら配備し直さない。
 *  v3.2: cloud.getServerNames（RAM 1.05GB）を外し、home の RAM に収まるようにした。
 *    クラウドサーバーを買ったら、その名前を下の EXCLUDE に足すこと（0GB 方式）。
 *  v3.1: 3.0.0 で削除された getPurchasedServers を cloud.getServerNames に差し替え。
 *  @param {NS} ns */
export async function main(ns) {
  const quiet = ns.args.includes("--quiet");
  const say = (msg) => (quiet ? ns.print(msg) : ns.tprint(msg));
  const worker = "hack-worker.js";
  const workerRam = ns.getScriptRam(worker, "home");
  const myLevel = ns.getHackingLevel();
  const purchased = new Set([]); // クラウドサーバーを買ったら名前をここに足す

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

  // 標的の選定: root 済み・レベル到達済み・所持金のあるサーバーの中から
  // 「最大所持金 ÷ 最低警戒度」が最大の物を、全 worker 共通の標的にする
  let bestTarget = null;
  let bestScore = -1;
  for (const host of all) {
    if (purchased.has(host)) continue;
    if (!ns.hasRootAccess(host)) continue;
    if (ns.getServerRequiredHackingLevel(host) > myLevel) continue;
    const maxMoney = ns.getServerMaxMoney(host);
    if (maxMoney <= 0) continue;
    const score = maxMoney / ns.getServerMinSecurityLevel(host);
    if (score > bestScore) {
      bestScore = score;
      bestTarget = host;
    }
  }
  if (bestTarget) {
    say(`標的: ${bestTarget}（最大所持金 $${(ns.getServerMaxMoney(bestTarget) / 1e6).toFixed(2)}m）に全火力を集中する`);
  }

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
      say(`${target}: NUKE 成功、root 取得`);
    }
    if (ns.hasRootAccess(target)) rooted++;

    // レベルが足りないサーバーは root だけ取って、配備はレベルが届いてから
    const required = ns.getServerRequiredHackingLevel(target);
    if (required > myLevel) {
      continue;
    }

    // worker を送り込んで、そのサーバーの RAM いっぱいに起動する。
    // 叩く相手はそのサーバー自身ではなく、全員共通の標的（bestTarget）。
    await ns.scp(worker, target, "home");
    const maxRam = ns.getServerMaxRam(target);
    const threads = Math.floor(maxRam / workerRam);
    if (threads < 1 || !bestTarget) {
      continue; // RAM 0 のサーバーは root のみ（backdoor の踏み台にはなる）
    }
    // 同じスレッド数・同じ標的で稼働中なら、そのまま使う（落として組み直さない）
    const running = ns.ps(target).filter((p) => p.filename === worker);
    const runningThreads = running.reduce((sum, p) => sum + p.threads, 0);
    if (runningThreads === threads && running.length > 0 && running[0].args[0] === bestTarget) {
      deployed++;
      totalThreads += threads;
      continue;
    }
    ns.killall(target);
    ns.exec(worker, target, threads, bestTarget);
    deployed++;
    totalThreads += threads;
    say(`${target}: worker を ${threads} スレッドで配備`);
  }
  say(`配備おわり: 走査 ${all.length} 台 / root ${rooted} 台 / worker 配備 ${deployed} 台・${totalThreads} スレッド`);
}
