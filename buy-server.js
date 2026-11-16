/** クラウドサーバー購入 v2: 手動購入と、manager から呼ばれる自動増設。
 *  手動: run buy-server.js [GB]   例: run buy-server.js 256
 *    GB は 2 の累乗（8 〜 1048576）。省略すると 256。名前は cloud-<GB>、
 *    同名があれば -2、-3 とずらす（上限は ns.cloud.getServerLimit()）。
 *  自動: run buy-server.js --auto [--reserve <百万$>] [--max <GB>]
 *    1回の実行で最大1件だけ買う/増やす。判断はすべて実価格ベース:
 *      余剰 = 所持金 − リザーブ（既定 $300m。SQLInject 等の予定支出を守る）
 *      候補A: 新規購入。今の最大サイズ以上の大きさで、余剰で買える最大の物
 *      候補B: 一番小さいサーバーのアップグレード（差額だけ払い、上の
 *             スクリプトは止まらない）。上限サイズ（既定 8192GB）まで
 *      増える GB が大きい方を選ぶ。同点なら枠を空けるアップグレード優先。
 *      どちらも余剰で届かなければ何もしない（貯まるのを待つ）。
 *    値段は ns.cloud.getServerCost / getServerUpgradeCost で毎回聞く。
 *    式を移植しないので、バージョン差でズレない（F-043 の教訓）。
 *    購入・増設した時だけ tprint する。何もしなかった時はログのみ。
 *  @param {NS} ns */
export async function main(ns) {
  const args = ns.args.map(String);
  if (args.includes("--auto")) return auto(ns, args);
  return manual(ns);
}

function manual(ns) {
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
  if (owned.length >= ns.cloud.getServerLimit()) {
    ns.tprint(`buy-server: クラウドサーバーは上限の${ns.cloud.getServerLimit()}台に達している`);
    return;
  }
  const name = freeName(owned, gb);
  const result = ns.cloud.purchaseServer(name, gb);
  if (result) {
    ns.tprint(`buy-server: ${result} を購入した。deploy を回せば worker が配備される`);
  } else {
    ns.tprint("buy-server: 購入に失敗した（お金か上限を確認して）");
  }
}

function freeName(owned, gb) {
  let name = `cloud-${gb}`;
  for (let i = 2; owned.includes(name); i++) name = `cloud-${gb}-${i}`;
  return name;
}

function argValue(args, flag, fallback) {
  const i = args.indexOf(flag);
  if (i < 0 || i + 1 >= args.length) return fallback;
  const v = Number(args[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function auto(ns, args) {
  const reserve = argValue(args, "--reserve", 300) * 1e6;
  const maxGB = argValue(args, "--max", 8192);
  const money = ns.getPlayer().money;
  const surplus = money - reserve;
  if (surplus <= 0) {
    ns.print(`buy-server(auto): 余剰なし（所持金 $${Math.floor(money).toLocaleString()} / リザーブ $${reserve.toLocaleString()}）`);
    return;
  }
  const owned = ns.cloud.getServerNames();
  const servers = owned
    .map((name) => ({ name, ram: ns.getServerMaxRam(name) }))
    .sort((a, b) => a.ram - b.ram);
  const biggest = servers.length ? servers[servers.length - 1].ram : 256;
  const limit = ns.cloud.getServerLimit();

  // 候補A: 新規購入（今の最大以上、余剰で買える最大サイズ）
  let buy = null;
  if (servers.length < limit) {
    for (let s = biggest; s <= maxGB; s *= 2) {
      const cost = ns.cloud.getServerCost(s);
      if (cost <= surplus) buy = { size: s, cost, gain: s };
    }
  }
  // 候補B: 最小サーバーのアップグレード（差額払い）
  let up = null;
  if (servers.length) {
    const smallest = servers[0];
    for (let s = smallest.ram * 2; s <= maxGB; s *= 2) {
      const cost = ns.cloud.getServerUpgradeCost(smallest.name, s);
      if (cost > 0 && cost <= surplus) {
        up = { host: smallest.name, from: smallest.ram, size: s, cost, gain: s - smallest.ram };
      }
    }
  }

  if (!buy && !up) {
    ns.print(`buy-server(auto): 余剰 $${Math.floor(surplus).toLocaleString()} では届く増設がない`);
    return;
  }
  // 増える GB が大きい方。同点はアップグレード優先（枠を空ける）
  if (up && (!buy || up.gain >= buy.gain)) {
    if (ns.cloud.upgradeServer(up.host, up.size)) {
      ns.tprint(`buy-server(auto): ${up.host} を ${up.from}GB → ${up.size}GB に増設（$${up.cost.toLocaleString()}、残り $${Math.floor(money - up.cost).toLocaleString()}）`);
    } else {
      ns.tprint(`buy-server(auto): ${up.host} の増設に失敗した`);
    }
    return;
  }
  const name = freeName(owned, buy.size);
  const result = ns.cloud.purchaseServer(name, buy.size);
  if (result) {
    ns.tprint(`buy-server(auto): ${result}（${buy.size}GB）を購入（$${buy.cost.toLocaleString()}、残り $${Math.floor(money - buy.cost).toLocaleString()}）`);
  } else {
    ns.tprint("buy-server(auto): 購入に失敗した");
  }
}
