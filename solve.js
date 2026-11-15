/** solve.js v1.2: ネットワーク全体を巡回し、コーディング契約をその場で解く。
 *  契約ファイルは移動できないが、専用 API はサーバー名を指定して
 *  種類・データを読み、解答を提出できる。だから巡回型にする。
 *  使い方: run solve.js [--quiet]（RAM 約22GB が必要）
 *  対応済みの種類だけ挑戦し、未対応の種類は場所と名前だけ報告する
 *  （試行回数を無駄にしないため）。
 *  --quiet を付けると報告はログ行き（manager.js からの定期実行用）。
 *  @param {NS} ns */

// 分割数: n を正の整数の和で書く方法の数（2項以上）。DP で数える。
function totalWaysToSum(n) {
  const dp = new Array(n + 1).fill(0);
  dp[0] = 1;
  for (let k = 1; k <= n; k++) {
    for (let s = k; s <= n; s++) dp[s] += dp[s - k];
  }
  return dp[n] - 1;
}

// 最大の素因数: 小さい数から試し割りし、残った数が答え。
function largestPrimeFactor(n) {
  let m = n;
  let largest = 1;
  for (let p = 2; p * p <= m; p += p === 2 ? 1 : 2) {
    while (m % p === 0) {
      largest = p;
      m = m / p;
    }
  }
  return m > 1 ? m : largest;
}

// 最大部分配列和: 走りながら合計を持ち、マイナスになったら切り直す。
function maxSubarraySum(a) {
  let best = a[0];
  let cur = a[0];
  for (let i = 1; i < a.length; i++) {
    cur = cur < 0 ? a[i] : cur + a[i];
    if (cur > best) best = cur;
  }
  return best;
}

// 株取引 I: 最安値を覚え、その日に売った場合の儲けの最大を取る。
function stockTraderI(prices) {
  let min = prices[0];
  let best = 0;
  for (const p of prices) {
    if (p < min) min = p;
    if (p - min > best) best = p - min;
  }
  return best;
}

// 暗号化 I: カエサル暗号。data = [平文, 左シフト量]。
// 各文字をアルファベット上で左へずらす（A は Z 側へ回る）。空白はそのまま。
function caesarCipher(data) {
  const [text, shift] = data;
  let out = "";
  for (const ch of text) {
    if (ch === " ") {
      out += " ";
    } else {
      const code = ((ch.charCodeAt(0) - 65 - shift) % 26 + 26) % 26;
      out += String.fromCharCode(65 + code);
    }
  }
  return out;
}

const SOLVERS = {
  "Total Ways to Sum": totalWaysToSum,
  "Find Largest Prime Factor": largestPrimeFactor,
  "Subarray with Maximum Sum": maxSubarraySum,
  "Algorithmic Stock Trader I": stockTraderI,
  "Encryption I: Caesar Cipher": caesarCipher,
};

export async function main(ns) {
  const quiet = ns.args.includes("--quiet");
  const say = (msg) => (quiet ? ns.print(msg) : ns.tprint(msg));
  const start = ns.getHostname();
  const seen = new Set([start]);
  const queue = [start];
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

  let solved = 0;
  let unknown = 0;
  for (const host of all) {
    for (const file of ns.ls(host, ".cct")) {
      const type = ns.codingcontract.getContractType(file, host);
      const solver = SOLVERS[type];
      if (!solver) {
        unknown++;
        say(`未対応: ${type} @ ${host} (${file})`);
        continue;
      }
      const data = ns.codingcontract.getData(file, host);
      const answer = solver(data);
      const reward = ns.codingcontract.attempt(answer, file, host);
      if (reward) {
        solved++;
        say(`解決: ${type} @ ${host} → ${reward}`);
      } else {
        say(`失敗: ${type} @ ${host} (答え ${answer} で提出したが弾かれた)`);
      }
    }
  }
  say(`巡回おわり: 解決 ${solved} 件 / 未対応 ${unknown} 件`);
}
