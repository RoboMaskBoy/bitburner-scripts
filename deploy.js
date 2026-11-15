/** 司令塔 v4.2: ネットワーク全体を走査し、root を取って worker を配備する。
 *  使い方: run deploy.js [--quiet] [--exp]
 *  home から scan をたどって全サーバーを列挙する（深さ制限なし）。
 *  ポート開けプログラム（BruteSSH.exe 等）を home に持っていれば、
 *  NUKE の前に自動でポートを開ける。
 *  worker の配備は、自分の Hacking レベルが足りているサーバーだけに行う。
 *  --quiet を付けると報告はログ行き（manager.js からの定期実行用）。
 *  --exp を付けると経験値モード: 標的を経験値効率（1スレッド秒あたりの
 *    経験値）で選び、経験値専用 worker（お金を無視して hack を繰り返す）を
 *    配備する。お金はほぼ増えない代わりに、レベル上げが最速になる。
 *  v4.1: 標的のスコアを本式ベースの定常モデルに差し替えた（検証 2026-11-16）。
 *    本体の式（src/Hacking.ts）を移植し、実機のライブ値で
 *    「整地済みの標的を盗んで戻す1サイクルの稼ぎ ÷ スレッド秒」を計算する。
 *    旧式（最大所持金 ÷ 最低警戒度）は必要レベルを見ないため、高レベル帯で
 *    大金持ちの高レベルサーバーを過大評価する（試算で約3割の損）。
 *    あわせて、root 取得 → 標的選定 → 配備の順に直し、その場で root が
 *    取れたサーバーも同じ回の候補に入るようにした。
 *  v4: 全 worker の標的を「一番金持ちのサーバー」1つに統一した。
 *  v3.4: worker が同じスレッド数・同じ標的で稼働中なら配備し直さない。
 *  v3.2: cloud.getServerNames（RAM 1.05GB）を外し、home の RAM に収まるようにした。
 *    クラウドサーバーを買ったら、その名前を下の EXCLUDE に足すこと（0GB 方式）。
 *  @param {NS} ns */
export async function main(ns) {
  const quiet = ns.args.includes("--quiet");
  const expMode = ns.args.includes("--exp");
  const say = (msg) => (quiet ? ns.print(msg) : ns.tprint(msg));
  const worker = expMode ? "exp-worker.js" : "hack-worker.js";
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

  // 第1パス: root 取得
  let rooted = 0;
  for (const target of all) {
    if (purchased.has(target)) continue;
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
  }

  // 第2パス: 標的の選定（本式ベースの定常モデル、ライブ値で計算）
  const player = ns.getPlayer();
  let bestTarget = null;
  let bestInfo = null;
  for (const host of all) {
    if (purchased.has(host)) continue;
    if (!ns.hasRootAccess(host)) continue;
    if (ns.getServerRequiredHackingLevel(host) > myLevel) continue;
    if (!expMode && ns.getServerMaxMoney(host) <= 0) continue;
    const info = targetScore(ns, host, player);
    const score = expMode ? info.expScore : info.score;
    if (score > 0 && (bestInfo === null || score > (expMode ? bestInfo.expScore : bestInfo.score))) {
      bestInfo = info;
      bestTarget = host;
    }
  }
  if (bestTarget && expMode) {
    say(
      `標的（経験値モード）: ${bestTarget}（経験値 ${bestInfo.expPer.toFixed(1)}/回 / 成功率 ${Math.round(bestInfo.chance * 100)}% / hack ${bestInfo.t.toFixed(0)}秒）に全火力を集中する`,
    );
  } else if (bestTarget) {
    say(
      `標的: ${bestTarget}（最大所持金 $${(ns.getServerMaxMoney(bestTarget) / 1e6).toFixed(2)}m / 成功率 ${Math.round(bestInfo.chance * 100)}% / hack ${bestInfo.t.toFixed(0)}秒）に全火力を集中する`,
    );
  }

  // 第3パス: worker の配備（叩く相手は全員共通の標的）
  let deployed = 0;
  let totalThreads = 0;
  for (const target of all) {
    if (purchased.has(target)) continue;
    if (!ns.hasRootAccess(target)) continue;

    // レベルが足りないサーバーは root だけ取って、配備はレベルが届いてから
    if (ns.getServerRequiredHackingLevel(target) > myLevel) {
      continue;
    }

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

/** 標的の稼ぎ速度を本体の式で見積もる。
 *  整地済み（警戒度 = 最低値）の標的について、所持金を半分盗んで満タンに
 *  戻す1サイクルを考え、成功率込みの稼ぎをスレッド秒で割る。
 *  式は src/Hacking.ts（成功率・盗める割合・所要時間）と
 *  src/Server/formulas/grow.ts（成長率）の移植。倍率は実機の値を使う。 */
function targetScore(ns, host, player) {
  const H = player.skills.hacking;
  const srv = ns.getServer(host);
  const M = srv.moneyMax;
  const req = srv.requiredHackingSkill;
  const D = srv.minDifficulty;
  const growth = srv.serverGrowth;
  const expPer = (3 + srv.baseDifficulty * 0.3) * player.mults.hacking_exp;
  const intBonus = 1 + Math.pow(player.skills.intelligence, 0.8) / 600;

  const t = (5 * (2.5 * req * D + 500)) / (H + 50) / (player.mults.hacking_speed * intBonus);
  let chance = ((1.75 * H - req) / (1.75 * H)) * ((100 - D) / 100) * player.mults.hacking_chance * intBonus;
  chance = Math.min(1, Math.max(0, chance));
  let f = (((100 - D) / 100) * (H - (req - 1))) / H / 240 * player.mults.hacking_money;
  f = Math.min(1, Math.max(0, f));
  // 経験値モードのスコア: hack を繰り返し、警戒度の相殺に weaken を
  // 0.04 本（0.002 ÷ 0.05）挟む形で、1スレッド秒あたりの経験値を出す
  const expScore = chance > 0 ? (expPer * chance) / (1.16 * t) : 0;
  if (chance <= 0 || f <= 0) return { score: 0, expScore, expPer, chance, t };

  const glog =
    Math.min(Math.log1p(0.03 / D), 0.00349388925425578) * (growth / 100) * player.mults.hacking_grow;
  if (glog <= 0) return { score: 0, expScore, expPer, chance, t };
  const Nh = Math.log(0.5) / Math.log(1 - f); // 所持金を半分盗む hack スレッド数
  const Ng = Math.log(2) / glog; // 倍に戻す grow スレッド数
  const Nw = (0.002 * Nh + 0.004 * Ng) / 0.05; // 警戒度の上昇を相殺する weaken スレッド数
  const threadSeconds = t * (Nh + 3.2 * Ng + 4 * Nw);
  const score = (chance * 0.5 * 0.85 * M) / threadSeconds;
  return { score, expScore, expPer, chance, t };
}
