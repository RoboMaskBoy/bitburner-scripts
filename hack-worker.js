/** 標的を引数で受け取る worker。first-hack.js の汎用版。
 *  使い方: run hack-worker.js foodnstuff
 *  @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0];
  if (!target) {
    ns.tprint("ERROR: 標的サーバー名を引数で指定してください (例: run hack-worker.js n00dles)");
    return;
  }
  while (true) {
    if (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target) + 5) {
      await ns.weaken(target);
    } else if (ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target) * 0.75) {
      await ns.grow(target);
    } else {
      await ns.hack(target);
    }
  }
}
