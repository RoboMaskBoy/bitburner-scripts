/** 収集屋 v1.1: ネットワーク全体を歩き、.js 以外のファイル（.lit の読み物、
 *  .txt、.msg など）を home にかき集める。
 *  使い方: run gather.js
 *  .exe は仕様上コピーできないので対象外。.script はコードなので対象外。
 *  .cct（コーディング契約）は scp では運べない仕様なので、回収せず
 *  「どこにあるか」だけ報告する（その場で挑戦する物）。
 *  home に同名ファイルが既にある場合は飛ばす（冪等）。
 *  @param {NS} ns */
export async function main(ns) {
  const skipHosts = new Set(["home", "darkweb"]);

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

  let gathered = 0;
  let contracts = 0;
  for (const host of all) {
    if (skipHosts.has(host)) continue;
    for (const file of ns.ls(host)) {
      if (file.endsWith(".js") || file.endsWith(".script") || file.endsWith(".exe")) continue;
      if (file.endsWith(".cct")) {
        contracts++;
        ns.tprint(`${host}: ${file} を発見（契約は運べないので、その場で挑戦する物）`);
        continue;
      }
      if (ns.fileExists(file, "home")) continue;
      if (await ns.scp(file, "home", host)) {
        gathered++;
        ns.tprint(`${host}: ${file} を回収`);
      }
    }
  }
  ns.tprint(`回収おわり: ${gathered} 件を home に集めた / 契約 ${contracts} 件を発見`);
}
