/** augs.js のランチャー: 最大 RAM のクラウドサーバーへ augs.js を転送し、
 *  向こうで実行して終わるまで待つ。augs.js 本体は 338GB 必要なため、
 *  home からはこの軽いランチャー（約5GB）経由で起動する。
 *  使い方: run run-augs.js
 *  @param {NS} ns */
export async function main(ns) {
  let best = null;
  let bestRam = 0;
  for (const host of ns.cloud.getServerNames()) {
    const ram = ns.getServerMaxRam(host);
    if (ram > bestRam) {
      bestRam = ram;
      best = host;
    }
  }
  if (!best || bestRam < 340) {
    ns.tprint("run-augs: 340GB 以上のクラウドサーバーが見つかりませんでした");
    return;
  }
  await ns.scp("augs.js", best, "home");
  const pid = ns.exec("augs.js", best, 1);
  if (pid === 0) {
    ns.tprint("run-augs: augs.js の起動に失敗しました");
    return;
  }
  while (ns.isRunning(pid, best)) {
    await ns.sleep(2000);
  }
}
