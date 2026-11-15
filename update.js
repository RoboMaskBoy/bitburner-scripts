/** update.js: 道具箱の全スクリプトを GitHub の main から取り直す。
 *  使い方: run update.js （home で実行）
 *  取り直した solve.js は、置き場所の avmnite-02h へも送る。
 *  注: main の URL は固定だが、push 直後は配布側のキャッシュで
 *  数分古い物が来ることがある。今すぐ確実に欲しい時はコミット固定 URL で。
 *  @param {NS} ns */
const BASE = "https://raw.githubusercontent.com/RoboMaskBoy/bitburner-scripts/main/";
const FILES = [
  "deploy.js", "manager.js", "gather.js", "go.js",
  "solve.js", "hack-worker.js", "first-hack.js", "update.js",
  "crime-guide.js", "buy-server.js", "exp-worker.js", "augs.js", "run-augs.js",
];

export async function main(ns) {
  for (const f of FILES) {
    const ok = await ns.wget(BASE + f, f, "home");
    ns.tprint(`${f}: ${ok ? "更新した" : "取れなかった"}`);
  }
  if (await ns.scp("solve.js", "avmnite-02h", "home")) {
    ns.tprint("solve.js を avmnite-02h へ送った");
  }
}
