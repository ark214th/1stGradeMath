/*
 * ゆめかわ かんじ まほうえほん — 画面に依存しない しくみ
 * （書き順パスの点列化、なぞりの判定、きょうの かんじ の えらびかた、記録）
 * ブラウザでは window.KanjiCore、node では require() で使う。
 */
(function (root) {
  'use strict';

  /* ---------- SVG パス → 点の列（座標は 109×109） ---------- */
  function tokenize(d) {
    return d.match(/[MmCcSsLlHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  }

  function cubic(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  }

  // パスを細かい折れ線にする
  function flatten(d) {
    const tk = tokenize(d);
    const pts = [];
    let i = 0, cmd = '', cur = [0, 0], start = [0, 0], lastCtrl = null;
    const n = () => parseFloat(tk[i++]);
    const curve = (c1, c2, end) => {
      const steps = 12;
      for (let k = 1; k <= steps; k++) pts.push(cubic(cur, c1, c2, end, k / steps));
      lastCtrl = c2; cur = end;
    };
    while (i < tk.length) {
      if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
      const rel = cmd === cmd.toLowerCase();
      const ox = rel ? cur[0] : 0, oy = rel ? cur[1] : 0;
      switch (cmd.toUpperCase()) {
        case 'M': {
          cur = [ox + n(), oy + n()]; start = cur; pts.push(cur); lastCtrl = null;
          cmd = rel ? 'l' : 'L';
          break;
        }
        case 'L': { cur = [ox + n(), oy + n()]; pts.push(cur); lastCtrl = null; break; }
        case 'H': { cur = [(rel ? cur[0] : 0) + n(), cur[1]]; pts.push(cur); lastCtrl = null; break; }
        case 'V': { cur = [cur[0], (rel ? cur[1] : 0) + n()]; pts.push(cur); lastCtrl = null; break; }
        case 'C': {
          const c1 = [ox + n(), oy + n()], c2 = [ox + n(), oy + n()], e = [ox + n(), oy + n()];
          curve(c1, c2, e);
          break;
        }
        case 'S': {
          const c1 = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
          const c2 = [ox + n(), oy + n()], e = [ox + n(), oy + n()];
          curve(c1, c2, e);
          break;
        }
        case 'Z': { cur = start; pts.push(cur); lastCtrl = null; break; }
        default: i++;
      }
      // 命令の文字がなく数字が続くときは、同じ命令をくり返す（ループの先頭で cmd を変えない）
    }
    return pts;
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function polyLength(pts) {
    let L = 0;
    for (let k = 1; k < pts.length; k++) L += dist(pts[k - 1], pts[k]);
    return L;
  }

  // 折れ線を、道のりで等間隔な n 点に打ち直す
  function resample(pts, n) {
    if (!pts.length) return [];
    if (pts.length === 1) return Array.from({ length: n }, () => pts[0].slice());
    const L = polyLength(pts);
    if (L === 0) return Array.from({ length: n }, () => pts[0].slice());
    const out = [pts[0].slice()];
    const step = L / (n - 1);
    let k = 1, acc = 0, prev = pts[0];
    for (let j = 1; j < n - 1; j++) {
      const target = j * step;
      while (k < pts.length) {
        const seg = dist(prev, pts[k]);
        if (acc + seg >= target) {
          const t = seg ? (target - acc) / seg : 0;
          prev = [prev[0] + (pts[k][0] - prev[0]) * t, prev[1] + (pts[k][1] - prev[1]) * t];
          acc = target;
          out.push(prev.slice());
          break;
        }
        acc += seg; prev = pts[k]; k++;
      }
    }
    out.push(pts[pts.length - 1].slice());
    while (out.length < n) out.push(pts[pts.length - 1].slice());
    return out;
  }

  function strokePoints(d, n) {
    return resample(flatten(d), n || 24);
  }

  /* ---------- なぞりの判定 ----------
   * user: 子どもが書いた点列（109×109 の座標）
   * model: お手本の画のパス文字列
   * 小1向けに ゆるめ。書きはじめの位置・向き・かたちを見る。
   */
  const TOL = 17;

  function judgeStroke(user, model, opts) {
    const tol = (opts && opts.tol) || TOL;
    const M = typeof model === 'string' ? flatten(model) : model;
    const mLen = polyLength(M);
    const uLen = polyLength(user || []);
    const res = { ok: false, reason: '' };
    if (!user || user.length < 2 || uLen < Math.min(6, mLen * 0.4)) { res.reason = 'short'; return res; }
    const N = 20;
    const m = resample(M, N), u = resample(user, N);
    const startD = dist(u[0], m[0]);
    const endD = dist(u[N - 1], m[N - 1]);
    // 逆向きに書いたか（はじめと おわりが いれかわっている）
    if (dist(u[0], m[N - 1]) + dist(u[N - 1], m[0]) < (startD + endD) * 0.6 && mLen > 12) { res.reason = 'reverse'; return res; }
    if (startD > tol * 1.25) { res.reason = 'start'; return res; }
    if (endD > tol * 1.5) { res.reason = 'end'; return res; }
    let sum = 0;
    for (let k = 0; k < N; k++) sum += dist(u[k], m[k]);
    const mean = sum / N;
    if (mean > tol * 0.85) { res.reason = 'shape'; return res; }
    if (uLen < mLen * 0.45) { res.reason = 'short'; return res; }
    res.ok = true;
    res.score = mean;
    return res;
  }

  /* ---------- 記録 ---------- */
  const SAVE_KEY = 'yumekawaKanji_v1';

  function freshState() {
    return { v: 1, kanji: {}, days: 0, lastDay: '', today: null, settings: { voice: true, bgm: true } };
  }

  function normalizeState(raw) {
    const s = freshState();
    if (!raw || typeof raw !== 'object') return s;
    if (raw.kanji && typeof raw.kanji === 'object') {
      for (const k in raw.kanji) {
        const r = raw.kanji[k] || {};
        s.kanji[k] = { traced: Math.max(0, r.traced | 0), quiz: Math.max(0, r.quiz | 0), last: typeof r.last === 'string' ? r.last : '' };
      }
    }
    s.days = Math.max(0, raw.days | 0);
    s.lastDay = typeof raw.lastDay === 'string' ? raw.lastDay : '';
    if (raw.today && typeof raw.today === 'object' && Array.isArray(raw.today.list)) s.today = { day: String(raw.today.day || ''), list: raw.today.list.slice(0, 3), done: !!raw.today.done };
    if (raw.settings) s.settings = { voice: raw.settings.voice !== false, bgm: raw.settings.bgm !== false };
    return s;
  }

  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ほしの かず（ずかんの シール）：0=まだ、1=であった、2=3かい、3=5かい なぞった
  function stars(rec) {
    if (!rec || !rec.traced) return 0;
    if (rec.traced >= 5) return 3;
    if (rec.traced >= 3) return 2;
    return 1;
  }

  /* きょうの かんじ を 3つ えらぶ
   * order: 出す順の漢字の並び
   * あたらしい字 2つ ＋ おさらい 1つ（はじめの日は あたらしい字 3つ）
   */
  function pickToday(state, order, today) {
    const met = order.filter(k => state.kanji[k] && state.kanji[k].traced > 0);
    const fresh = order.filter(k => !(state.kanji[k] && state.kanji[k].traced > 0));
    const list = [];
    const review = met
      .filter(k => state.kanji[k].last !== today)
      .sort((a, b) => (state.kanji[a].traced - state.kanji[b].traced) || (state.kanji[a].last < state.kanji[b].last ? -1 : state.kanji[a].last > state.kanji[b].last ? 1 : 0));
    const nNew = met.length === 0 ? 3 : 2;
    list.push(...fresh.slice(0, nNew));
    while (list.length < 3 && review.length) list.push(review.shift());
    // 80字ぜんぶ であったあとは おさらい だけ
    for (const k of order) { if (list.length >= 3) break; if (!list.includes(k)) list.push(k); }
    return list;
  }

  // よみクイズ：ことばを 1つと、まぎらわしくない こたえ 3つ
  function shuffle(arr, rnd) {
    const a = arr.slice(), r = rnd || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function makeQuiz(targets, data, rnd) {
    const r = rnd || Math.random;
    const qs = [];
    for (const k of targets) {
      const e = data[k];
      if (!e) continue;
      const w = e.words[Math.floor(r() * e.words.length)];
      // ちがう こたえ は、ほかの字の ことば から
      const pool = [];
      for (const other in data) {
        if (other === k) continue;
        for (const ow of data[other].words) if (ow.r !== w.r) pool.push({ k: other, w: ow });
      }
      const picks = [];
      for (const p of shuffle(pool, r)) {
        if (picks.length >= 2) break;
        if (picks.some(x => x.w.r === p.w.r || x.k === p.k)) continue;
        picks.push(p);
      }
      // 2つの かたち：ことばを見て よみを えらぶ／よみを聞いて 字を えらぶ
      const type = r() < 0.5 ? 'read' : 'listen';
      const choices = shuffle([{ k, w, ok: true }].concat(picks.map(p => ({ k: p.k, w: p.w, ok: false }))), r);
      qs.push({ k, w, type, choices });
    }
    return qs;
  }

  const api = { tokenize, flatten, resample, polyLength, strokePoints, judgeStroke, TOL, SAVE_KEY, freshState, normalizeState, dayKey, stars, pickToday, makeQuiz, shuffle };
  root.KanjiCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
