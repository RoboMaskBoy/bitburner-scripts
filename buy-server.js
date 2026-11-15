/** クラウドサーバー購入 v1: 指定 GB のクラウドサーバーを1台買う。
 *  使い方: run buy-server.js [GB]   例: run buy-server.js 256
 *  GB は 2 の累乗（8 〜 1048576）。省略すると 256。
 *  値段を表示して、所持金が足りる時だけ買う。名前は cloud-<GB>、
 *  同名があれば -2、-3 とずらす（上限25台はゲーム側の制限）。
 *  買ったサーバーには deploy が自動で worker を置く。
 *  @param {NS} ns */
export async function main(ns) {
  const gb = Number(ns.args[0]) || 256;
  if (gb < 8 || (gb & (gb - 1)) !== 0) {
    ns.tprint(`buy-server: GB は 8 以上の 2 の累乗で指定して（指定値: ${ns.args[0]}）`);
    return;
  }
  const cost = ns.cloud.getServerCost(gb);
  const money = ns.getPlayer().money;
  ns.tprint(`buy-server: ${gb}GB のクラウドサーバーは $${cost.toLocaleString()}（所持金 $${Math.floor(money).toLocaleString()}）`);
  if (money < cost) {
    ns.tprint(`buy-server: あと $${Math.ceil(cost - money).toLocaleString()} 足りない`);
    return;
  }
  const owned = ns.cloud.getServerNames();
  if (owned.length >= 25) {
    ns.tprint("buy-server: クラウドサーバーは上限の25台に達している");
    return;
  }
  let name = `cloud-${gb}`;
  for (let i = 2; owned.includes(name); i++) {
    name = `cloud-${gb}-${i}`;
  }
  const result = ns.cloud.purchaseServer(name, gb);
  if (result) {
    ns.tprint(`buy-server: ${result} を購入した。deploy を回せば worker が配備される`);
  } else {
    ns.tprint("buy-server: 購入に失敗した（お金か上限を確認して）");
  }
}
