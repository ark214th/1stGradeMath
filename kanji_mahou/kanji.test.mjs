import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('./kanji-core.js');
const { DATA, ORDER, GROUPS } = require('./kanji-data.js');
const STROKES = require('./kanji-strokes.js');

const GRADE1 = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';

// 学校で習う画数
const STROKE_COUNT = { 一: 1, 右: 5, 雨: 8, 円: 4, 王: 4, 音: 9, 下: 3, 火: 4, 花: 7, 貝: 7, 学: 8, 気: 6, 九: 2, 休: 6, 玉: 5, 金: 8, 空: 8, 月: 4, 犬: 4, 見: 7, 五: 4, 口: 3, 校: 10, 左: 5, 三: 3, 山: 3, 子: 3, 四: 5, 糸: 6, 字: 6, 耳: 6, 七: 2, 車: 7, 手: 4, 十: 2, 出: 5, 女: 3, 小: 3, 上: 3, 森: 12, 人: 2, 水: 4, 正: 5, 生: 5, 青: 8, 夕: 3, 石: 5, 赤: 7, 千: 3, 川: 3, 先: 6, 早: 6, 草: 9, 足: 7, 村: 7, 大: 3, 男: 7, 竹: 6, 中: 4, 虫: 6, 町: 7, 天: 4, 田: 5, 土: 3, 二: 2, 日: 4, 入: 2, 年: 6, 白: 5, 八: 2, 百: 6, 文: 4, 木: 4, 本: 5, 名: 6, 目: 5, 立: 5, 力: 2, 林: 8, 六: 4 };

test('1年生の80字が ちょうど 1回ずつ そろっている', () => {
  assert.equal(ORDER.length, 80);
  assert.equal(new Set(ORDER).size, 80);
  assert.deepEqual([...ORDER].sort(), [...GRADE1].sort());
  assert.deepEqual(Object.keys(STROKES).sort(), [...GRADE1].sort());
});

test('画数が 学校の画数と同じ', () => {
  for (const k of ORDER) assert.equal(STROKES[k].length, STROKE_COUNT[k], k);
});

test('ことばには その字だけが漢字で、よみは ひらがな', () => {
  const groupIds = new Set(GROUPS.map(g => g.id));
  for (const k of ORDER) {
    const e = DATA[k];
    assert.ok(groupIds.has(e.g), k);
    assert.ok(e.words.length >= 1 && e.words.length <= 2, k);
    for (const { w, r } of e.words) {
      assert.ok(w.includes(k), `${k}: ${w}`);
      const kanjiIn = [...w].filter(c => /\p{Script=Han}/u.test(c));
      assert.ok(kanjiIn.every(c => c === k), `${k}: ${w} に ほかの漢字`);
      assert.match(r, /^[ぁ-ゟ]+$/u, `${k}: ${r}`);
      assert.match(w, /^[ぁ-ゟ\p{Script=Han}]+$/u, `${k}: ${w}`);
    }
  }
});

test('パスの点は 109×109 の中におさまる', () => {
  for (const k of ORDER) {
    for (const d of STROKES[k]) {
      const pts = Core.flatten(d);
      assert.ok(pts.length >= 2, k);
      for (const [x, y] of pts) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), k);
        assert.ok(x > -2 && x < 111 && y > -2 && y < 111, `${k}: ${x},${y}`);
      }
      // はじめの点は M の座標
      const m = d.match(/^M(-?[\d.]+),(-?[\d.]+)/);
      assert.ok(Math.abs(pts[0][0] - parseFloat(m[1])) < 1e-6 && Math.abs(pts[0][1] - parseFloat(m[2])) < 1e-6, k);
    }
  }
});

// お手本を少しずらし、ゆらした「子どもの線」
function childLine(d, { dx = 0, dy = 0, wobble = 0, seed = 1, reverse = false } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const pts = Core.resample(Core.flatten(d), 30).map(([x, y]) => [x + dx + rnd() * wobble, y + dy + rnd() * wobble]);
  return reverse ? pts.reverse() : pts;
}

test('お手本どおり（少しずれても）なら ◎', () => {
  for (const k of ORDER) {
    STROKES[k].forEach((d, i) => {
      assert.ok(Core.judgeStroke(childLine(d), d).ok, `${k} ${i + 1}画め そのまま`);
      assert.ok(Core.judgeStroke(childLine(d, { dx: 6, dy: -5, wobble: 4, seed: i + 7 }), d).ok, `${k} ${i + 1}画め ずれ`);
    });
  }
});

test('ぎゃくむきに書いたら やりなおし', () => {
  let checked = 0;
  for (const k of ORDER) {
    STROKES[k].forEach(d => {
      if (Core.polyLength(Core.flatten(d)) < 25) return;
      checked++;
      assert.equal(Core.judgeStroke(childLine(d, { reverse: true }), d).ok, false, k);
    });
  }
  assert.ok(checked > 200);
});

test('書き順をとばして ほかの画を書いたら やりなおし（三・川・十・口・山・目）', () => {
  for (const k of ['三', '川', '十', '口', '山', '目', '木', '日']) {
    const S = STROKES[k];
    for (let i = 0; i < S.length; i++) {
      for (let j = 0; j < S.length; j++) {
        if (i === j) continue;
        const r = Core.judgeStroke(childLine(S[j]), S[i]);
        assert.equal(r.ok, false, `${k}: ${i + 1}画めの ところに ${j + 1}画めを書いた`);
      }
    }
  }
});

test('みじかい ちょん だけでは ◎ にならない', () => {
  const d = STROKES['一'][0];
  const pts = Core.flatten(d);
  assert.equal(Core.judgeStroke([pts[0], [pts[0][0] + 3, pts[0][1]]], d).ok, false);
  assert.equal(Core.judgeStroke([], d).ok, false);
});

test('きょうの かんじ：はじめは あたらしい字 3つ、つぎから 2つ＋おさらい 1つ', () => {
  const s = Core.freshState();
  const day1 = Core.pickToday(s, ORDER, '2026-10-09');
  assert.deepEqual(day1, ORDER.slice(0, 3));
  for (const k of day1) s.kanji[k] = { traced: 1, quiz: 0, last: '2026-10-09' };
  const day2 = Core.pickToday(s, ORDER, '2026-10-10');
  assert.deepEqual(day2.slice(0, 2), ORDER.slice(3, 5));
  assert.ok(day1.includes(day2[2]));
  assert.equal(new Set(day2).size, 3);
});

test('80字ぜんぶ であったあとも 3つ えらべる', () => {
  const s = Core.freshState();
  ORDER.forEach((k, i) => { s.kanji[k] = { traced: 1 + (i % 4), quiz: 0, last: '2026-10-0' + (1 + (i % 9)) }; });
  const list = Core.pickToday(s, ORDER, '2026-11-01');
  assert.equal(list.length, 3);
  assert.equal(new Set(list).size, 3);
  for (const k of list) assert.equal(s.kanji[k].traced, 1, '一番なぞった回数が少ない字から');
});

test('よみクイズ：こたえは 3つ、正解は 1つ、よみが かぶらない', () => {
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = 0; n < 30; n++) {
    const qs = Core.makeQuiz(ORDER.slice(n, n + 3), DATA, rnd);
    assert.equal(qs.length, 3);
    for (const q of qs) {
      assert.equal(q.choices.length, 3);
      assert.equal(q.choices.filter(c => c.ok).length, 1);
      assert.equal(new Set(q.choices.map(c => c.w.r)).size, 3);
      assert.equal(new Set(q.choices.map(c => c.k)).size, 3);
      assert.ok(['read', 'listen'].includes(q.type));
    }
  }
});

test('記録の読みこみ：こわれたデータでも あそべる', () => {
  assert.deepEqual(Core.normalizeState(null), Core.freshState());
  const s = Core.normalizeState({ kanji: { 山: { traced: '3', last: 5 } }, days: -2, settings: { voice: false } });
  assert.deepEqual(s.kanji['山'], { traced: 3, quiz: 0, last: '' });
  assert.equal(s.days, 0);
  assert.equal(s.settings.voice, false);
  assert.equal(s.settings.bgm, true);
  assert.equal(Core.stars(s.kanji['山']), 2);
  assert.equal(Core.stars(undefined), 0);
});
