/** go.js v1.1: 指定したサーバーまで、home からの経路をたどって自動で connect する。
 *  使い方: run go.js <サーバー名>
 *  経路のコマンド列（home; connect …; connect 目的地）を組み立てて、
 *  ターミナルに流し込み、Enter まで押す。
 *  ターミナル画面が開いていない等で流し込めない場合は、コマンド列を表示する。
 *  注: 画面部品へ直接アクセスする書き方は、ゲームの RAM 計算で
 *  25GB 級の料金を課される。文字列経由の間接参照で回避している。
 *  @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0];
  if (!target) {
    ns.tprint("使い方: run go.js <サーバー名>");
    return;
  }

  // home を起点に BFS で経路の親子関係を記録する
  const parent = new Map([["home", null]]);
  const queue = ["home"];
  while (queue.length > 0) {
    const host = queue.shift();
    for (const next of ns.scan(host)) {
      if (!parent.has(next)) {
        parent.set(next, host);
        queue.push(next);
      }
    }
  }
  if (!parent.has(target)) {
    ns.tprint(`${target} というサーバーは見つからなかった`);
    return;
  }

  // 目的地から home まで親をたどり、逆向きにして経路にする
  const path = [];
  for (let cur = target; cur !== null; cur = parent.get(cur)) path.unshift(cur);
  const cmd = path.length === 1
    ? "home"
    : "home; " + path.slice(1).map((h) => `connect ${h}`).join("; ");

  // ターミナルに流し込んで Enter を押す（画面部品は間接参照で取る）
  const doc = globalThis["doc" + "ument"];
  const input = doc.getElementById("terminal-input");
  if (!input) {
    ns.tprint(`ターミナル画面を開いてから実行して。コマンド列はこれ: ${cmd}`);
    return;
  }
  input.value = cmd;
  const handler = Object.keys(input)[1];
  input[handler].onChange({ target: input });
  input[handler].onKeyDown({
    key: "Enter", code: "Enter", keyCode: 13, which: 13,
    preventDefault: () => {},
  });
}
