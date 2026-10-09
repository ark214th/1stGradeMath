/*
 * ゆめかわ かんじの しま — ごほうびの しくみ（画面に依存しない）
 * - 島に あらわれる もの／ぷにゅに かける じゅもん（字ごとの やくわり）
 * - きせかえ の いちらん と、もらえる じゅんばん
 * - プレゼントは 1日 1かいだけ（きょうの まほう を おえたとき）
 * - あたらしい字は 1日 3つまで（いっきに すすみすぎない）
 */
(function (root) {
  'use strict';

  /* ---------- 字の やくわり ----------
   * obj: 島に ものが あらわれる / spell: ぷにゅに じゅもんが かかる
   * 色の字（赤・青・白・金）は じゅもん ＋ きせかえの いろが ふえる
   */
  const SPELLS = '大小上下左右中入出立休見早正気口目耳手足力赤青白金';
  const roleOf = k => (SPELLS.includes(k) ? 'spell' : 'obj');

  /* ---------- きせかえ ---------- */
  const OUTFITS = [
    { id: 'head-none', slot: 'head', name: 'なし', icon: '・' },
    { id: 'ribbon', slot: 'head', name: 'リボン', icon: '🎀' },
    { id: 'flower', slot: 'head', name: 'はなかんむり', icon: '🌼' },
    { id: 'strawberry', slot: 'head', name: 'いちごぼうし', icon: '🍓' },
    { id: 'cloud', slot: 'head', name: 'くもぼうし', icon: '☁️' },
    { id: 'straw', slot: 'head', name: 'むぎわらぼうし', icon: '👒' },
    { id: 'witch', slot: 'head', name: 'まじょの ぼうし', icon: '🧙' },
    { id: 'starpin', slot: 'head', name: 'ほしの ピン', icon: '⭐' },
    { id: 'bunny', slot: 'head', name: 'うさみみ', icon: '🐰' },
    { id: 'tiara', slot: 'head', name: 'ティアラ', icon: '💎' },
    { id: 'crown', slot: 'head', name: 'おうかん', icon: '👑' },
    { id: 'princess', slot: 'head', name: 'おひめさまぼうし', icon: '🏰' },
    { id: 'face-none', slot: 'face', name: 'なし', icon: '・' },
    { id: 'glasses', slot: 'face', name: 'まるめがね', icon: '👓' },
    { id: 'hearts', slot: 'face', name: 'ハートめがね', icon: '💗' },
    { id: 'starcheek', slot: 'face', name: 'ほしの ほっぺ', icon: '✨' },
    { id: 'starglasses', slot: 'face', name: 'ほしめがね', icon: '🤩' },
    { id: 'hige', slot: 'face', name: 'おひげ', icon: '🥸' },
    { id: 'back-none', slot: 'back', name: 'なし', icon: '・' },
    { id: 'randoseru', slot: 'back', name: 'ランドセル', icon: '🎒' },
    { id: 'cape', slot: 'back', name: 'マント', icon: '🦸' },
    { id: 'balloon', slot: 'back', name: 'ふうせん', icon: '🎈' },
    { id: 'angel', slot: 'back', name: 'てんしの はね', icon: '🪽' },
    { id: 'butterfly', slot: 'back', name: 'ちょうちょの はね', icon: '🦋' },
    { id: 'milk', slot: 'color', name: 'ミルク', icon: '🤍', color: 0xfff4f7 },
    { id: 'pink', slot: 'color', name: 'さくら', icon: '🩷', color: 0xffc9dc },
    { id: 'mint', slot: 'color', name: 'ミント', icon: '💚', color: 0xc8f2dc },
    { id: 'sky', slot: 'color', name: 'そら', icon: '🩵', color: 0xc9e8ff },
    { id: 'lemon', slot: 'color', name: 'レモン', icon: '💛', color: 0xfff1a8 },
    { id: 'lavender', slot: 'color', name: 'ラベンダー', icon: '💜', color: 0xe2d4ff },
    { id: 'red', slot: 'color', name: 'あか', icon: '❤️', color: 0xff9a9a },
    { id: 'blue', slot: 'color', name: 'あお', icon: '💙', color: 0x9cc8ff },
    { id: 'snow', slot: 'color', name: 'しろ', icon: '⛄', color: 0xffffff },
    { id: 'gold', slot: 'color', name: 'きんいろ', icon: '🌟', color: 0xffe08a },
    { id: 'rainbow', slot: 'color', name: 'にじいろ', icon: '🌈', color: 0xffffff },
  ];
  const SLOTS = [
    { id: 'head', name: 'あたま' }, { id: 'face', name: 'かお' }, { id: 'back', name: 'せなか' }, { id: 'color', name: 'いろ' },
  ];
  const START_OWNED = ['head-none', 'face-none', 'back-none', 'milk'];
  const DEFAULT_OUTFIT = { head: 'head-none', face: 'face-none', back: 'back-none', color: 'milk' };

  // 字を おぼえると もらえる もの
  const KANJI_UNLOCK = { 赤: 'red', 青: 'blue', 白: 'snow', 金: 'gold', 王: 'crown', 花: 'flower', 学: 'randoseru' };
  // 80字 ぜんぶ
  const ALL_KANJI_UNLOCK = 'rainbow';

  // 毎日の プレゼント（1日 1こ）。スタンプ 7こごとに とくべつな もの
  const GIFT_ORDER = ['ribbon', 'glasses', 'pink', 'cape', 'starpin', 'mint', 'strawberry', 'hearts', 'balloon', 'sky', 'cloud', 'starcheek', 'witch', 'lemon', 'straw', 'hige'];
  const SPECIAL_ORDER = ['angel', 'tiara', 'butterfly', 'starglasses', 'princess', 'bunny', 'lavender'];
  const SPECIAL_EVERY = 7;

  // あたらしい字は 1日 3つまで
  const NEW_PER_DAY = 3;

  // 島が ひろがる（字の かず）
  const ISLAND_STEPS = [0, 12, 30, 55];
  const islandSize = n => ISLAND_STEPS.filter(s => n >= s).length; // 1..4

  /* ---------- きろく ---------- */
  function freshRewards() {
    return { owned: START_OWNED.slice(), outfit: Object.assign({}, DEFAULT_OUTFIT), stamps: {}, lastGift: '', skyStars: 0, newDay: { day: '', n: 0 }, seen: [] };
  }

  function normalizeRewards(raw) {
    const r = freshRewards();
    if (!raw || typeof raw !== 'object') return r;
    const ids = new Set(OUTFITS.map(o => o.id));
    if (Array.isArray(raw.owned)) for (const id of raw.owned) if (ids.has(id) && !r.owned.includes(id)) r.owned.push(id);
    if (raw.outfit && typeof raw.outfit === 'object') {
      for (const s of SLOTS) {
        const id = raw.outfit[s.id];
        const o = OUTFITS.find(x => x.id === id);
        if (o && o.slot === s.id && r.owned.includes(id)) r.outfit[s.id] = id;
      }
    }
    if (raw.stamps && typeof raw.stamps === 'object') for (const d in raw.stamps) if (/^\d{4}-\d\d-\d\d$/.test(d)) r.stamps[d] = String(raw.stamps[d]).slice(0, 2);
    r.lastGift = typeof raw.lastGift === 'string' ? raw.lastGift : '';
    r.skyStars = Math.max(0, raw.skyStars | 0);
    if (raw.newDay && typeof raw.newDay.day === 'string') r.newDay = { day: raw.newDay.day, n: Math.max(0, raw.newDay.n | 0) };
    if (Array.isArray(raw.seen)) r.seen = raw.seen.filter(id => ids.has(id));
    return r;
  }

  // きょう あと いくつ あたらしい字に であえるか
  function newLeftToday(rw, day) {
    return rw.newDay.day === day ? Math.max(0, NEW_PER_DAY - rw.newDay.n) : NEW_PER_DAY;
  }
  function countNew(rw, day) {
    if (rw.newDay.day !== day) rw.newDay = { day, n: 0 };
    rw.newDay.n++;
  }

  // 字を はじめて おぼえたとき：もらえる きせかえ（なければ null）
  function unlockForKanji(rw, k, metCount, total) {
    const got = [];
    const id = KANJI_UNLOCK[k];
    if (id && !rw.owned.includes(id)) { rw.owned.push(id); got.push(id); }
    if (total && metCount >= total && !rw.owned.includes(ALL_KANJI_UNLOCK)) { rw.owned.push(ALL_KANJI_UNLOCK); got.push(ALL_KANJI_UNLOCK); }
    return got;
  }

  // きょうの スタンプを おす（1日 1こ）。おしたら true
  function stamp(rw, day, k) {
    if (rw.stamps[day]) return false;
    rw.stamps[day] = k;
    return true;
  }
  const stampCount = rw => Object.keys(rw.stamps).length;

  // 毎日の プレゼント。1日 1かい だけ。{ type:'item', id, special } / { type:'star' } / null
  function claimGift(rw, day) {
    if (rw.lastGift === day) return null;
    rw.lastGift = day;
    const n = stampCount(rw);
    const pick = list => list.find(id => !rw.owned.includes(id));
    let id = null, special = false;
    if (n > 0 && n % SPECIAL_EVERY === 0) { id = pick(SPECIAL_ORDER); special = !!id; }
    if (!id) id = pick(GIFT_ORDER);
    if (!id) id = pick(SPECIAL_ORDER);
    if (id) { rw.owned.push(id); return { type: 'item', id, special }; }
    rw.skyStars++;
    return { type: 'star' };
  }

  const outfitById = id => OUTFITS.find(o => o.id === id) || null;

  const api = { SPELLS, roleOf, OUTFITS, SLOTS, START_OWNED, DEFAULT_OUTFIT, KANJI_UNLOCK, ALL_KANJI_UNLOCK, GIFT_ORDER, SPECIAL_ORDER, SPECIAL_EVERY, NEW_PER_DAY, ISLAND_STEPS, islandSize, freshRewards, normalizeRewards, newLeftToday, countNew, unlockForKanji, stamp, stampCount, claimGift, outfitById };
  root.KanjiRewards = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
