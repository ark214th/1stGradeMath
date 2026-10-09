// ゆめかわ かんじの しま — がめんの うごき
import { Island } from './island.mjs';

let world = null;
const $ = s => document.querySelector(s);
const { DATA, ORDER, GROUPS } = window.KANJI_DATA;
const STROKES = window.KANJI_STROKES;
const Core = window.KanjiCore;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SVGNS = 'http://www.w3.org/2000/svg';

/* ================= きろく ================= */
let S;
try { S = Core.normalizeState(JSON.parse(localStorage.getItem(Core.SAVE_KEY) || 'null')); } catch (e) { S = Core.freshState(); }
const save = () => { try { localStorage.setItem(Core.SAVE_KEY, JSON.stringify(S)); } catch (e) {} };
const rec = k => (S.kanji[k] || (S.kanji[k] = { traced: 0, quiz: 0, last: '' }));
const metCount = () => ORDER.filter(k => S.kanji[k] && S.kanji[k].traced > 0).length;

/* ================= おと ================= */
const AC = {
  ctx: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.out = this.ctx.createGain(); this.out.gain.value = .9; this.out.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = .55; this.sfx.connect(this.out);
    this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0; this.bgm.connect(this.out);
    this.startBgm();
  },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  note(f, t0, dur, { type = 'sine', vol = .3, g = this.sfx, slide = 0, attack = .006 } = {}) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), a = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t0 + dur);
    a.gain.setValueAtTime(.0001, t0); a.gain.exponentialRampToValueAtTime(vol, t0 + attack); a.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(a); a.connect(g); o.start(t0); o.stop(t0 + dur + .05);
  },
  tap() { const t = this.now(); this.note(880, t, .1, { type: 'triangle', vol: .18, slide: 1.4 }); },
  stroke(n) { const sc = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349]; const f = sc[n % sc.length], t = this.now(); this.note(f, t, .35, { type: 'triangle', vol: .26 }); this.note(f * 2, t, .25, { vol: .06 }); },
  sparkle() { const t = this.now(); [1319, 1568, 1760, 2093, 2637, 3136].forEach((f, i) => this.note(f, t + i * .055, .35, { vol: .11 })); },
  magic() { const t = this.now(); for (let i = 0; i < 12; i++) this.note(600 + i * 150, t + i * .045, .3, { vol: .08 }); },
  fanfare() { const t = this.now(); [[523, 0], [659, .11], [784, .22], [1047, .33]].forEach(([f, d]) => { this.note(f, t + d, .5, { type: 'triangle', vol: .26 }); this.note(f / 2, t + d, .4, { vol: .1 }); }); this.note(1319, t + .45, .9, { vol: .13 }); this.note(1568, t + .45, .9, { vol: .1 }); },
  boing() { const t = this.now(); this.note(330, t, .35, { vol: .2, slide: .7 }); },
  startBgm() {
    // オルゴール風の やさしい ループ
    const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66 };
    const mel = ['C5', 'E5', 'G5', 'E5', 'F5', 'A5', 'G5', 0, 'E5', 'G5', 'C6', 'G5', 'A5', 'G5', 'E5', 0,
      'D5', 'F5', 'A5', 'F5', 'E5', 'G5', 'C6', 0, 'D6', 'C6', 'A5', 'G5', 'E5', 'D5', 'C5', 0];
    const bass = [130.81, 174.61, 146.83, 196];
    const step = 60 / 92 / 2; let next = this.ctx.currentTime + .2, i = 0;
    setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      while (next < this.ctx.currentTime + .4) {
        const m = mel[i % 32];
        if (m) { this.note(N[m], next, .9, { vol: .14, g: this.bgm }); this.note(N[m] * 2, next, .5, { vol: .025, g: this.bgm }); }
        if (i % 8 === 0) { const b = bass[Math.floor(i / 8) % 4]; this.note(b * 2, next, 1.6, { type: 'triangle', vol: .08, g: this.bgm }); }
        next += step; i++;
      }
    }, 120);
    this.applyBgm();
  },
  ducked: false,
  applyBgm() { if (!this.ctx) return; const v = S.settings.bgm ? (this.ducked ? .1 : .32) : 0; this.bgm.gain.setTargetAtTime(v, this.ctx.currentTime, .25); },
  duck(on) { this.ducked = on; this.applyBgm(); },
};

/* ================= こえ ================= */
const Voice = {
  ok: 'speechSynthesis' in window, v: null,
  init() {
    if (!this.ok) return;
    const pv = () => {
      const vs = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
      this.v = vs.find(v => /Kyoko|O-ren|Nanami|Haruka|Ayumi|Mizuki/i.test(v.name)) || vs.find(v => /Google/i.test(v.name)) || vs[0] || null;
    };
    pv(); speechSynthesis.onvoiceschanged = pv;
  },
  say(text, { pitch = 1.25, rate = .95 } = {}) {
    return new Promise(res => {
      if (!this.ok || !S.settings.voice) { setTimeout(res, 150); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; if (this.v) u.voice = this.v; u.pitch = pitch; u.rate = rate;
      let done = false; const fin = () => { if (done) return; done = true; AC.duck(false); res(); };
      u.onend = fin; u.onerror = fin; setTimeout(fin, 900 + text.length * 260);
      AC.duck(true); speechSynthesis.speak(u);
    });
  },
  stop() { if (this.ok) speechSynthesis.cancel(); },
};

/* ================= きらきら ================= */
function sparks(x, y, n = 14, chars = ['✨', '💖', '⭐', '🌸', '💫']) {
  const fx = $('#fx');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    s.textContent = chars[i % chars.length];
    const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 140;
    s.style.left = (x - 14) + 'px'; s.style.top = (y - 14) + 'px';
    s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r + 'px');
    s.style.animationDelay = (Math.random() * .15) + 's';
    fx.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
}
const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

/* ================= がめん ================= */
let screen = 'title';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  screen = id;
  // レッスンの あいだは 島を とめる（でんちの ため）
  if (world) world.paused = ['lesson', 'quiz', 'zukan'].includes(id);
  layout();
}
function layout() {
  const W = innerWidth, H = innerHeight;
  const top = H <= 520 ? 50 : 64;
  let bs;
  if (W >= H) bs = Math.min(H - top - 40, W * 0.5);
  else bs = Math.min(W - 40, (H - top) * 0.5);
  document.documentElement.style.setProperty('--bs', Math.max(200, Math.floor(bs)) + 'px');
}
addEventListener('resize', layout);

const hl = (w, k) => w.split(k).map(t => t.replace(/[&<>]/g, '')).join('<em>' + k + '</em>');

/* ================= ばん（SVG） ================= */
const svg = $('#boardSvg');
function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const a in attrs) e.setAttribute(a, attrs[a]);
  if (parent) parent.appendChild(e);
  return e;
}
const Board = {
  k: null, paths: [], done: 0, layers: {},
  setup(k) {
    this.k = k; this.done = 0;
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const g = el('linearGradient', { id: 'ink', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#ff6fb3' }, g); el('stop', { offset: '.55', 'stop-color': '#c77dff' }, g); el('stop', { offset: '1', 'stop-color': '#5fb8ff' }, g);
    // 十字の点線（ドリルの マス）
    const grid = el('g', { stroke: '#f6cfe3', 'stroke-width': .6, 'stroke-dasharray': '2 2.2' }, svg);
    el('line', { x1: 54.5, y1: 4, x2: 54.5, y2: 105 }, grid); el('line', { x1: 4, y1: 54.5, x2: 105, y2: 54.5 }, grid);
    this.layers.model = el('g', { fill: 'none', stroke: '#f9dbea', 'stroke-width': 7.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    this.layers.done = el('g', { fill: 'none', stroke: 'url(#ink)', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    this.layers.anim = el('g', { fill: 'none', stroke: '#ff7fbf', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    this.layers.hint = el('g', {}, svg);
    this.layers.user = el('g', { fill: 'none', stroke: '#8f6bff', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .85 }, svg);
    this.paths = STROKES[k];
    this.models = this.paths.map(d => el('path', { d }, this.layers.model));
  },
  showModel(on) { this.layers.model.style.opacity = on ? 1 : 0; },
  clearDone() { this.layers.done.innerHTML = ''; this.done = 0; },
  clearAnim() { this.layers.anim.innerHTML = ''; },
  addDone(i) { el('path', { d: this.paths[i] }, this.layers.done); },
  // 1画を 書くように うごかす
  async drawStroke(i, ms = 520, layer = this.layers.anim, cls) {
    const p = el('path', { d: this.paths[i] }, layer);
    if (cls) p.setAttribute('class', cls);
    const L = p.getTotalLength() + 1;
    p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    p.getBoundingClientRect();
    p.style.transition = `stroke-dashoffset ${ms}ms ease-in-out`;
    p.style.strokeDashoffset = 0;
    await sleep(ms + 40);
    return p;
  },
  // かきじゅん アニメ（ばんごう つき）
  async playOrder(token) {
    this.clearAnim(); this.clearHint();
    for (let i = 0; i < this.paths.length; i++) {
      if (token.cancel) return;
      this.number(i, '#ff6fb3');
      AC.stroke(i);
      await this.drawStroke(i, 560);
      await sleep(180);
    }
  },
  number(i, color) {
    const pts = Core.flatten(this.paths[i]);
    const [x, y] = pts[0];
    const [x2, y2] = pts[Math.min(3, pts.length - 1)];
    // はじまりの すこし うしろ に ばんごう
    let dx = x - x2, dy = y - y2; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = Math.min(102, Math.max(7, x + dx * 7 - dy * 3)), ny = Math.min(102, Math.max(7, y + dy * 7 + dx * 3));
    const g = el('g', {}, this.layers.hint);
    el('circle', { cx: nx, cy: ny, r: 5, fill: color || '#ff6fb3' }, g);
    const t = el('text', { x: nx, y: ny + 2.4, 'text-anchor': 'middle', 'font-size': 7, 'font-weight': 900, fill: '#fff' }, g);
    t.textContent = i + 1;
  },
  clearHint() { this.layers.hint.innerHTML = ''; },
  // つぎの画の「ここから」
  startDot(i, strong) {
    this.clearHint();
    const [x, y] = Core.flatten(this.paths[i])[0];
    const g = el('g', {}, this.layers.hint);
    const c = el('circle', { cx: x, cy: y, r: strong ? 6 : 4.6, fill: '#4fd1a8', opacity: .9 }, g);
    c.innerHTML = `<animate attributeName="r" values="${strong ? '5;8;5' : '4;6;4'}" dur="1.1s" repeatCount="indefinite"/>`;
    this.number(i, '#ff6fb3');
  },
};

/* ================= なぞり ================= */
const Trace = {
  active: false, idx: 0, miss: 0, pts: null, line: null, onDone: null,
  start(onDone) {
    this.active = true; this.idx = 0; this.miss = 0; this.onDone = onDone;
    Board.clearDone(); Board.clearAnim(); Board.layers.user.innerHTML = '';
    Board.startDot(0);
  },
  stop() { this.active = false; this.pts = null; },
  toLocal(e) {
    const r = $('#board').getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * 109, (e.clientY - r.top) / r.height * 109];
  },
  down(e) {
    if (!this.active) return;
    e.preventDefault();
    $('#board').setPointerCapture && $('#board').setPointerCapture(e.pointerId);
    this.pid = e.pointerId;
    this.pts = [this.toLocal(e)];
    Board.layers.user.innerHTML = '';
    this.line = el('polyline', { points: this.pts.map(p => p.join(',')).join(' ') }, Board.layers.user);
  },
  move(e) {
    if (!this.active || !this.pts || e.pointerId !== this.pid) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) this.pts.push(this.toLocal(ev));
    this.line.setAttribute('points', this.pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
  },
  async up(e) {
    if (!this.active || !this.pts || e.pointerId !== this.pid) return;
    const pts = this.pts; this.pts = null;
    const i = this.idx;
    const r = Core.judgeStroke(pts, Board.paths[i]);
    if (r.ok) {
      Board.layers.user.innerHTML = '';
      Board.addDone(i);
      AC.stroke(i);
      const box = $('#board').getBoundingClientRect();
      const end = Core.flatten(Board.paths[i]).pop();
      sparks(box.left + end[0] / 109 * box.width, box.top + end[1] / 109 * box.height, 5, ['✨', '💖']);
      this.next();
    } else {
      this.miss++;
      AC.boing();
      const line = this.line;
      line.style.transition = 'opacity .5s'; line.style.opacity = 0;
      setTimeout(() => line.remove(), 520);
      if (this.miss >= 3) {
        // 3かい むずかしかったら いっしょに かく
        this.active = false;
        Say.lesson('いっしょに かこうね');
        Board.clearHint();
        await Board.drawStroke(i, 700, Board.layers.done);
        AC.stroke(i);
        this.active = true;
        this.next();
        return;
      }
      if (r.reason === 'reverse') Say.lesson('みどりの まるから かくよ', true);
      else if (r.reason === 'start') Say.lesson(`${i + 1}ばんめは ここから だよ`, true);
      else Say.lesson('おしい！ もう いっかい', true);
      Board.startDot(i, true);
      // おてほんの うごき を みせる
      this.active = false;
      Board.clearAnim();
      await Board.drawStroke(i, 650);
      await sleep(250);
      Board.clearAnim();
      this.active = screen === 'lesson';
    }
  },
  next() {
    this.idx++; this.miss = 0;
    if (this.idx >= Board.paths.length) {
      this.active = false; Board.clearHint();
      this.onDone && this.onDone();
    } else Board.startDot(this.idx);
  },
};
const boardEl = $('#board');
boardEl.addEventListener('pointerdown', e => Trace.down(e));
boardEl.addEventListener('pointermove', e => Trace.move(e));
boardEl.addEventListener('pointerup', e => Trace.up(e));
boardEl.addEventListener('pointercancel', e => Trace.up(e));
document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('#zlist,.dgrid,.sgrid')) e.preventDefault(); }, { passive: false });

/* ================= ふきだし ================= */
const Say = {
  lesson(t, voice) { $('#lessonSay').textContent = t; if (voice) Voice.say(t); },
};

/* ================= レッスン ================= */
let L = null; // { list, i, mode: 'today'|'one', token }
function stepsHTML(n, now, doneUpTo) {
  return Array.from({ length: n }, (_, i) => `<i class="${i < doneUpTo ? 'on' : i === now ? 'now' : ''}"></i>`).join('');
}
function cancelToken() { if (L && L.token) L.token.cancel = true; L.token = { cancel: false }; return L.token; }

function startLesson(list, mode) {
  L = { list, i: 0, mode, token: { cancel: false }, ev: null };
  show('lesson');
  meet();
}

function setButtons({ replay = false, next = null, again = null } = {}) {
  const rb = $('#replayBtn'), nb = $('#nextBtn'), ab = $('#againBtn');
  rb.hidden = !replay;
  nb.hidden = !next; nb.onclick = next ? () => { AC.tap(); next(); } : null;
  ab.hidden = !again; ab.onclick = again ? () => { AC.tap(); again(); } : null;
}

function renderPic(e) {
  const pic = $('#pic');
  pic.className = 'pic'; pic.innerHTML = '';
  if (e.startsWith('#')) {
    const n = +e.slice(1);
    if (n <= 10) { pic.classList.add('stars'); pic.innerHTML = '<span>⭐</span>'.repeat(n); if (n > 5) pic.style.padding = '8%'; else pic.style.padding = ''; }
    else { pic.classList.add('num'); pic.textContent = n; }
  } else {
    pic.textContent = e;
    if ([...e].length > 2 && !/‍/.test(e)) pic.classList.add('many');
    if (/🌳🌳/.test(e) && !/🌲/.test(e)) pic.classList.add('many');
  }
}

async function meet() {
  const k = L.list[L.i];
  const token = cancelToken();
  Trace.stop();
  L.ev = null;
  $('#steps').innerHTML = stepsHTML(L.list.length, L.i, L.i);
  $('#lessonLabel').textContent = L.mode === 'today' ? `${L.i + 1} / ${L.list.length}` : 'れんしゅう';
  Board.setup(k);
  Board.showModel(false);
  renderPic(DATA[k].e);
  $('#yomi').innerHTML = '';
  $('#wand').hidden = false;
  setButtons();
  const isNew = !(S.kanji[k] && S.kanji[k].traced);
  Say.lesson(isNew ? 'ステッキを タッチしてね！' : 'また あったね！');
  show('lesson');
  Voice.say(isNew ? 'まほうの ステッキを タッチしてね' : 'また あったね');
  $('#wand').onclick = () => transform(k, token);
}

async function transform(k, token) {
  $('#wand').hidden = true;
  AC.magic();
  const [cx, cy] = centerOf($('#board'));
  sparks(cx, cy, 18);
  $('#flash').classList.remove('go'); void $('#flash').offsetWidth; $('#flash').classList.add('go');
  $('#pic').classList.add('gone');
  await sleep(520);
  if (token.cancel) return;
  Board.showModel(true);
  for (let i = 0; i < Board.paths.length; i++) { await Board.drawStroke(i, 200); if (token.cancel) return; }
  AC.sparkle();
  const e = DATA[k];
  const first = e.words[0];
  Say.lesson(`「${first.r}」の かんじ だよ！`);
  showWords(k);
  await Voice.say(first.r);
  if (token.cancel) return;
  setButtons({ next: () => order(k) });
  $('#nextBtn').textContent = 'かいてみよう ✏️';
}

function showWords(k) {
  const box = $('#yomi'); box.innerHTML = '';
  DATA[k].words.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'word'; d.style.animationDelay = (i * .15) + 's';
    d.innerHTML = `<div><div class="w">${hl(w.w, k)}</div><div class="r">${w.r}</div></div><button class="ibtn" aria-label="きく">🔊</button>`;
    d.querySelector('button').onclick = () => { AC.tap(); Voice.say(w.r); };
    box.appendChild(d);
  });
}

async function order(k) {
  const token = cancelToken();
  setButtons();
  $('#nextBtn').textContent = 'つぎへ ▶';
  Board.clearAnim(); Board.clearDone(); Board.clearHint();
  Say.lesson('かきじゅんを みてね');
  Voice.say('かきじゅんを みてね');
  await Board.playOrder(token);
  if (token.cancel) return;
  await sleep(400);
  Board.clearAnim(); Board.clearHint();
  trace(k, token);
}

function trace(k, token) {
  Say.lesson('みどりの まるから なぞってね');
  Voice.say('みどりの まるから なぞってね');
  setButtons({ replay: true });
  $('#replayBtn').onclick = async () => {
    AC.tap();
    Trace.stop();
    const t = cancelToken();
    setButtons();
    Board.clearDone();
    Board.clearAnim();
    await Board.playOrder(t);
    if (t.cancel) return;
    await sleep(300);
    Board.clearAnim(); Board.clearHint();
    trace(k, t);
  };
  Trace.start(() => traced(k, token));
}

async function traced(k, token) {
  const before = Core.stars(S.kanji[k]);
  const ev = learn(k);
  // おなじ字を もう いっかい なぞったときは まとめる（はじめて の しるしは のこす）
  if (L.ev && L.ev.k === k) { ev.first = ev.first || L.ev.first; ev.got = L.ev.got.concat(ev.got); ev.grow = Math.max(ev.grow, L.ev.grow); }
  L.ev = ev;
  AC.fanfare();
  const [cx, cy] = centerOf($('#board'));
  sparks(cx, cy, 22);
  const msg = ['はなまる！', 'じょうず！', 'すてき！', 'きらきら！'][Math.floor(Math.random() * 4)];
  Say.lesson(ev.lv > before && before > 0 ? `${msg} ほしが ふえたよ ⭐` : `${msg} しまへ とどけよう！`);
  Voice.say(msg);
  setButtons({ replay: false, next: () => afterTrace(), again: () => { Board.clearDone(); Board.layers.user.innerHTML = ''; trace(k, cancelToken()); } });
  $('#nextBtn').textContent = 'しまへ ▶';
}

/* ================= よみクイズ ================= */
let Q = null;
function startQuiz(list) {
  Q = { qs: Core.makeQuiz(list, DATA), i: 0 };
  show('quiz');
  askQ();
}
async function askQ() {
  const q = Q.qs[Q.i];
  $('#qsteps').innerHTML = stepsHTML(Q.qs.length, Q.i, Q.i);
  const head = $('#qhead'), ch = $('#choices');
  ch.innerHTML = '';
  let locked = false;
  if (q.type === 'read') {
    head.innerHTML = `<div class="qword">${hl(q.w.w, q.k)}</div>`;
    $('#qq').textContent = 'なんて よむ かな？';
    Voice.say('なんて よむ かな？');
  } else {
    head.innerHTML = `<div class="qword" style="font-size:clamp(40px,7vh,64px)">「${q.w.r}」</div><button class="ibtn" aria-label="きく">🔊</button>`;
    head.querySelector('button').onclick = () => { AC.tap(); Voice.say(q.w.r); };
    $('#qq').textContent = 'どれ かな？';
    Voice.say(`${q.w.r}、は どれ かな？`);
  }
  q.choices.forEach(c => {
    const b = document.createElement('button');
    b.className = 'choice' + (q.type === 'listen' ? ' kanji' : '');
    b.innerHTML = q.type === 'read' ? c.w.r : hl(c.w.w, c.k);
    b.onclick = async () => {
      if (locked || b.classList.contains('no')) return;
      if (c.ok) {
        locked = true;
        b.classList.add('yes');
        AC.sparkle();
        sparks(...centerOf(b), 14);
        rec(q.k).quiz++; save();
        await Voice.say(q.w.r);
        await sleep(500);
        Q.i++;
        if (Q.i < Q.qs.length) askQ(); else finishToday();
      } else {
        b.classList.add('no');
        AC.boing();
        Voice.say('おしい！');
      }
    };
    ch.appendChild(b);
  });
}


/* ================= しま ================= */
const Rw = window.KanjiRewards;
world = new Island($('#world'));
const today = () => Core.dayKey();
const word0 = k => DATA[k].words[0];

function islandSync() {
  const levels = {};
  const learned = ORDER.filter(k => S.kanji[k] && S.kanji[k].traced > 0);
  for (const k of learned) levels[k] = Core.stars(S.kanji[k]);
  world.setSize(Rw.islandSize(learned.length), false);
  world.setKanji(levels, learned);
  world.setOutfit(S.r.outfit);
  world.setSkyStars(S.r.skyStars);
}

// なぞりおわった字を きろくする。島で おこる ことを かえす
function learn(k) {
  const day = today();
  const r = rec(k);
  const first = !r.traced;
  const before = Core.stars(r);
  const sizeBefore = Rw.islandSize(metCount());
  r.traced++; r.last = day;
  const ev = { k, first, lv: Core.stars(r), lvUp: Core.stars(r) > before, got: [], grow: 0 };
  if (first) { Rw.countNew(S.r, day); ev.got = Rw.unlockForKanji(S.r, k, metCount(), ORDER.length); }
  const sizeAfter = Rw.islandSize(metCount());
  if (sizeAfter > sizeBefore) ev.grow = sizeAfter;
  save();
  return ev;
}

/* ---------- 島の うえの ことば と ボタン ---------- */
let capTimer = 0;
function caption(html, ms = 0) {
  const c = $('#cap');
  clearTimeout(capTimer);
  c.innerHTML = html; c.hidden = false;
  c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
  if (ms) capTimer = setTimeout(() => (c.hidden = true), ms);
}
const hideCaption = () => { clearTimeout(capTimer); $('#cap').hidden = true; };
const kcap = (k, line, sub = '') => `<span class="ck">${k}</span><span>${line}${sub ? `<small>${sub}</small>` : ''}</span>`;

function bottomBtn(text) {
  const b = $('#bottomBtn');
  b.textContent = text; b.hidden = false;
  return new Promise(res => { b.onclick = () => { AC.tap(); b.hidden = true; b.onclick = null; res(); }; });
}
function hud(on) {
  // on: ふだんの ボタン を だす / off: えんしゅつちゅう
  document.querySelectorAll('#island .topbar .ibtn').forEach(b => (b.style.visibility = on ? '' : 'hidden'));
  $('#todayBtn').hidden = !on;
  if (on) refreshHud();
}
function refreshHud() {
  $('#hudCount').textContent = metCount();
  const day = today();
  const done = !!(S.today && S.today.day === day && S.today.done);
  const tb = $('#todayBtn');
  tb.textContent = done ? 'もっと れんしゅう ✨' : '✨ きょうの まほう';
  tb.className = 'btn' + (done ? ' lav' : ' pulse');
  $('#spellBtn').style.display = ORDER.some(k => Rw.roleOf(k) === 'spell' && S.kanji[k] && S.kanji[k].traced) ? '' : 'none';
  $('#dressDot').classList.toggle('on', S.r.owned.some(id => !Rw.START_OWNED.includes(id) && !S.r.seen.includes(id)));
}

function goHome() {
  Trace.stop(); if (L) cancelToken(); Voice.stop();
  closeModal();
  world.setMode('island');
  show('island');
  hud(true);
  world.zoomOut();
}

/* ---------- 字が 島に とどく ---------- */
async function afterTrace() {
  const ev = L.ev;
  Voice.stop();
  show('island'); hud(false); hideCaption();
  await playEvent(ev);
  if (L.mode === 'today') {
    if (L.i + 1 < L.list.length) { await bottomBtn('つぎの かんじ ▶'); hideCaption(); L.i++; meet(); }
    else { await bottomBtn('よみ クイズ ▶'); hideCaption(); startQuiz(L.list); }
  } else {
    await sleep(1200);
    hideCaption();
    await world.zoomOut();
    hud(true);
  }
}

async function playEvent(ev) {
  const k = ev.k, w = word0(k);
  $('#hudCount').textContent = metCount();
  if (Rw.roleOf(k) === 'spell') {
    caption(kcap(k, `「${w.r}」の まほう！`));
    Voice.say(w.r);
    await world.spell(k);
  } else if (ev.first) {
    caption(kcap(k, `「${w.r}」が でてきた！`));
    Voice.say(`${w.r}が でてきた！`);
    await world.reveal(k, ev.lv);
  } else {
    caption(kcap(k, ev.lvUp ? 'ほしが ふえたよ ⭐' : 'きらきら！'));
    Voice.say(ev.lvUp ? 'ほしが ふえたよ' : 'きらきら！');
    await world.levelUp(k, ev.lv);
  }
  for (const id of ev.got) {
    const o = Rw.outfitById(id);
    AC.fanfare();
    if (o.slot === 'color') { S.r.outfit.color = id; world.setOutfit(S.r.outfit); }
    else { S.r.outfit[o.slot] = id; world.setOutfit(S.r.outfit); }
    save();
    world.poke();
    caption(`<span class="ck">${o.icon}</span><span>${o.name} が ふえたよ！<small>きせかえで かえられるよ</small></span>`);
    await Voice.say(`やったー！ ${o.name} が ふえたよ`);
    await sleep(800);
  }
  if (ev.grow) {
    caption('<span class="ck">🏝️</span><span>しまが ひろがった！</span>');
    AC.magic();
    Voice.say('しまが ひろがったよ！');
    await world.growIsland(ev.grow);
    await sleep(500);
  }
}

/* ---------- きょうの まほう ---------- */
function todayList() {
  const day = today();
  if (!S.today || S.today.day !== day) { S.today = { day, list: Core.pickToday(S, ORDER, day, Rw.newLeftToday(S.r, day)), done: false }; save(); }
  return S.today.list;
}
$('#todayBtn').onclick = () => {
  AC.tap();
  let list = todayList();
  if (S.today.done) {
    // もっと れんしゅう：あたらしい字は 1日の 上限まで、あとは おさらい
    const day = today();
    list = Core.pickToday(S, ORDER, day, Rw.newLeftToday(S.r, day));
  }
  startLesson(list, 'today');
};

async function finishToday() {
  const day = today();
  show('island'); hud(false);
  world.setMode('island');
  const firstSet = !(S.today && S.today.day === day && S.today.done);
  if (S.today && S.today.day === day) S.today.done = true;
  if (firstSet && S.lastDay !== day) { S.days++; S.lastDay = day; }
  save();
  if (!S.r.stamps[day]) {
    const k = L.list.find(x => S.kanji[x] && S.kanji[x].traced === 1 && S.kanji[x].last === day) || L.list[0];
    Rw.stamp(S.r, day, k); save();
    Voice.say('きょうの スタンプ！');
    await showCalendar(day, true);
  }
  const gift = Rw.claimGift(S.r, day);
  save();
  if (gift) await giftFlow(gift);
  caption('<span class="ck">🌙</span><span>きょうの まほう できた！<small>また あした あそぼうね</small></span>', 4000);
  Voice.say('きょうの まほう、できたね！ また あした あそぼうね');
  hud(true);
}

async function giftFlow(gift) {
  caption('<span class="ck">🎁</span><span>プレゼントが とどいたよ！<small>タッチして あけてね</small></span>');
  Voice.say('プレゼントが とどいたよ！ タッチして あけてね');
  world.showGift();
  let n = 0;
  await new Promise(res => {
    world.onTapGift = () => {
      n++; AC.tap(); world.shakeGift(n);
      if (n >= 3) { world.onTapGift = null; res(); }
      else caption(`<span class="ck">🎁</span><span>${n === 1 ? 'もう いっかい！' : 'あと いっかい！'}</span>`);
    };
  });
  AC.fanfare();
  await world.openGift();
  if (gift.type === 'item') {
    const o = Rw.outfitById(gift.id);
    S.r.outfit[o.slot] = o.id; save();
    world.setOutfit(S.r.outfit);
    world.poke();
    caption(`<span class="ck">${o.icon}</span><span>${o.name} を ゲット！<small>${gift.special ? 'とくべつな プレゼント！' : 'きせかえで かえられるよ'}</small></span>`);
    Voice.say(`やったー！ ${o.name} だよ！`);
  } else {
    world.setSkyStars(S.r.skyStars);
    caption('<span class="ck">⭐</span><span>きらきらぼし！<small>おそらに ひかるよ</small></span>');
    Voice.say('きらきらぼし！ おそらに ひかるよ');
  }
  await bottomBtn('やったー！');
  hideCaption();
}

/* ---------- モーダル ---------- */
function openModal(html) { $('#mbox').innerHTML = html; $('#modal').classList.add('on'); }
function closeModal() { $('#modal').classList.remove('on'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.lock) closeModal(); });

// スタンプ カレンダー
function showCalendar(landDay, lock) {
  return new Promise(res => {
    const now = new Date();
    let y = now.getFullYear(), m = now.getMonth();
    const draw = () => {
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      let cells = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'].map(d => `<div class="h">${d}</div>`).join('');
      for (let i = 0; i < first; i++) cells += '<div class="x"></div>';
      for (let i = 1; i <= days; i++) {
        const key = Core.dayKey(new Date(y, m, i)), s = S.r.stamps[key];
        cells += `<div class="${key === today() ? 't' : ''}">${i}${s ? `<b class="${key === landDay ? 'land' : ''}">${s}</b>` : ''}</div>`;
      }
      const total = Rw.stampCount(S.r), next = Rw.SPECIAL_EVERY - (total % Rw.SPECIAL_EVERY);
      openModal(`<h2>${m + 1}がつの スタンプ</h2><div class="cal">${cells}</div>
        <div style="font-weight:900">ぜんぶで <b style="font-size:28px;color:#e0428f">${total}</b> こ　・　あと ${next}こで とくべつな プレゼント 🎁</div>
        <button class="btn" id="calClose">${lock ? 'つぎへ ▶' : 'とじる'}</button>`);
      $('#calClose').onclick = () => { AC.tap(); delete $('#modal').dataset.lock; closeModal(); res(); };
      if (landDay) setTimeout(() => AC.fanfare(), 250);
    };
    if (lock) $('#modal').dataset.lock = '1';
    draw();
  });
}
$('#calBtn').onclick = () => { AC.tap(); showCalendar(null, false); };

// じゅもんの ほん
$('#spellBtn').onclick = () => {
  AC.tap();
  const spells = ORDER.filter(k => Rw.roleOf(k) === 'spell');
  openModal(`<h2>🪄 じゅもんの ほん</h2><div style="font-weight:900">タッチすると ぷにゅに まほうが かかるよ</div><div class="sgrid">${spells.map(k => {
    const ok = S.kanji[k] && S.kanji[k].traced;
    return `<button data-k="${k}" class="${ok ? '' : 'lock'}">${ok ? k : '？'}</button>`;
  }).join('')}</div><button class="btn white small" id="spClose">とじる</button>`);
  $('#spClose').onclick = () => { AC.tap(); closeModal(); };
  document.querySelectorAll('.sgrid button').forEach(b => {
    b.onclick = async () => {
      if (b.classList.contains('lock')) { AC.boing(); return; }
      const k = b.dataset.k;
      closeModal(); hud(false);
      AC.magic();
      caption(kcap(k, `「${word0(k).r}」の まほう！`));
      Voice.say(word0(k).r);
      await world.spell(k);
      hideCaption(); hud(true);
    };
  });
};

// せってい
$('#setBtn').onclick = () => {
  AC.tap();
  const draw = () => {
    openModal(`<h2>⚙️ せってい</h2><div class="setrow">
      <button class="btn ${S.settings.voice ? '' : 'white'}" id="sv">🗣️ こえ ${S.settings.voice ? 'オン' : 'オフ'}</button>
      <button class="btn ${S.settings.bgm ? '' : 'white'}" id="sb">🎵 おんがく ${S.settings.bgm ? 'オン' : 'オフ'}</button></div>
      <button class="btn white small" id="sc">とじる</button>`);
    $('#sv').onclick = () => { S.settings.voice = !S.settings.voice; save(); if (!S.settings.voice) Voice.stop(); AC.tap(); draw(); };
    $('#sb').onclick = () => { S.settings.bgm = !S.settings.bgm; save(); AC.applyBgm(); AC.tap(); draw(); };
    $('#sc').onclick = () => { AC.tap(); closeModal(); };
  };
  draw();
};

/* ---------- きせかえ ---------- */
let dressSlot = 'head';
$('#dressBtn').onclick = () => { AC.tap(); openDress(); };
function openDress() {
  hideCaption();
  world.setMode('dress');
  show('dress');
  renderDress();
  Voice.say('きせかえ しよう！');
}
function renderDress() {
  $('#dressTabs').innerHTML = Rw.SLOTS.map(s => `<button class="tab ${s.id === dressSlot ? 'on' : ''}" data-s="${s.id}">${s.name}</button>`).join('');
  document.querySelectorAll('#dressTabs .tab').forEach(b => (b.onclick = () => { AC.tap(); dressSlot = b.dataset.s; renderDress(); }));
  const grid = $('#dressGrid'); grid.innerHTML = '';
  for (const o of Rw.OUTFITS.filter(o => o.slot === dressSlot)) {
    const own = S.r.owned.includes(o.id);
    const b = document.createElement('button');
    b.className = 'ditem' + (own ? '' : ' lock') + (S.r.outfit[o.slot] === o.id ? ' sel' : '');
    const isNew = own && !Rw.START_OWNED.includes(o.id) && !S.r.seen.includes(o.id);
    b.innerHTML = own ? `${o.icon}<small>${o.name}</small>${isNew ? '<i class="new">NEW</i>' : ''}` : '？';
    b.onclick = () => {
      if (!own) { AC.boing(); return; }
      AC.sparkle();
      S.r.outfit[o.slot] = o.id;
      if (!S.r.seen.includes(o.id)) S.r.seen.push(o.id);
      save();
      world.setOutfit(S.r.outfit);
      world.poke();
      if (o.id.endsWith('-none')) Voice.say('はずしたよ');
      else Voice.say(['かわいい！', 'にあうね！', 'すてき！'][Math.floor(Math.random() * 3)]);
      renderDress();
    };
    grid.appendChild(b);
  }
}
$('#dressBack').onclick = () => { AC.tap(); goHome(); };

/* ---------- 島の ものに タッチ ---------- */
world.onTapKanji = k => {
  if (screen !== 'island' || !$('#todayBtn').offsetParent) return;
  const w = word0(k);
  AC.tap();
  caption(kcap(k, w.r, w.w !== k ? w.w : ''), 2600);
  Voice.say(w.r);
};
world.onTapPunyu = () => {
  if (screen === 'island' && $('#todayBtn').offsetParent) Voice.say(['ぷにゅ！', 'えへへ', 'あそぼう！', 'かんじ かこう！'][Math.floor(Math.random() * 4)]);
};

/* ================= ずかん ================= */
function buildZukan() {
  const box = $('#zlist'); box.innerHTML = '';
  const left = Rw.newLeftToday(S.r, today());
  for (const g of GROUPS) {
    const ks = ORDER.filter(k => DATA[k].g === g.id);
    const sec = document.createElement('div'); sec.className = 'grp';
    sec.innerHTML = `<h3 style="background:${g.color}">${g.name}</h3><div class="cells"></div>`;
    const cells = sec.querySelector('.cells');
    for (const k of ks) {
      const st = Core.stars(S.kanji[k]);
      const c = document.createElement('button');
      c.className = 'cell' + (st ? ' met' : '') + (st === 3 ? ' s3' : '');
      c.innerHTML = `<span>${k}</span><span class="st">${st ? '⭐'.repeat(st) : ''}</span>`;
      c.onclick = () => {
        // まだ であっていない字は、きょうの あたらしい字の わくが あるときだけ
        if (!st && left <= 0) { AC.boing(); toast('あしたの おたのしみ！'); Voice.say('あしたの おたのしみ'); return; }
        AC.tap(); startLesson([k], 'one');
      };
      cells.appendChild(c);
    }
    box.appendChild(sec);
  }
  const cr = document.createElement('div');
  cr.className = 'credit';
  cr.innerHTML = 'かきじゅん データ: <a href="http://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> (© Ulrich Apel, CC BY-SA 3.0)';
  box.appendChild(cr);
  $('#zukanCount').textContent = `${metCount()} / 80`;
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1600); }
$('#zukanBtn').onclick = () => { AC.tap(); buildZukan(); show('zukan'); };
$('#lessonHome').onclick = $('#quizHome').onclick = $('#zukanHome').onclick = () => { AC.tap(); goHome(); };

/* ================= はじめ ================= */
islandSync();
layout();
$('#startBtn').onclick = async () => {
  AC.init(); Voice.init();
  AC.tap();
  goHome();
  if (metCount() === 0) {
    hud(false);
    caption('<span class="ck">🏝️</span><span>ここは ぷにゅの しま<small>かんじを かくと にぎやかに なるよ</small></span>');
    await Voice.say('ここは ぷにゅの しま。 まだ なにも ないね。 かんじの まほうで にぎやかに しよう！');
    hideCaption();
    hud(true);
  }
};

// テスト用：URL に ?k=山 で その字の れんしゅうから はじめる
const qk = new URLSearchParams(location.search).get('k');
if (qk && DATA[qk]) startLesson([qk], 'one');
