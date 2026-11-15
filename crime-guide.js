/** 犯罪レコメンド v1.1: 今のステータスから全犯罪の成功率を自前で計算し、
 *  期待値（成功率 × 報酬 ÷ 所要時間）順に並べて推奨を出す。
 *  使い方: run crime-guide.js
 *
 *  成功率の式はゲーム本体（src/Crime/Crime.ts の successRate）そのまま:
 *    chance = (Σ 重み×ステータス + 0.025×知力) / 975 / 難易度
 *             × 犯罪成功倍率 × (1 + 知力^0.8 / 600)、上限 100%
 *  犯罪データも本体 src/Crime/Crimes.ts の実測値。
 *  v1.1 訂正: v1 は Crime の引数順（時間・金額・難易度・カルマ）を読み違え、
 *    金額と時間、難易度とカルマを取り違えていた。実機の表示（2026-11-15、
 *    Hacking 144 / 器用 30 / 素早 30）と全12種が一致することを確認済み。
 *  前提: BitNode 1 の倍率 1。お金の期待値は成功時のみ（失敗時は経験値だけ入る）。
 *  @param {NS} ns */

// [英語名（画面表示）, 日本語, 報酬$, 時間(秒), カルマ減（成功時）, 難易度, 重み]
const CRIMES = [
  ["Shoplift", "窃盗", 15000, 2, 0.1, 0.05, { dex: 1, agi: 1 }],
  ["Rob Store", "店への強盗", 400000, 60, 0.5, 0.2, { hack: 0.5, dex: 2, agi: 1 }],
  ["Mug", "追いはぎ", 36000, 4, 0.25, 0.2, { str: 1.5, def: 0.5, dex: 1.5, agi: 0.5 }],
  ["Larceny", "窃盗（大口）", 800000, 90, 1.5, 1 / 3, { hack: 0.5, dex: 1, agi: 1 }],
  ["Deal Drugs", "麻薬の売買", 120000, 10, 0.5, 1, { cha: 3, dex: 2, agi: 1 }],
  ["Bond Forgery", "債券偽造", 4500000, 300, 0.1, 0.5, { hack: 0.05, dex: 1.25 }],
  ["Traffick Arms", "武器の密売", 600000, 40, 1, 2, { cha: 1, str: 1, def: 1, dex: 1, agi: 1 }],
  ["Homicide", "殺人", 45000, 3, 3, 1, { str: 2, def: 2, dex: 0.5, agi: 0.5 }],
  ["Grand Theft Auto", "車両窃盗", 1600000, 80, 5, 8, { hack: 1, str: 1, dex: 4, agi: 2, cha: 2 }],
  ["Kidnap", "誘拐・身代金", 3600000, 120, 6, 5, { cha: 1, str: 1, dex: 1, agi: 1 }],
  ["Assassination", "暗殺", 12000000, 300, 10, 8, { str: 1, dex: 2, agi: 1 }],
  ["Heist", "大強盗", 120000000, 600, 15, 18, { hack: 1, str: 1, def: 1, dex: 1, agi: 1, cha: 1 }],
];

export async function main(ns) {
  const p = ns.getPlayer();
  const s = p.skills;
  const intBonus = 1 + Math.pow(s.intelligence, 0.8) / 600;

  const rows = CRIMES.map(([en, jp, money, sec, karma, diff, w]) => {
    let weighted =
      (w.hack || 0) * s.hacking +
      (w.str || 0) * s.strength +
      (w.def || 0) * s.defense +
      (w.dex || 0) * s.dexterity +
      (w.agi || 0) * s.agility +
      (w.cha || 0) * s.charisma +
      0.025 * s.intelligence;
    let chance = (weighted / 975 / diff) * p.mults.crime_success * intBonus;
    chance = Math.min(chance, 1);
    return {
      en,
      jp,
      money,
      sec,
      karma,
      chance,
      moneyPerMin: (chance * money) / (sec / 60),
      karmaPerHour: ((chance * karma) / sec) * 3600,
    };
  });

  ns.tprint(`=== 犯罪レコメンド（Hacking ${s.hacking} / 力 ${s.strength} / 器用 ${s.dexterity} / 素早 ${s.agility} / 防御 ${s.defense} / 魅力 ${s.charisma}）===`);
  const byMoney = [...rows].sort((a, b) => b.moneyPerMin - a.moneyPerMin);
  for (const r of byMoney) {
    ns.tprint(
      `${r.en}（${r.jp}）: 成功率 ${(r.chance * 100).toFixed(0)}% / 報酬 $${r.money.toLocaleString()} / ${r.sec}秒 → 期待値 $${Math.round(r.moneyPerMin).toLocaleString()}/分`,
    );
  }
  const bestMoney = byMoney[0];
  const bestKarma = [...rows].sort((a, b) => b.karmaPerHour - a.karmaPerHour)[0];
  ns.tprint(`お金目当てなら: ${bestMoney.en}（期待値 $${Math.round(bestMoney.moneyPerMin).toLocaleString()}/分）`);
  ns.tprint(`カルマ目当てなら: ${bestKarma.en}（-${bestKarma.karmaPerHour.toFixed(2)}/時）`);
}
