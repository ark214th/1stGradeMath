// ゆめかわ かんじの しま — 3D の 島と ぷにゅ
// 書いた字が 島に あらわれる（obj）／ぷにゅに じゅもんが かかる（spell）
// ぷにゅの からだと きせかえは「ぷにゅの きらきらランド」（AI_Game）から もってきた
import * as T from './vendor/three.module.min.js';

const OUTFITS = window.KanjiRewards.OUTFITS;
const STROKES = window.KANJI_STROKES;

/* ================= ざいりょう ================= */
let toonRamp = null;
function toon(color, opts = {}) {
  if (!toonRamp) {
    const data = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
    toonRamp = new T.DataTexture(data, 3, 1, T.RGBAFormat);
    toonRamp.minFilter = toonRamp.magFilter = T.NearestFilter;
    toonRamp.needsUpdate = true;
  }
  return new T.MeshToonMaterial({ color, gradientMap: toonRamp, ...opts });
}
const matCache = new Map();
const M = c => { if (!matCache.has(c)) matCache.set(c, toon(c)); return matCache.get(c); };

function starShape(outer = 0.42, inner = 0.2) {
  const s = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? inner : outer;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  return s;
}
function heartShape() {
  const s = new T.Shape();
  s.moveTo(0, -0.35);
  s.bezierCurveTo(-0.45, -0.05, -0.45, 0.35, -0.2, 0.35);
  s.bezierCurveTo(-0.08, 0.35, 0, 0.25, 0, 0.18);
  s.bezierCurveTo(0, 0.25, 0.08, 0.35, 0.2, 0.35);
  s.bezierCurveTo(0.45, 0.35, 0.45, -0.05, 0, -0.35);
  return s;
}

const G = {
  ball: new T.SphereGeometry(1, 20, 14),
  mid: new T.SphereGeometry(1, 14, 9),
  low: new T.SphereGeometry(1, 8, 6),
  cone: new T.ConeGeometry(1, 1, 10),
  cyl: new T.CylinderGeometry(1, 1, 1, 14),
  box: new T.BoxGeometry(1, 1, 1),
  star: new T.ExtrudeGeometry(starShape(), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }),
  heart: new T.ExtrudeGeometry(heartShape(), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 }),
};
G.star.center(); G.heart.center();
const STAR_MAT = toon(0xffd84a, { emissive: 0x6b4a00, emissiveIntensity: 0.35 });
const EYE_MAT = new T.MeshBasicMaterial({ color: 0x3a2a3a });
const WHITE_BASIC = new T.MeshBasicMaterial({ color: 0xffffff });

function part(parent, geo, mat, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], rot) {
  const m = new T.Mesh(geo, typeof mat === 'number' ? M(mat) : mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}

/* ---------- 絵文字・文字の スプライト ---------- */
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 2;
  texCache.set(key, t);
  return t;
}
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
function emojiSprite(ch, size = 1) {
  const tex = canvasTex('e' + ch, 128, 128, (g, w, h) => { g.font = `100px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 6); });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}
// 字の なふだ（ピンクの まる）
function tagSprite(k) {
  const tex = canvasTex('t' + k, 128, 128, (g, w) => {
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#ff9fcf'; g.stroke();
    drawKanji(g, k, 22, 22, 84, '#7a3563', 9);
  });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.62, 0.62, 1);
  s.renderOrder = 5;
  return s;
}
// 書き順データで 字を かく（フォントに たよらない）
function drawKanji(g, k, x, y, size, color, width) {
  const strokes = STROKES[k]; if (!strokes) return;
  g.save(); g.translate(x, y); g.scale(size / 109, size / 109);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = color; g.lineWidth = width;
  for (const d of strokes) g.stroke(new Path2D(d));
  g.restore();
}
// とんでいく 大きな 字
function glyphSprite(k) {
  const tex = canvasTex('g' + k, 256, 256, (g) => {
    g.shadowColor = 'rgba(255,255,255,1)'; g.shadowBlur = 18;
    drawKanji(g, k, 28, 28, 200, '#ffffff', 16);
    g.shadowBlur = 0;
    const grd = g.createLinearGradient(0, 0, 256, 256); grd.addColorStop(0, '#ff6fb3'); grd.addColorStop(.55, '#c77dff'); grd.addColorStop(1, '#5fb8ff');
    drawKanji(g, k, 28, 28, 200, grd, 9);
  });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  s.renderOrder = 10;
  return s;
}

/* ================= うごきの しくみ ================= */
const ease = {
  lin: k => k,
  out: k => 1 - (1 - k) * (1 - k),
  inout: k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  back: k => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  elastic: k => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

/* ================= 島の ばしょ ================= */
// [かくど(どう)、島の はんけいに たいする きょり]。0° が てまえ（カメラがわ）
const SPOT = {
  山: [180, .7], 川: [140, .52], 木: [40, .42], 林: [68, .64], 森: [100, .78], 竹: [122, .86], 火: [322, .34], 水: [92, .36],
  田: [212, .52], 石: [12, .72], 貝: [0, .9], 糸: [298, .56], 虫: [28, .26], 犬: [345, .22], 花: [334, .62], 草: [52, .84],
  土: [268, .34], 王: [196, .3], 玉: [236, .8], 本: [286, .24], 車: [160, .34], 名: [352, .96], 字: [244, .36], 文: [262, .6],
  音: [302, .8], 学: [222, .64], 校: [204, .82], 年: [76, .3], 生: [114, .52], 町: [158, .84], 村: [256, .82], 円: [278, .46],
  百: [30, .62], 人: [20, .5], 子: [340, .45], 女: [60, .25], 男: [300, .3], 先: [214, .7],
  一: [244, .95], 二: [253, .95], 三: [262, .95], 四: [271, .95], 五: [280, .95], 六: [289, .95], 七: [298, .95], 八: [307, .95], 九: [316, .95], 十: [325, .95],
};
const SKY = '日月雨天空夕千';
const PEOPLE = { 人: 0xffe0b8, 子: 0xfff1a8, 女: 0xffc9dc, 男: 0xc9e8ff, 先: 0xe2d4ff };

/* ================= ぷにゅ ================= */
const R0 = 0.45; // ぷにゅの はんけい
const CHEEK = toon(0xff9fb8);
function makePunyu(color = 0xfff4f7, scale = 1) {
  const root = new T.Group();
  const body = new T.Group(); root.add(body);
  const r = R0;
  const skin = toon(color);
  const ears = [], cheeks = [], eyes = [], hands = [], feet = [];
  part(body, G.ball, skin, [0, 0, 0], [r * 1.05, r, r]);
  for (const s of [-1, 1]) {
    ears.push(part(body, G.ball, skin, [s * 0.25, r * 0.85, -0.05], [0.14, 0.2, 0.12], [0, 0, -s * 0.4]));
    ears.push(part(body, G.ball, CHEEK, [s * 0.25, r * 0.86, 0.06], [0.07, 0.11, 0.05], [0, 0, -s * 0.4]));
    const eye = part(body, G.ball, EYE_MAT, [s * 0.15, 0.06, r * 0.93], [0.065, 0.09, 0.05]);
    part(eye, G.ball, WHITE_BASIC, [0.3, 0.45, 0.8], [0.38, 0.28, 0.4]);
    eyes.push(eye);
    cheeks.push(part(body, G.ball, CHEEK, [s * 0.27, -0.07, r * 0.84], [0.09, 0.055, 0.04]));
    feet.push(part(body, G.ball, toon(0xffd6e2), [s * 0.18, -r * 0.92, 0.05], [0.13, 0.08, 0.14]));
    const h = part(body, G.ball, skin, [s * r * 1.02, -0.08, 0.1], [0.1, 0.1, 0.1]); h.visible = false; hands.push(h);
  }
  const mouth = new T.Mesh(new T.TorusGeometry(0.05, 0.015, 6, 12, Math.PI), EYE_MAT); mouth.position.set(0, -0.06, r * 0.97); mouth.rotation.z = Math.PI; body.add(mouth);
  const open = part(body, G.ball, toon(0xff6f91), [0, -0.08, r * 0.95], [0.06, 0.06, 0.03]); open.visible = false;
  part(body, G.ball, skin, [0, -0.1, -r * 0.95], [0.1, 0.1, 0.1]);
  root.userData = { body, skin, ears, cheeks, eyes, hands, feet, mouth, open, flaps: [], acc: null };
  root.scale.setScalar(scale);
  return root;
}

function applyOutfit(root, o) {
  const u = root.userData;
  const item = OUTFITS.find(i => i.id === o.color);
  u.rainbow = o.color === 'rainbow';
  u.skin.color.setHex(item && item.color ? item.color : 0xfff4f7);
  if (u.acc) u.body.remove(u.acc);
  const acc = new T.Group(); u.acc = acc; u.body.add(acc);
  const r = R0;
  const put = (geo, mat, p, s, rot) => part(acc, geo, mat, p, s, rot);
  switch (o.head) {
    case 'ribbon': {
      put(G.low, 0xff5d86, [0.2, r * 0.95, 0.05], [0.14, 0.09, 0.07], [0, 0, 0.5]);
      put(G.low, 0xff5d86, [0.36, r * 0.82, 0.05], [0.14, 0.09, 0.07], [0, 0, -0.4]);
      put(G.low, 0xff3d6e, [0.28, r * 0.9, 0.08], [0.06, 0.06, 0.06]);
      break;
    }
    case 'flower': {
      const cols = [0xff8fb5, 0xffe066, 0xffffff, 0xb79cff, 0x7fd4ff];
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; put(G.low, cols[i % 5], [Math.cos(a) * 0.3, r * 0.78, Math.sin(a) * 0.3], [0.08, 0.08, 0.08]); }
      break;
    }
    case 'strawberry': {
      put(G.cone, 0xff3d6e, [0, r + 0.2, 0], [0.3, 0.42, 0.3]);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; put(G.low, 0x5bb34a, [Math.cos(a) * 0.18, r + 0.02, Math.sin(a) * 0.18], [0.12, 0.04, 0.06], [0, -a, 0]); }
      for (let i = 0; i < 4; i++) put(G.low, 0xfff3a8, [(i - 1.5) * 0.08, r + 0.12 + (i % 2) * 0.1, 0.22 - (i % 2) * 0.04], [0.02, 0.03, 0.02]);
      break;
    }
    case 'cloud': for (const [x, y, sc] of [[0, 0.2, 0.2], [-0.18, 0.12, 0.15], [0.18, 0.12, 0.15], [0.08, 0.3, 0.13]]) put(G.low, 0xffffff, [x, r + y, 0], [sc, sc * 0.8, sc]); break;
    case 'straw': {
      put(G.cyl, 0xf2d38a, [0, r * 0.88, 0], [0.5, 0.03, 0.5]);
      put(G.low, 0xf2d38a, [0, r * 0.95, 0], [0.26, 0.2, 0.26]);
      put(G.cyl, 0xff6f91, [0, r * 0.95, 0], [0.265, 0.05, 0.265]);
      break;
    }
    case 'witch': {
      put(G.cyl, 0x8a63d9, [0, r * 0.9, 0], [0.42, 0.03, 0.42]);
      put(G.cone, 0x8a63d9, [0.04, r + 0.3, -0.02], [0.24, 0.62, 0.24], [0, 0, -0.18]);
      put(G.cyl, 0xffd84a, [0, r * 0.98, 0], [0.245, 0.06, 0.245]);
      put(G.star, STAR_MAT, [0.1, r + 0.42, 0.14], [0.3, 0.3, 0.3]);
      break;
    }
    case 'crown': {
      const gold = toon(0xffd84a, { emissive: 0x6b4a00, emissiveIntensity: 0.3 });
      put(G.cyl, gold, [0, r * 0.95, 0], [0.22, 0.08, 0.22]);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; put(G.cone, gold, [Math.cos(a) * 0.18, r * 0.95 + 0.12, Math.sin(a) * 0.18], [0.06, 0.16, 0.06]); }
      put(G.low, 0xff5d86, [0, r * 0.95, 0.22], [0.05, 0.05, 0.03]);
      break;
    }
    case 'starpin': put(G.star, STAR_MAT, [0.26, r * 0.72, 0.18], [0.45, 0.45, 0.45], [0, 0, 0.3]); break;
    case 'tiara': {
      const gold = toon(0xffe08a, { emissive: 0x6b4a00, emissiveIntensity: 0.25 });
      put(new T.TorusGeometry(0.2, 0.025, 6, 20, Math.PI), gold, [0, r * 0.9, 0.08], [1, 0.6, 1], [-0.5, 0, 0]);
      for (let i = -2; i <= 2; i++) put(G.cone, gold, [i * 0.08, r * 0.9 + 0.1 - Math.abs(i) * 0.03, 0.12], [0.03, 0.1 - Math.abs(i) * 0.02, 0.03]);
      put(G.low, toon(0x7fd4ff, { emissive: 0x2f6fbf, emissiveIntensity: 0.4 }), [0, r * 0.9 + 0.05, 0.16], [0.045, 0.055, 0.03]);
      break;
    }
    case 'princess': {
      put(G.cone, 0xffa8d0, [0.05, r + 0.33, -0.02], [0.2, 0.62, 0.2], [0, 0, -0.12]);
      put(G.low, STAR_MAT, [0.12, r + 0.66, -0.02], [0.06, 0.06, 0.06]);
      put(G.low, toon(0xffffff, { transparent: true, opacity: 0.7 }), [0.2, r + 0.35, -0.12], [0.08, 0.35, 0.05], [0, 0, -0.5]);
      break;
    }
    case 'bunny': {
      for (const sx of [-1, 1]) {
        put(G.low, 0xffffff, [sx * 0.14, r + 0.3, -0.02], [0.08, 0.28, 0.06], [0, 0, -sx * 0.15]);
        put(G.low, CHEEK, [sx * 0.14, r + 0.3, 0.03], [0.04, 0.2, 0.03], [0, 0, -sx * 0.15]);
      }
      break;
    }
  }
  u.ears.forEach(e => (e.visible = !['strawberry', 'straw', 'cloud', 'bunny', 'witch'].includes(o.head)));
  switch (o.face) {
    case 'glasses': {
      const frame = M(0xff6f91), lens = toon(0xffffff, { transparent: true, opacity: 0.35 });
      for (const sx of [-1, 1]) {
        put(new T.TorusGeometry(0.09, 0.018, 6, 20), frame, [sx * 0.15, 0.07, r * 1.0]);
        put(new T.CircleGeometry(0.085, 16), lens, [sx * 0.15, 0.07, r * 1.0]);
      }
      put(G.cyl, frame, [0, 0.09, r * 1.01], [0.014, 0.06, 0.014], [0, 0, Math.PI / 2]);
      break;
    }
    case 'hearts': for (const sx of [-1, 1]) put(G.heart, toon(0xff5d86, { transparent: true, opacity: 0.85 }), [sx * 0.15, 0.07, r * 1.0], [0.28, 0.28, 0.2]); break;
    case 'starcheek': for (const sx of [-1, 1]) put(G.star, STAR_MAT, [sx * 0.27, -0.07, r * 0.9], [0.22, 0.22, 0.15]); break;
    case 'starglasses': {
      const y = toon(0xffd84a, { transparent: true, opacity: 0.8 });
      for (const sx of [-1, 1]) put(G.star, y, [sx * 0.15, 0.07, r * 1.0], [0.5, 0.5, 0.2]);
      put(G.cyl, 0xff6f91, [0, 0.09, r * 1.01], [0.014, 0.05, 0.014], [0, 0, Math.PI / 2]);
      break;
    }
    case 'hige': for (const sx of [-1, 1]) put(G.low, 0x5a3e36, [sx * 0.09, -0.02, r * 0.98], [0.1, 0.035, 0.03], [0, 0, sx * 0.25]); break;
  }
  u.flaps = [];
  switch (o.back) {
    case 'cape': {
      const cape = new T.Mesh(new T.PlaneGeometry(1.0, 0.78, 1, 4), toon(0xff4f7b, { side: T.DoubleSide }));
      cape.position.set(0, -0.12, -r * 0.95); cape.rotation.x = 0.15; acc.add(cape);
      put(G.cyl, 0xffd84a, [0, 0.22, -r * 0.55], [0.3, 0.03, 0.2]);
      u.flaps.push({ m: cape, kind: 'cape' });
      break;
    }
    case 'balloon': {
      put(G.cyl, 0xffffff, [0.2, r + 0.35, -0.25], [0.006, 0.7, 0.006], [0, 0, -0.25]);
      const b = put(G.mid, 0xff5d86, [0.36, r + 0.85, -0.3], [0.22, 0.26, 0.22]);
      u.flaps.push({ m: b, kind: 'balloon' });
      break;
    }
    case 'randoseru': {
      put(G.box, 0xff6f91, [0, 0.02, -r * 0.95], [0.5, 0.52, 0.24]);
      put(G.cyl, 0xff6f91, [0, 0.28, -r * 0.95], [0.25, 0.24, 0.12], [0, 0, Math.PI / 2]);
      put(G.box, 0xffd84a, [0, -0.02, -r * 0.95 - 0.13], [0.1, 0.1, 0.02]);
      break;
    }
    case 'angel':
    case 'butterfly': {
      const cols = o.back === 'angel' ? [0xffffff, 0xffffff] : [0xff9ad5, 0xb79cff];
      for (const sx of [-1, 1]) {
        const pivot = new T.Group(); pivot.position.set(sx * 0.12, 0.08, -r * 0.8); acc.add(pivot);
        part(pivot, G.low, o.back === 'butterfly' ? toon(cols[0], { transparent: true, opacity: 0.9 }) : M(cols[0]), [sx * 0.28, 0.08, 0], [0.32, o.back === 'angel' ? 0.2 : 0.26, 0.05]);
        part(pivot, G.low, cols[1], [sx * 0.22, -0.15, 0], [0.2, 0.14, 0.05]);
        u.flaps.push({ m: pivot, kind: 'wing', sx });
      }
      break;
    }
  }
  u.cheeks.forEach(ch => (ch.visible = o.face !== 'starcheek'));
}

/* ================= 島の もの ================= */
// それぞれ group に 形を たして、たかさ（なふだの いち）を かえす
function tree(g, x, z, s = 1, top = 0x8fdc6e) {
  part(g, G.cyl, 0xc8915e, [x, 0.45 * s, z], [0.12 * s, 0.9 * s, 0.12 * s]);
  part(g, G.mid, top, [x, 1.15 * s, z], [0.55 * s, 0.5 * s, 0.55 * s]);
  part(g, G.mid, top, [x + 0.18 * s, 1.45 * s, z + 0.05], [0.36 * s, 0.33 * s, 0.36 * s]);
  return 1.8 * s;
}
function house(g, x, z, wall, roof, s = 1, rotY = 0) {
  const h = new T.Group(); h.position.set(x, 0, z); h.rotation.y = rotY; g.add(h);
  part(h, G.box, wall, [0, 0.35 * s, 0], [0.7 * s, 0.7 * s, 0.6 * s]);
  const rf = part(h, G.cone, roof, [0, 0.95 * s, 0], [0.62 * s, 0.5 * s, 0.62 * s]); rf.geometry = new T.ConeGeometry(1, 1, 4); rf.rotation.y = Math.PI / 4;
  part(h, G.box, 0xc8915e, [0, 0.18 * s, 0.31 * s], [0.18 * s, 0.36 * s, 0.02]);
  part(h, G.box, 0xbfe9ff, [0.2 * s, 0.45 * s, 0.31 * s], [0.14 * s, 0.14 * s, 0.02]);
  return 1.3 * s;
}
function balloonBunch(g, n) {
  const cols = [0xff8fb5, 0xffe066, 0x8fd8ff, 0xb79cff, 0x9ff0d4, 0xffb08a];
  part(g, G.cyl, 0xffffff, [0, 0.35, 0], [0.04, 0.7, 0.04]);
  const bs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + n, rr = n === 1 ? 0 : 0.18 + (n > 6 ? 0.12 : 0.05);
    const y = 1.35 + (i % 3) * 0.14;
    const b = part(g, G.mid, cols[i % cols.length], [Math.cos(a) * rr, y, Math.sin(a) * rr], [0.17, 0.2, 0.17]);
    b.userData.base = y; b.userData.ph = i;
    bs.push(b);
  }
  g.userData.bob = bs;
  return 1.8 + (n > 6 ? 0.1 : 0);
}

const BUILD = {
  山(g) {
    part(g, G.cone, 0x9fd88a, [0, 1.3, 0], [1.6, 2.6, 1.6]);
    part(g, G.cone, 0x86cf7a, [-1.2, 0.85, 0.3], [1.1, 1.7, 1.1]);
    part(g, G.cone, 0x86cf7a, [1.15, 0.75, 0.2], [1.0, 1.5, 1.0]);
    part(g, G.cone, 0xffffff, [0, 2.35, 0], [0.62, 0.55, 0.62]);
    return 2.9;
  },
  川(g) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new T.Vector3(Math.sin(t * 5) * 0.5, 0.03, -1.6 + t * 3.4)); }
    const curve = new T.CatmullRomCurve3(pts);
    const geo = new T.TubeGeometry(curve, 48, 0.32, 6, false);
    const m = new T.Mesh(geo, toon(0x7fd0f5, { emissive: 0x2c7fb8, emissiveIntensity: 0.15 })); m.scale.set(1, 0.12, 1); g.add(m);
    g.userData.shimmer = m;
    return 0.6;
  },
  木(g) { return tree(g, 0, 0, 1); },
  林(g) { tree(g, -0.45, 0, 0.95); tree(g, 0.45, 0.1, 1.05, 0x7fd47a); return 2; },
  森(g) { tree(g, 0, -0.4, 1.25, 0x6fca6f); tree(g, -0.7, 0.2, 1, 0x8fdc6e); tree(g, 0.7, 0.25, 1.05, 0x7fd47a); tree(g, -0.25, 0.65, 0.85); tree(g, 0.35, 0.7, 0.8, 0x9fe08f); return 2.4; },
  竹(g) {
    for (const [x, z, h] of [[0, 0, 2], [0.3, 0.15, 1.6], [-0.25, 0.2, 1.8]]) {
      part(g, G.cyl, 0x7fcf6a, [x, h / 2, z], [0.07, h, 0.07]);
      for (let y = 0.4; y < h; y += 0.45) part(g, G.cyl, 0x5fb34f, [x, y, z], [0.085, 0.04, 0.085]);
      part(g, G.low, 0x9fe08f, [x + 0.15, h - 0.1, z], [0.25, 0.05, 0.08], [0, 0, 0.4]);
    }
    return 2.2;
  },
  火(g) {
    for (let i = 0; i < 4; i++) part(g, G.cyl, 0xb07a4f, [0, 0.08, 0], [0.06, 0.6, 0.06], [Math.PI / 2, i * Math.PI / 4, 0]);
    const f1 = part(g, G.cone, toon(0xff8a3d, { emissive: 0xff5a00, emissiveIntensity: 0.5 }), [0, 0.35, 0], [0.22, 0.5, 0.22]);
    const f2 = part(g, G.cone, toon(0xffe066, { emissive: 0xffb000, emissiveIntensity: 0.6 }), [0, 0.3, 0.02], [0.12, 0.32, 0.12]);
    g.userData.flame = [f1, f2];
    return 0.9;
  },
  水(g) {
    part(g, G.cyl, 0xd9c7a8, [0, 0.03, 0], [0.95, 0.06, 0.8]);
    const w = part(g, G.cyl, toon(0x8fd8ff, { emissive: 0x3a9fd9, emissiveIntensity: 0.2 }), [0, 0.07, 0], [0.82, 0.04, 0.68]);
    g.userData.shimmer = w;
    return 0.5;
  },
  田(g) {
    part(g, G.box, 0xb88a5a, [0, 0.04, 0], [1.6, 0.08, 1.3]);
    for (const [x, z] of [[-0.4, -0.32], [0.4, -0.32], [-0.4, 0.32], [0.4, 0.32]]) {
      part(g, G.box, 0x9fd8c8, [x, 0.09, z], [0.68, 0.03, 0.52]);
      for (let i = 0; i < 4; i++) part(g, G.cone, 0x7fcf6a, [x - 0.2 + (i % 2) * 0.4, 0.2, z - 0.12 + Math.floor(i / 2) * 0.24], [0.05, 0.25, 0.05]);
    }
    return 0.5;
  },
  石(g) { part(g, G.mid, 0xc9c2d6, [0, 0.2, 0], [0.38, 0.26, 0.32]); part(g, G.mid, 0xb5afc8, [0.38, 0.12, 0.15], [0.2, 0.14, 0.18]); part(g, G.mid, 0xd8d2e6, [-0.3, 0.1, 0.2], [0.16, 0.11, 0.14]); return 0.6; },
  貝(g) { const s = emojiSprite('🐚', 0.7); s.position.y = 0.35; g.add(s); part(g, G.cyl, 0xfff1c9, [0, 0.02, 0], [0.5, 0.04, 0.5]); return 0.9; },
  糸(g) { const s = emojiSprite('🧶', 0.7); s.position.y = 0.38; g.add(s); return 0.95; },
  虫(g) { const s = emojiSprite('🐞', 0.5); s.position.y = 0.3; g.add(s); g.userData.walker = { r: 0.6, sp: 0.6 }; return 0.7; },
  犬(g) { const s = emojiSprite('🐶', 0.75); s.position.y = 0.42; g.add(s); g.userData.follow = true; return 1; },
  花(g) {
    const cols = [0xff8fb5, 0xffe066, 0xffffff, 0xb79cff, 0xff6f91, 0x8fd8ff];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, rr = 0.15 + (i % 3) * 0.22, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      part(g, G.cyl, 0x6fbf5f, [x, 0.15, z], [0.025, 0.3, 0.025]);
      for (let p = 0; p < 5; p++) { const b = (p / 5) * Math.PI * 2; part(g, G.low, cols[i % cols.length], [x + Math.cos(b) * 0.07, 0.32, z + Math.sin(b) * 0.07], [0.06, 0.03, 0.06]); }
      part(g, G.low, 0xffd84a, [x, 0.34, z], [0.04, 0.03, 0.04]);
    }
    return 0.7;
  },
  草(g) { for (let i = 0; i < 7; i++) part(g, G.cone, i % 2 ? 0x7fcf6a : 0x9fe08f, [Math.cos(i * 2.1) * 0.35, 0.18, Math.sin(i * 2.1) * 0.3], [0.08, 0.36, 0.08], [rand(-.2, .2), 0, rand(-.2, .2)]); return 0.6; },
  土(g) {
    part(g, G.mid, 0xb88a5a, [0, 0, 0], [0.55, 0.14, 0.45]);
    part(g, G.cyl, 0x7fcf6a, [0, 0.2, 0], [0.025, 0.3, 0.025]);
    part(g, G.low, 0x9fe08f, [0.08, 0.34, 0], [0.1, 0.04, 0.06], [0, 0, 0.4]);
    part(g, G.low, 0x9fe08f, [-0.08, 0.3, 0], [0.1, 0.04, 0.06], [0, 0, -0.4]);
    return 0.6;
  },
  王(g) {
    part(g, G.box, 0xffa8d0, [0, 0.3, 0], [0.6, 0.6, 0.5]);
    part(g, G.box, 0xffa8d0, [0, 0.8, -0.2], [0.6, 0.6, 0.1]);
    part(g, G.box, 0xff6f91, [0, 0.62, 0], [0.62, 0.06, 0.52]);
    const c = emojiSprite('👑', 0.6); c.position.set(0, 1.3, 0); g.add(c); g.userData.spin = c;
    return 1.75;
  },
  玉(g) { part(g, G.cyl, 0xffe0f0, [0, 0.2, 0], [0.22, 0.4, 0.22]); const b = part(g, G.ball, toon(0xc9a8ff, { emissive: 0x8a63d9, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 }), [0, 0.68, 0], [0.3, 0.3, 0.3]); g.userData.float = b; return 1.2; },
  本(g) {
    part(g, G.box, 0xc8915e, [0, 0.25, 0], [0.7, 0.04, 0.4]);
    for (const x of [-0.3, 0.3]) part(g, G.box, 0xc8915e, [x, 0.12, 0], [0.05, 0.25, 0.35]);
    const s = emojiSprite('📖', 0.55); s.position.set(0, 0.52, 0); g.add(s);
    return 0.95;
  },
  車(g) {
    const car = new T.Group(); g.add(car);
    part(car, G.box, 0xff8fb5, [0, 0.28, 0], [0.9, 0.3, 0.5]);
    part(car, G.box, 0xffffff, [-0.05, 0.52, 0], [0.5, 0.22, 0.46]);
    part(car, G.box, 0xbfe9ff, [-0.05, 0.53, 0], [0.52, 0.16, 0.48]);
    for (const [x, z] of [[-0.28, 0.25], [0.28, 0.25], [-0.28, -0.25], [0.28, -0.25]]) part(car, G.cyl, 0x5a4a6a, [x, 0.13, z], [0.13, 0.08, 0.13], [Math.PI / 2, 0, 0]);
    car.rotation.y = Math.PI / 2;
    g.userData.drive = car;
    return 0.95;
  },
  名(g) {
    part(g, G.cyl, 0xc8915e, [-0.5, 0.45, 0], [0.05, 0.9, 0.05]);
    part(g, G.cyl, 0xc8915e, [0.5, 0.45, 0], [0.05, 0.9, 0.05]);
    const tex = canvasTex('nameboard', 256, 96, (c) => { c.fillStyle = '#fff7e8'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#7a3563'; c.font = '900 38px "Hiragino Maru Gothic ProN",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ぷにゅの しま', 128, 50); });
    const b = new T.Mesh(new T.PlaneGeometry(1.25, 0.47), new T.MeshBasicMaterial({ map: tex })); b.position.set(0, 0.8, 0.03); g.add(b);
    part(g, G.box, 0xc8915e, [0, 0.8, -0.01], [1.32, 0.54, 0.04]);
    return 1.3;
  },
  字(g) {
    part(g, G.cyl, 0xc8915e, [-0.45, 0.4, 0], [0.04, 0.8, 0.04]); part(g, G.cyl, 0xc8915e, [0.45, 0.4, 0], [0.04, 0.8, 0.04]);
    part(g, G.box, 0xc8915e, [0, 0.85, -0.01], [1.06, 0.66, 0.05]);
    const c = document.createElement('canvas'); c.width = 256; c.height = 160;
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const b = new T.Mesh(new T.PlaneGeometry(0.98, 0.6), new T.MeshBasicMaterial({ map: tex })); b.position.set(0, 0.85, 0.03); g.add(b);
    g.userData.board = { c, tex };
    return 1.3;
  },
  文(g) { part(g, G.cyl, 0xc8915e, [0, 0.35, 0], [0.04, 0.7, 0.04]); const s = emojiSprite('💌', 0.6); s.position.set(0, 0.85, 0); g.add(s); return 1.2; },
  音(g) { part(g, G.box, 0xffd0e7, [0, 0.2, 0], [0.5, 0.35, 0.4]); part(g, G.box, 0xffa8d0, [0, 0.4, -0.12], [0.5, 0.05, 0.3], [-0.6, 0, 0]); g.userData.notes = true; return 0.8; },
  学(g) { const s = emojiSprite('📚', 0.7); s.position.y = 0.36; g.add(s); return 0.9; },
  校(g) {
    part(g, G.box, 0xfff1e0, [0, 0.55, 0], [1.6, 1.1, 0.8]);
    part(g, G.box, 0xff9fc6, [0, 1.15, 0], [1.7, 0.12, 0.9]);
    part(g, G.box, 0xfff1e0, [0, 1.45, 0], [0.5, 0.6, 0.5]);
    part(g, G.cyl, 0xffffff, [0, 1.5, 0.26], [0.16, 0.02, 0.16], [Math.PI / 2, 0, 0]);
    for (const x of [-0.5, 0, 0.5]) part(g, G.box, 0xbfe9ff, [x, 0.7, 0.41], [0.26, 0.26, 0.02]);
    part(g, G.box, 0xc8915e, [0, 0.22, 0.41], [0.3, 0.44, 0.02]);
    return 2;
  },
  年(g) { const s = emojiSprite('🎂', 0.7); s.position.y = 0.4; g.add(s); part(g, G.cyl, 0xffffff, [0, 0.03, 0], [0.35, 0.05, 0.35]); return 0.95; },
  生(g) { const s = emojiSprite('🐣', 0.6); s.position.y = 0.32; g.add(s); g.userData.hop = s; return 0.8; },
  町(g) { house(g, -0.75, 0, 0xffe6f0, 0xff8fb5, 1, 0.3); house(g, 0.1, -0.35, 0xfff6d6, 0x8fd8ff, 1.15); house(g, 0.85, 0.1, 0xe8fff2, 0xb79cff, 0.9, -0.3); return 1.7; },
  村(g) {
    for (const [x, z, s] of [[-0.4, 0, 1], [0.45, 0.2, 0.85]]) {
      part(g, G.cyl, 0xf2d6a8, [x, 0.3 * s, z], [0.38 * s, 0.6 * s, 0.38 * s]);
      part(g, G.cone, 0xd9b26a, [x, 0.85 * s, z], [0.5 * s, 0.55 * s, 0.5 * s]);
    }
    return 1.3;
  },
  円(g) { const s = emojiSprite('🪙', 0.55); s.position.y = 0.3; g.add(s); const s2 = emojiSprite('🪙', 0.45); s2.position.set(0.3, 0.24, 0.1); g.add(s2); return 0.75; },
};
for (const [k, n] of [['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5], ['六', 6], ['七', 7], ['八', 8], ['九', 9], ['十', 10]]) BUILD[k] = g => balloonBunch(g, n);
for (const k in PEOPLE) BUILD[k] = (g) => {
  const scale = k === '子' ? 0.6 : 0.82;
  const p = makePunyu(PEOPLE[k], scale);
  applyOutfit(p, { head: k === '女' ? 'ribbon' : k === '男' ? 'straw' : 'head-none', face: k === '先' ? 'glasses' : 'face-none', back: 'back-none', color: 'milk' });
  p.userData.skin.color.setHex(PEOPLE[k]);
  p.position.y = R0 * scale;
  g.add(p);
  g.userData.walker = { r: 0.9, sp: 0.35, friend: p };
  return R0 * scale * 2 + 0.25;
};

/* ================= 島 ================= */
export class Island {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(34, 1, 0.5, 200);
    this.tweens = [];
    this.time = 0;
    this.paused = false;
    this.R = 5.5; this.Rtarget = 5.5;
    this.objs = new Map(); // k -> group
    this.levels = {};
    this.cam = { dist: 18, h: 7, lookY: 0.8, x: 0, focus: 0 };
    this.uz = { z: 1, zt: 1, px: 0, pz: 0, ptx: 0, ptz: 0 }; // ゆびで する ズーム
    this.spin = 0; this.spinV = 0; this.spinTarget = null;
    this.setupWorld();
    this.punyu = makePunyu();
    this.punyu.position.set(0, R0, 1.2);
    this.island.add(this.punyu);
    this.pu = { tx: 0, tz: 1.2, wait: 1, busy: false, hopT: 0, happy: 0 };
    this.outfit = null;
    this.onTapKanji = null; this.onTapPunyu = null; this.onTapGift = null;
    this.setupInput();
    canvas.addEventListener('webglcontextlost', e => e.preventDefault());
    addEventListener('resize', () => (this.needResize = true));
    this.needResize = true;
    this.last = performance.now();
    const loop = () => { requestAnimationFrame(loop); this.frame(); };
    requestAnimationFrame(loop);
  }

  setupWorld() {
    const s = this.scene;
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#ffc9e6'); grd.addColorStop(0.45, '#f1d3ff'); grd.addColorStop(0.8, '#d6ecff'); grd.addColorStop(1, '#e8fff6');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 256);
    this.skyTex = new T.CanvasTexture(c); this.skyTex.colorSpace = T.SRGBColorSpace;
    s.background = this.skyTex;
    s.fog = new T.Fog(0xf3e6ff, 40, 90);
    this.hemi = new T.HemisphereLight(0xffffff, 0xe4d4ff, 1.6); s.add(this.hemi);
    this.sun = new T.DirectionalLight(0xffffff, 1.5); this.sun.position.set(-5, 12, 9); s.add(this.sun);
    this.island = new T.Group(); s.add(this.island);
    this.base = new T.Group(); this.island.add(this.base);
    // しばふ と うらがわ（うかんでいる しま）
    part(this.base, new T.CylinderGeometry(1, 0.96, 0.4, 48), 0xa8e58f, [0, -0.2, 0], [1, 1, 1]);
    part(this.base, new T.CylinderGeometry(0.97, 0.97, 0.06, 48), 0xbdf0a4, [0, 0.0, 0], [1, 1, 1]);
    part(this.base, new T.ConeGeometry(0.96, 1.6, 12), 0xf2c9a8, [0, -1.2, 0], [1, 1, 1], [Math.PI, 0, 0]);
    part(this.base, new T.ConeGeometry(0.6, 1.0, 9), 0xe8b896, [0.25, -1.9, 0.1], [1, 1, 1], [Math.PI, 0, 0]);
    this.base.scale.set(this.R, 1, this.R);
    // かげ
    this.shadowMat = new T.MeshBasicMaterial({ color: 0x5a7a4a, transparent: true, opacity: 0.18, depthWrite: false });
    this.puShadow = new T.Mesh(new T.CircleGeometry(0.4, 20), this.shadowMat); this.puShadow.rotation.x = -Math.PI / 2; this.puShadow.position.y = 0.035; this.island.add(this.puShadow);
    // くも
    this.clouds = new T.Group(); s.add(this.clouds);
    for (let i = 0; i < 6; i++) {
      const cl = new T.Group();
      for (let j = 0; j < 3; j++) part(cl, G.mid, toon(0xffffff, { transparent: true, opacity: 0.9 }), [j * 0.9 - 0.9, (j % 2) * 0.3, 0], [0.8, 0.55, 0.6]);
      const a = (i / 6) * Math.PI * 2;
      cl.position.set(Math.cos(a) * 24, -4 + (i % 3) * 3.5, Math.sin(a) * 24 - 6);
      cl.userData.a = a; cl.userData.y = cl.position.y;
      this.clouds.add(cl);
    }
    this.sky = new T.Group(); s.add(this.sky);
    this.fx = new T.Group(); s.add(this.fx);
    this.skyStars = new T.Group(); s.add(this.skyStars);
  }

  /* ---------- 入力：ドラッグで まわす、タップで えらぶ ---------- */
  /* ---------- 入力 ----------
   * 1本ゆび：ドラッグで 島を まわす（ズーム中は 島の うえを みてまわる）／タップで えらぶ
   * 2本ゆび：つまむ・ひろげる で ズーム（ゆびの あいだを 中心に）
   * ダブルタップ：その ばしょを ズーム／もう いちど で もとに もどす
   */
  setupInput() {
    const cv = this.canvas;
    const pts = new Map();
    let down = null, pinch = null, lastTap = null, idle = false;
    const mid = () => { const a = [...pts.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; };
    cv.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { idle = false; down = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY, moved: false }; }
      else if (pts.size === 2 && this.canZoom()) { down = null; const m = mid(); pinch = { d0: Math.max(20, m.d), z0: this.uz.zt, lx: m.x, ly: m.y }; }
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) {
        const m = mid();
        this.zoomAbout(m.x, m.y, pinch.z0 * (m.d / pinch.d0));
        this.panBy(m.x - pinch.lx, m.y - pinch.ly);
        pinch.lx = m.x; pinch.ly = m.y;
        return;
      }
      if (!down || idle) return;
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
      if (!down.moved || this.lockSpin) return;
      if (this.uz.zt > 1.05) this.panBy(dx, dy);
      else { this.spin += dx * 0.008; this.spinV = dx * 0.008; }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pinch) { if (pts.size < 2) { pinch = null; idle = true; } return; } // のこった ゆびでは うごかさない
      if (!down) return;
      const d = down; down = null;
      if (d.moved || performance.now() - d.t > 600) return;
      const now = performance.now();
      // 1かいめを はなしてから 2かいめを おすまでの みじかさで みる
      if (lastTap && d.t - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40 && this.canZoom()) {
        lastTap = null;
        if (this.uz.zt > 1.3) this.resetZoom(); else this.zoomAbout(e.clientX, e.clientY, 2.4);
        return;
      }
      lastTap = { t: now, x: e.clientX, y: e.clientY };
      this.tap(e.clientX, e.clientY);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); if (this.canZoom()) this.zoomAbout(e.clientX, e.clientY, this.uz.zt * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    // Safari の ページ ズームを とめる
    document.addEventListener('gesturestart', e => e.preventDefault());
  }

  /* ---------- ズーム ---------- */
  canZoom() { return this.mode !== 'dress' && !this.gift && !this.spelling && !this.zoomLocked; }
  groundAt(x, y) {
    const r = this.canvas.getBoundingClientRect();
    const v = new T.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(v, this.camera);
    const hit = new T.Vector3();
    return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), hit) ? hit : null;
  }
  zoomAbout(x, y, z) {
    const u = this.uz, zOld = u.zt;
    z = Math.max(1, Math.min(3.2, z));
    const g = this.groundAt(x, y);
    if (g && z > zOld) { const k = 1 - zOld / z; u.ptx += (g.x - u.ptx) * k; u.ptz += (g.z - u.ptz) * k; }
    u.zt = z;
    this.clampPan();
  }
  panBy(dx, dy) {
    const u = this.uz;
    const w = this.canvas.clientWidth || innerWidth;
    const k = (2 * this.camera.position.distanceTo(this.camLook || new T.Vector3()) * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect) / w;
    u.ptx -= dx * k; u.ptz -= dy * k * 1.6;
    this.clampPan();
  }
  clampPan() {
    const u = this.uz, lim = this.R * 0.85 * (1 - 1 / u.zt), d = Math.hypot(u.ptx, u.ptz);
    if (d > lim) { u.ptx *= lim / (d || 1); u.ptz *= lim / (d || 1); }
    const on = u.zt > 1.05;
    if (on !== this.zoomOn) { this.zoomOn = on; this.onZoom && this.onZoom(on); }
  }
  resetZoom() { this.uz.zt = 1; this.clampPan(); }

  tap(x, y) {
    // プレゼントの ときは どこを タッチしても あけられる
    if (this.gift && this.onTapGift) { this.onTapGift(); return; }
    const r = this.canvas.getBoundingClientRect();
    const v = new T.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(v, this.camera);
    const targets = [this.punyu, ...this.objs.values()];
    if (this.gift) targets.unshift(this.gift);
    const hits = ray.intersectObjects(targets, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.kanji && o !== this.punyu && o !== this.gift) o = o.parent;
      if (!o) continue;
      if (o === this.gift) { this.onTapGift && this.onTapGift(); return; }
      if (o === this.punyu) { this.poke(); this.onTapPunyu && this.onTapPunyu(); return; }
      this.wiggle(o); this.onTapKanji && this.onTapKanji(o.userData.kanji); return;
    }
  }

  /* ---------- しまの ようす ---------- */
  setSize(n, animate) {
    const R = [5.5, 7, 8.6, 10][Math.max(0, Math.min(3, n - 1))];
    this.Rtarget = R;
    if (!animate) { this.R = R; this.base.scale.set(R, 1, R); this.placeAll(); }
    return R;
  }
  async growIsland(n) {
    const from = this.R, to = this.setSize(n, true);
    await this.tween(1.6, k => { this.R = lerp(from, to, k); this.base.scale.set(this.R, 1, this.R); this.placeAll(); }, ease.inout);
  }

  posOf(k) {
    const sp = SPOT[k]; if (!sp) return [0, 0];
    const a = (sp[0] * Math.PI) / 180, f = sp[1] * (this.R - 0.6);
    return [Math.sin(a) * f, Math.cos(a) * f];
  }
  placeAll() {
    for (const [k, g] of this.objs) {
      if (SKY.includes(k)) continue;
      const [x, z] = this.posOf(k);
      g.userData.home = [x, z];
      if ((!g.userData.walker && !g.userData.follow) || !g.userData.placed) g.position.set(x, 0, z);
      g.userData.placed = true;
    }
    this.placeSky();
  }

  // 字を まとめて おく（あらわれる えんしゅつ なし）
  setKanji(levels, learnedOrder) {
    this.levels = { ...levels };
    for (const k of learnedOrder) if (!this.objs.has(k) && window.KanjiRewards.roleOf(k) === 'obj') this.addObj(k);
    for (const [k, g] of this.objs) this.applyLevel(k, g);
    this.placeAll();
    this.updateBoard();
  }
  setLevel(k, lv) { this.levels[k] = lv; const g = this.objs.get(k); if (g) this.applyLevel(k, g); }

  addObj(k) {
    const g = new T.Group(); g.userData.kanji = k;
    if (SKY.includes(k)) this.buildSky(k, g);
    else {
      const h = BUILD[k] ? BUILD[k](g) : 1;
      // 向きは 島の まんなか むき（てまえの ものは カメラむき）
      const sp = SPOT[k] || [0, 0];
      g.rotation.y = (sp[0] * Math.PI) / 180 + Math.PI;
      if (g.userData.walker || g.userData.follow || g.userData.drive) g.rotation.y = 0;
      const tag = tagSprite(k); tag.position.y = h + 0.35; g.add(tag); g.userData.tag = tag;
      this.island.add(g);
    }
    if (k === '百') this.scatterFlowers(g);
    this.objs.set(k, g);
    if (k === '字') this.updateBoard();
    return g;
  }
  applyLevel(k, g) {
    const lv = this.levels[k] || 1;
    const s = SKY.includes(k) ? g.userData.skyScale || 1 : [0.85, 0.85, 1, 1.12][lv] || 1;
    g.userData.size = s;
    if (!g.userData.growing) g.scale.setScalar(s);
    if (lv >= 3 && !g.userData.kira) {
      const kira = emojiSprite('✨', 0.5); kira.position.y = (g.userData.tag ? g.userData.tag.position.y : 1) + 0.45; g.add(kira); g.userData.kira = kira;
    }
  }
  updateBoard() {
    const g = this.objs.get('字'); if (!g) return;
    const { c, tex } = g.userData.board; const x = c.getContext('2d');
    x.fillStyle = '#3f7a5a'; x.fillRect(0, 0, 256, 160);
    const ks = Object.keys(this.levels).slice(-8);
    ks.forEach((k, i) => drawKanji(x, k, 14 + (i % 4) * 60, 18 + Math.floor(i / 4) * 66, 50, '#ffffff', 9));
    tex.needsUpdate = true;
  }

  // 百：島じゅうに ちいさな 花
  scatterFlowers(g) {
    const cols = [0xff8fb5, 0xffe066, 0xffffff, 0xb79cff, 0x8fd8ff];
    const geo = new T.SphereGeometry(1, 6, 4);
    for (let c = 0; c < cols.length; c++) {
      const inst = new T.InstancedMesh(geo, M(cols[c]), 20);
      const m = new T.Matrix4();
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.92;
        m.compose(new T.Vector3(Math.cos(a) * rr, 0.06, Math.sin(a) * rr), new T.Quaternion(), new T.Vector3(0.012, 0.05, 0.012));
        inst.setMatrixAt(i, m);
      }
      this.base.add(inst); // 島と いっしょに ひろがる
      (g.userData.flowers = g.userData.flowers || []).push(inst);
    }
    g.userData.flowerTag = true;
  }

  buildSky(k, g) {
    g.userData.sky = true;
    switch (k) {
      case '日': {
        part(g, G.ball, toon(0xffe066, { emissive: 0xffb000, emissiveIntensity: 0.6 }), [0, 0, 0], [1.1, 1.1, 1.1]);
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; part(g, G.cone, toon(0xffe066, { emissive: 0xffb000, emissiveIntensity: 0.5 }), [Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0], [0.18, 0.5, 0.18], [0, 0, a - Math.PI / 2]); }
        g.userData.spinZ = true;
        break;
      }
      case '月': { const s = emojiSprite('🌙', 2.4); g.add(s); break; }
      case '雨': {
        for (const [x, y, sc] of [[0, 0, 1], [-0.9, -0.2, 0.75], [0.9, -0.15, 0.8]]) part(g, G.mid, 0xe8eefc, [x, y, 0], [sc, sc * 0.65, sc * 0.7]);
        const drops = [];
        for (let i = 0; i < 10; i++) { const d = part(g, G.low, toon(0x8fd8ff, { emissive: 0x3a9fd9, emissiveIntensity: 0.3 }), [rand(-1.1, 1.1), -1, rand(-0.3, 0.3)], [0.05, 0.12, 0.05]); d.userData.ph = Math.random(); drops.push(d); }
        g.userData.drops = drops;
        break;
      }
      case '天': {
        const st = [];
        for (let i = 0; i < 12; i++) { const s = emojiSprite('✨', rand(0.5, 0.9)); s.position.set(rand(-9, 9), rand(-1, 3), rand(-2, 2)); s.userData.ph = Math.random() * 6; g.add(s); st.push(s); }
        g.userData.twinkle = st;
        break;
      }
      case '空': {
        const cols = [0xff8fa3, 0xffb36b, 0xffe066, 0x9ee493, 0x7fd0f5, 0xa39bff];
        cols.forEach((c, i) => { const t = new T.Mesh(new T.TorusGeometry(7 - i * 0.32, 0.17, 6, 40, Math.PI), toon(c, { transparent: true, opacity: 0.85 })); g.add(t); });
        break;
      }
      case '夕': {
        for (let i = 0; i < 4; i++) part(g, G.mid, toon(i % 2 ? 0xffb8a0 : 0xffc9e6, { transparent: true, opacity: 0.85 }), [i * 2.6 - 4, (i % 2) * 0.6, 0], [1.6, 0.4, 0.5]);
        break;
      }
      case '千': {
        const st = [];
        for (let i = 0; i < 40; i++) { const s = new T.Mesh(G.star, STAR_MAT); s.scale.setScalar(rand(0.12, 0.3)); s.position.set(rand(-14, 14), rand(-2, 4), rand(-3, 3)); s.userData.ph = Math.random() * 6; g.add(s); st.push(s); }
        g.userData.twinkle = st;
        break;
      }
    }
    const tag = tagSprite(k); tag.scale.set(0.9, 0.9, 1); tag.position.y = k === '空' ? 7.4 : k === '天' || k === '千' ? 3.6 : 2.2; g.add(tag); g.userData.tag = tag;
    this.sky.add(g);
  }
  placeSky() {
    const R = this.R;
    // 島の すぐ うえ に（とおくに おくと 画面が ひろがって 島が ちいさく 見える）
    const P = { 日: [-R * 0.7, 2.6 + R * 0.1, -R * 0.62], 月: [R * 0.72, 2.8 + R * 0.1, -R * 0.62], 雨: [-R * 0.42, 3.6, -R * 0.3], 天: [0, 4.6 + R * 0.2, -R * 0.9], 空: [0, 0, -R * 0.95], 夕: [0, 2.6 + R * 0.1, -R * 1.05], 千: [0, 6 + R * 0.25, -R * 1.3] };
    const S = { 日: 0.6, 月: 0.65, 雨: 0.8, 空: (R * 0.6 + 1) / 7.4, 天: R / 9, 千: R / 10 };
    for (const [k, g] of this.objs) if (P[k]) { g.position.set(...P[k]); g.userData.skyScale = g.userData.size = S[k] || 1; if (!g.userData.growing) g.scale.setScalar(g.userData.size); }
  }
  setSkyStars(n) {
    while (this.skyStars.children.length < n) {
      const i = this.skyStars.children.length;
      const s = new T.Mesh(G.star, STAR_MAT); s.scale.setScalar(0.35);
      const a = i * 2.39996, rr = 3 + (i % 7);
      s.position.set(Math.cos(a) * rr * 1.6, 8 + Math.sin(a * 1.7) * 2, -12 + Math.sin(a) * 2);
      s.userData.ph = i;
      this.skyStars.add(s);
    }
  }

  /* ---------- きせかえ ---------- */
  setOutfit(o) { this.outfit = { ...o }; applyOutfit(this.punyu, this.outfit); }

  /* ---------- カメラ ---------- */
  // dress: きせかえの ときは ぷにゅを アップ（がめんの みぎ がわ）
  setMode(mode) {
    this.mode = mode;
    // きせかえの ときは ぷにゅ だけに する（まわりの ものが カメラの まえに こないように）
    for (const g of this.objs.values()) g.visible = mode !== 'dress';
    if (mode === 'dress') this.resetZoom();
    this.skyStars.visible = mode !== 'dress';
    if (mode === 'dress') { this.pu.busy = true; this.faceCam = true; }
    else if (mode === 'island') { this.pu.busy = false; this.faceCam = false; }
  }
  // k の ばしょが てまえに くるように まわす
  async lookAt(k, zoom = 0.75) {
    this.resetZoom();
    // そらの もの・じゅもんは まわさない
    let target = SPOT[k] && !SKY.includes(k) ? -(SPOT[k][0] * Math.PI) / 180 : this.spin;
    const cur = this.spin;
    while (target - cur > Math.PI) target -= Math.PI * 2;
    while (target - cur < -Math.PI) target += Math.PI * 2;
    const z0 = this.cam.focus;
    await this.tween(0.9, kk => { this.spin = lerp(cur, target, kk); this.cam.focus = lerp(z0, zoom, kk); }, ease.inout);
  }
  async zoomOut() { const z0 = this.cam.focus; await this.tween(0.8, k => (this.cam.focus = lerp(z0, 0, k)), ease.inout); }

  updateCamera(dt) {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    const aspect = w / h;
    const R = this.R;
    // たて・よこの どちらでも 島が おさまる きょり（iPad よこでは たてで きまる）
    const tv = Math.tan((this.camera.fov * Math.PI) / 360), th = tv * aspect;
    let dist = Math.max((R * 0.5 + 2.4) / tv, (R * 1.08) / th);
    let lookY = 0.9, height = dist * 0.42, x = 0;
    if (this.mode === 'dress') {
      const p = new T.Vector3(); this.punyu.getWorldPosition(p);
      // きせかえの パネル（がめんの ひだり はんぶん）の みぎに ぷにゅが くるように
      const d = 3.6 / Math.min(1, aspect / 1.2);
      const hw = d * Math.tan((this.camera.fov * Math.PI) / 360) * aspect;
      // たてもちでは パネルが うえ、ぷにゅは した
      const hv = hw / aspect;
      const look = p.clone().add(aspect > 1 ? new T.Vector3(-0.48 * hw, 0.15, 0) : new T.Vector3(0, 0.15 + 0.5 * hv, 0));
      const pos = look.clone().add(new T.Vector3(0, 0.75, d));
      this.camera.position.lerp(pos, Math.min(1, dt * 4));
      this.camLook.lerp(look, Math.min(1, dt * 4));
      this.camera.lookAt(this.camLook);
      return;
    }
    const f = this.cam.focus;
    dist *= 1 - f * 0.45; height *= 1 - f * 0.35;
    // ゆびの ズーム：ちかづいて、みている ばしょを ずらす
    const u = this.uz, sm = Math.min(1, dt * 10);
    u.z += (u.zt - u.z) * sm; u.px += (u.ptx - u.px) * sm; u.pz += (u.ptz - u.pz) * sm;
    dist /= u.z; height /= u.z; lookY = lookY / u.z + 0.35 * (1 - 1 / u.z);
    const pos = new T.Vector3(x + u.px, height, dist + u.pz), look = new T.Vector3(u.px, lookY + f * 0.6, f * (R * 0.55) + u.pz);
    if (!this.camLook) { this.camLook = look.clone(); this.camera.position.copy(pos); }
    this.camera.position.lerp(pos, Math.min(1, dt * 3));
    this.camLook.lerp(look, Math.min(1, dt * 3));
    this.camera.lookAt(this.camLook);
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || innerWidth), h = Math.max(1, this.canvas.clientHeight || innerHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.2e6 / (w * h)));
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.needResize = false;
  }

  /* ---------- tween ---------- */
  tween(dur, fn, e = ease.out) {
    return new Promise(res => this.tweens.push({ t: 0, dur, fn, e, res }));
  }
  wait(s) { return this.tween(s, () => {}); }

  /* ---------- まいフレーム ---------- */
  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.paused) return;
    if (this.needResize) this.resize();
    this.time += dt;
    const t = this.time;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]; tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.e(k), k);
      if (k >= 1) { this.tweens.splice(i, 1); tw.res(); }
    }
    // まわす（てを はなしたら ゆっくり とまる）
    if (!this.lockSpin) { this.spin += this.spinV; this.spinV *= 0.9; }
    this.island.rotation.y = this.spin;
    this.sky.rotation.y = 0;
    for (const cl of this.clouds.children) { cl.userData.a += dt * 0.01; cl.position.x = Math.cos(cl.userData.a) * 24; cl.position.z = Math.sin(cl.userData.a) * 24 - 6; }
    this.updatePunyu(dt, t);
    this.animateObjs(dt, t);
    for (const s of this.skyStars.children) s.rotation.z = Math.sin(t + s.userData.ph) * 0.4;
    for (const f of [...this.fx.children]) {
      const u = f.userData; u.life -= dt;
      if (u.v) { f.position.addScaledVector(u.v, dt); u.v.y -= dt * 3; }
      if (f.material) f.material.opacity = Math.max(0, Math.min(1, u.life * 2));
      if (u.life <= 0) this.fx.remove(f);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  animateObjs(dt, t) {
    // ズームしても なふだが 大きく なりすぎないように
    const ts = 1 / Math.pow(this.uz.z, 0.7);
    for (const [k, g] of this.objs) {
      const u = g.userData;
      if (u.tag) u.tag.scale.setScalar((u.sky ? 0.9 : 0.62) * ts * (1 + (u.tag.userData.pulse || 0)));
      if (u.flame) u.flame.forEach((f, i) => { f.scale.y = (i ? 0.32 : 0.5) * (1 + Math.sin(t * 12 + i * 2) * 0.15); });
      if (u.shimmer) u.shimmer.material.emissiveIntensity = 0.15 + Math.sin(t * 2) * 0.08;
      if (u.bob) u.bob.forEach(b => (b.position.y = b.userData.base + Math.sin(t * 1.6 + b.userData.ph) * 0.06));
      if (u.spin) u.spin.position.y = 1.3 + Math.sin(t * 2) * 0.06;
      if (u.float) u.float.position.y = 0.68 + Math.sin(t * 1.5) * 0.05;
      if (u.hop) u.hop.position.y = 0.32 + Math.abs(Math.sin(t * 3)) * 0.12;
      if (u.spinZ) g.rotation.z = t * 0.15;
      if (u.drops) u.drops.forEach(d => { const p = (t * 0.8 + d.userData.ph) % 1; d.position.y = -0.4 - p * 4; d.visible = p < 0.95; });
      if (u.twinkle) u.twinkle.forEach(s => { const k2 = 0.6 + Math.sin(t * 2 + s.userData.ph) * 0.4; if (s.material.opacity !== undefined && s.isSprite) s.material.opacity = k2; else s.scale.setScalar(0.2 * k2 + 0.05); });
      if (u.kira) u.kira.material.rotation = t;
      if (u.notes && Math.random() < dt * 0.8) this.note(g);
      if (u.drive) { const a = t * 0.35; const rr = this.R * 0.34; g.position.set(Math.sin(a) * rr, 0, Math.cos(a) * rr); g.rotation.y = a + Math.PI / 2; }
      if (u.walker && !u.growing) this.walk(g, dt, t);
      if (u.follow && !u.growing) {
        const p = this.punyu.position; const dx = p.x + 0.8 - g.position.x, dz = p.z + 0.3 - g.position.z, d = Math.hypot(dx, dz);
        if (d > 0.4) { g.position.x += (dx / d) * dt * 1.4; g.position.z += (dz / d) * dt * 1.4; }
        g.position.y = d > 0.4 ? Math.abs(Math.sin(t * 9)) * 0.08 : 0;
      }
    }
  }
  walk(g, dt, t) {
    const u = g.userData, w = u.walker;
    if (!w.tgt || Math.hypot(w.tgt[0] - g.position.x, w.tgt[1] - g.position.z) < 0.1) {
      const [hx, hz] = u.home || [0, 0];
      w.tgt = [hx + rand(-w.r, w.r), hz + rand(-w.r, w.r)];
      const lim = this.R - 0.8, d = Math.hypot(...w.tgt);
      if (d > lim) w.tgt = w.tgt.map(v => (v / d) * lim);
      w.pause = rand(0.5, 2.5);
    }
    if (w.pause > 0) { w.pause -= dt; if (w.friend) w.friend.position.y = R0 * w.friend.scale.y; return; }
    const dx = w.tgt[0] - g.position.x, dz = w.tgt[1] - g.position.z, d = Math.hypot(dx, dz);
    g.position.x += (dx / d) * w.sp * dt; g.position.z += (dz / d) * w.sp * dt;
    g.rotation.y = Math.atan2(dx, dz);
    if (w.friend) w.friend.position.y = R0 * w.friend.scale.y + Math.abs(Math.sin(t * 8)) * 0.06;
  }
  note(g) {
    const p = new T.Vector3(); g.getWorldPosition(p);
    const s = emojiSprite(Math.random() < 0.5 ? '🎵' : '🎶', 0.4);
    s.position.copy(p).add(new T.Vector3(rand(-0.2, 0.2), 0.9, 0));
    s.userData = { life: 1.6, v: new T.Vector3(rand(-0.2, 0.2), 1.6, 0) };
    this.fx.add(s);
  }

  /* ---------- ぷにゅ ---------- */
  updatePunyu(dt, t) {
    const P = this.punyu, u = P.userData, s = this.pu;
    const lim = Math.min(2.4, this.R * 0.4);
    if (!s.busy) {
      s.wait -= dt;
      const dx = s.tx - P.position.x, dz = s.tz - P.position.z, d = Math.hypot(dx, dz);
      if (d > 0.05 && s.wait <= 0) {
        P.position.x += (dx / d) * dt * 1.1; P.position.z += (dz / d) * dt * 1.1;
        u.body.rotation.y += (Math.atan2(dx, dz) - u.body.rotation.y) * Math.min(1, dt * 8);
        u.body.position.y = Math.abs(Math.sin(t * 10)) * 0.09;
      } else {
        if (d <= 0.05 && s.wait <= 0) { s.wait = rand(1.5, 4); const a = rand(0, Math.PI * 2), rr = rand(0, lim); s.tx = Math.sin(a) * rr; s.tz = Math.cos(a) * rr + 0.6; }
        u.body.position.y = Math.sin(t * 3) * 0.015;
        // とまっている ときは こっちを みる
        const face = -this.spin;
        u.body.rotation.y += (face - u.body.rotation.y) * Math.min(1, dt * 4);
      }
    } else if (this.faceCam) {
      const face = -this.spin + Math.sin(t * 1.1) * 0.5;
      u.body.rotation.y += (face - u.body.rotation.y) * Math.min(1, dt * 4);
      u.body.position.y = Math.abs(Math.sin(t * 3)) * 0.04;
    }
    if (s.hopT > 0) { s.hopT -= dt; const k = 1 - s.hopT / 0.5; u.body.position.y = Math.sin(k * Math.PI) * 0.6; }
    if (u.rainbow) u.skin.color.setHSL((t * 0.15) % 1, 0.75, 0.86);
    for (const f of u.flaps) {
      if (f.kind === 'wing') f.m.rotation.y = f.sx * (0.35 + Math.sin(t * 5) * 0.35);
      else if (f.kind === 'cape') f.m.rotation.x = 0.25 + Math.sin(t * 4) * 0.08;
      else f.m.position.y = R0 + 0.85 + Math.sin(t * 2.5) * 0.05;
    }
    this.puShadow.position.set(P.position.x, 0.035, P.position.z);
    this.puShadow.scale.setScalar(P.scale.x * Math.max(0.4, 1 - u.body.position.y * 0.6));
  }
  poke() {
    this.pu.hopT = 0.5;
    this.burst(this.punyu, ['💖', '✨'], 6);
  }
  hop() { this.pu.hopT = 0.5; }
  wiggle(g) {
    const s0 = g.userData.size || 1;
    this.tween(0.5, k => { g.scale.setScalar(s0 * (1 + Math.sin(k * Math.PI * 3) * 0.12 * (1 - k))); });
    if (g.userData.tag) { const tg = g.userData.tag; this.tween(0.6, k => (tg.userData.pulse = Math.sin(k * Math.PI) * 0.8)); }
  }
  burst(obj, emojis = ['✨', '💖', '⭐', '🌸'], n = 14, speed = 3) {
    const p = new T.Vector3(); obj.getWorldPosition ? obj.getWorldPosition(p) : p.copy(obj);
    for (let i = 0; i < n; i++) {
      const s = emojiSprite(emojis[i % emojis.length], rand(0.3, 0.55));
      s.position.copy(p).add(new T.Vector3(0, 0.6, 0));
      const a = rand(0, Math.PI * 2);
      s.userData = { life: rand(0.8, 1.3), v: new T.Vector3(Math.cos(a) * speed * rand(0.4, 1), rand(1.5, 3.5), Math.sin(a) * speed * rand(0.4, 1)) };
      this.fx.add(s);
    }
  }

  /* ---------- 字が とんでくる ---------- */
  async flyGlyph(k, toWorld) {
    const g = glyphSprite(k);
    const start = this.camera.position.clone().add(this.camera.getWorldDirection(new T.Vector3()).multiplyScalar(6));
    g.position.copy(start); g.scale.setScalar(0.1);
    this.scene.add(g);
    await this.tween(0.5, k2 => g.scale.setScalar(lerp(0.1, 2.4, k2)), ease.back);
    await this.wait(0.35);
    const mid = start.clone().lerp(toWorld, 0.5).add(new T.Vector3(0, 2, 0));
    await this.tween(0.75, k2 => {
      const a = start.clone().lerp(mid, k2), b = mid.clone().lerp(toWorld, k2);
      g.position.copy(a.lerp(b, k2));
      g.scale.setScalar(lerp(2.4, 0.6, k2));
      g.material.rotation = Math.sin(k2 * Math.PI) * 0.3;
    }, ease.inout);
    this.scene.remove(g);
  }

  // あたらしい字が 島に あらわれる
  async reveal(k, lv = 1) {
    this.levels[k] = lv;
    await this.lookAt(k, SKY.includes(k) ? 0.15 : 0.7);
    let g = this.objs.get(k);
    const fresh = !g;
    if (fresh) { g = this.addObj(k); this.placeAll(); if (g.userData.flowers) g.userData.flowers.forEach(f => (f.visible = false)); }
    this.applyLevel(k, g);
    const target = new T.Vector3(); g.getWorldPosition(target);
    if (g.userData.flowerTag) target.set(0, 0.5, this.R * 0.3);
    g.visible = false;
    await this.flyGlyph(k, target.clone().add(new T.Vector3(0, 0.6, 0)));
    g.visible = true;
    const s = g.userData.size || 1;
    g.userData.growing = true;
    if (g.userData.flowers) g.userData.flowers.forEach(f => (f.visible = true));
    this.burst(target, ['✨', '💖', '⭐', '🌸', '💫'], 22, 4);
    await this.tween(0.9, kk => g.scale.setScalar(Math.max(0.001, s * kk)), ease.elastic);
    g.userData.growing = false;
    this.wiggle(g);
    if (k === '字') this.updateBoard();
    this.updateBoard();
    await this.wait(0.6);
  }

  // おさらいの 字：ほしが ふえて すこし おおきく
  async levelUp(k, lv) {
    const g = this.objs.get(k); if (!g) return;
    await this.lookAt(k, SKY.includes(k) ? 0.15 : 0.6);
    const target = new T.Vector3(); g.getWorldPosition(target);
    await this.flyGlyph(k, target.clone().add(new T.Vector3(0, 0.6, 0)));
    this.setLevel(k, lv);
    this.burst(target, ['⭐', '✨'], 12, 3);
    this.wiggle(g);
    await this.wait(0.5);
  }

  /* ---------- じゅもん ---------- */
  async spell(k) {
    if (this.spelling) return;
    this.resetZoom();
    this.spelling = true;
    const P = this.punyu, u = P.userData, s = this.pu;
    s.busy = true;
    const f0 = this.cam.focus; this.tween(0.5, kk => (this.cam.focus = lerp(f0, 0.55, kk)));
    // ぷにゅを てまえに よぶ
    const from = P.position.clone(), to = new T.Vector3(0, R0, Math.min(2.2, this.R * 0.35));
    // 島の かいてんを もどして ぷにゅの まえを みる
    const sp0 = this.spin; this.lockSpin = true;
    await this.tween(0.5, kk => { P.position.lerpVectors(from, to, kk); this.spin = lerp(sp0, Math.round(sp0 / (Math.PI * 2)) * Math.PI * 2, kk); u.body.rotation.y = lerp(u.body.rotation.y, 0, kk); });
    const wp = new T.Vector3(); P.getWorldPosition(wp);
    await this.flyGlyph(k, wp.clone().add(new T.Vector3(0, 0.4, 0)));
    this.burst(P, ['✨', '💫'], 12, 2.5);
    const sc0 = P.scale.x;
    const temp = [];
    const tmp = o => { this.island.add(o); temp.push(o); return o; };
    const ex = this.spellFx[k];
    if (ex) await ex.call(this, P, u, tmp);
    for (const o of temp) this.island.remove(o);
    P.scale.setScalar(sc0); P.position.copy(to); u.body.position.set(0, 0, 0); u.body.rotation.set(0, 0, 0); u.body.scale.set(1, 1, 1);
    applyOutfit(P, this.outfit || window.KanjiRewards.DEFAULT_OUTFIT);
    this.lockSpin = false;
    s.busy = false; s.tx = to.x; s.tz = to.z; s.wait = 1.5;
    this.spelling = false;
    this.zoomOut();
  }

  /* ---------- プレゼント ---------- */
  showGift() {
    this.resetZoom();
    const g = new T.Group();
    part(g, G.box, 0xff9fd0, [0, 0.45, 0], [1.1, 0.9, 1.1]);
    part(g, G.box, 0xffffff, [0, 0.45, 0], [0.2, 0.92, 1.12]);
    part(g, G.box, 0xffffff, [0, 0.45, 0], [1.12, 0.92, 0.2]);
    const lid = new T.Group(); lid.position.y = 0.95; g.add(lid);
    part(lid, G.box, 0xff7fbf, [0, 0, 0], [1.25, 0.22, 1.25]);
    part(lid, G.box, 0xffffff, [0, 0, 0], [0.22, 0.24, 1.27]);
    part(lid, G.low, 0xffffff, [-0.22, 0.25, 0], [0.25, 0.15, 0.1], [0, 0, 0.5]);
    part(lid, G.low, 0xffffff, [0.22, 0.25, 0], [0.25, 0.15, 0.1], [0, 0, -0.5]);
    g.userData.lid = lid;
    const wp = new T.Vector3(); this.punyu.getWorldPosition(wp);
    g.position.set(wp.x + 1.3, 0, wp.z + 0.4);
    this.scene.add(g);
    this.gift = g;
    g.scale.setScalar(0.01);
    this.tween(0.6, k => g.scale.setScalar(Math.max(0.01, k)), ease.back);
    return g;
  }
  shakeGift(n) {
    const g = this.gift; if (!g) return;
    this.tween(0.35, k => { g.rotation.z = Math.sin(k * Math.PI * 4) * 0.15 * (1 - k); g.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.06 * n); });
  }
  async openGift() {
    const g = this.gift; if (!g) return;
    const lid = g.userData.lid;
    this.burst(g, ['✨', '💖', '⭐', '🎀', '🌸'], 30, 5);
    await this.tween(0.6, k => { lid.position.y = 0.95 + k * 2.5; lid.rotation.z = k * 1.2; lid.position.x = k * 1.5; });
    await this.tween(0.4, k => g.scale.setScalar(1 - k * 0.99));
    this.scene.remove(g); this.gift = null;
  }
}

/* ================= じゅもんの うごき ================= */
// this = Island。P = ぷにゅ、u = ぷにゅの からだ、tmp(o) = 一時的な もの を島に おく
Island.prototype.spellFx = {
  async 大(P) { const s = P.scale.x; await this.tween(0.8, k => P.scale.setScalar(s * (1 + k * 1.6)), ease.elastic); P.position.y = R0 * P.scale.x; await this.wait(1.4); await this.tween(0.6, k => { P.scale.setScalar(s * (2.6 - k * 1.6)); P.position.y = R0 * P.scale.x; }, ease.inout); P.position.y = R0; },
  async 小(P) { const s = P.scale.x; await this.tween(0.6, k => { P.scale.setScalar(s * (1 - k * 0.6)); P.position.y = R0 * P.scale.x; }, ease.back); await this.wait(1.5); await this.tween(0.6, k => { P.scale.setScalar(s * (0.4 + k * 0.6)); P.position.y = R0 * P.scale.x; }, ease.elastic); },
  async 上(P, u) { const bub = new T.Mesh(G.ball, new T.MeshToonMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.4, depthWrite: false })); bub.scale.setScalar(0.7); P.add(bub); await this.tween(1.4, k => (P.position.y = R0 + k * 3.2), ease.inout); await this.wait(0.8); await this.tween(1.2, k => (P.position.y = R0 + 3.2 * (1 - k)), ease.inout); P.remove(bub); },
  async 下(P, u) { await this.tween(0.5, k => u.body.scale.set(1 + k * 0.4, 1 - k * 0.55, 1 + k * 0.4)); u.body.position.y = -0.2; await this.wait(1.2); await this.tween(0.5, k => u.body.scale.set(1.4 - k * 0.4, 0.45 + k * 0.55, 1.4 - k * 0.4), ease.elastic); u.body.position.y = 0; },
  async 左(P, u) { const x0 = P.position.x; u.body.rotation.y = -Math.PI / 2; await this.tween(1.2, k => { P.position.x = x0 - k * 2.2; u.body.position.y = Math.abs(Math.sin(k * 18)) * 0.1; }, ease.lin); u.body.rotation.y = 0; await this.wait(0.6); await this.tween(0.8, k => (P.position.x = x0 - 2.2 * (1 - k)), ease.inout); },
  async 右(P, u) { const x0 = P.position.x; u.body.rotation.y = Math.PI / 2; await this.tween(1.2, k => { P.position.x = x0 + k * 2.2; u.body.position.y = Math.abs(Math.sin(k * 18)) * 0.1; }, ease.lin); u.body.rotation.y = 0; await this.wait(0.6); await this.tween(0.8, k => (P.position.x = x0 + 2.2 * (1 - k)), ease.inout); },
  async 中(P, u, tmp) {
    const box = new T.Group(); box.position.copy(P.position); box.position.y = 0; tmp(box);
    part(box, G.box, 0xffc9e6, [0, 0.3, 0], [1.1, 0.6, 1.1]);
    part(box, G.box, 0xffe0f0, [0, 0.62, 0], [1.14, 0.06, 1.14]).visible = false;
    await this.tween(0.5, k => (u.body.position.y = -k * 0.55));
    await this.wait(0.6);
    await this.tween(0.4, k => (u.body.position.y = -0.55 + k * 0.35), ease.back);
    await this.wait(1.0);
    await this.tween(0.5, k => (u.body.position.y = -0.2 + k * 0.2), ease.back);
  },
  async 入(P, u, tmp) {
    const tub = new T.Group(); tub.position.copy(P.position); tub.position.y = 0; tmp(tub);
    part(tub, G.cyl, 0xffffff, [0, 0.25, 0], [0.75, 0.5, 0.6]);
    part(tub, G.cyl, toon(0x9fe0ff, { emissive: 0x3a9fd9, emissiveIntensity: 0.2 }), [0, 0.47, 0], [0.68, 0.04, 0.54]);
    for (let i = 0; i < 6; i++) part(tub, G.low, toon(0xffffff, { transparent: true, opacity: 0.8 }), [rand(-0.5, 0.5), 0.55, rand(-0.35, 0.35)], [0.12, 0.1, 0.12]);
    await this.tween(0.6, k => (u.body.position.y = Math.sin(k * Math.PI) * 0.5 - k * 0.35));
    await this.wait(1.6);
    await this.tween(0.5, k => (u.body.position.y = -0.35 + Math.sin(k * Math.PI) * 0.7 + k * 0.35));
  },
  async 出(P, u, tmp) {
    const hole = new T.Mesh(new T.CircleGeometry(0.55, 20), M(0x7a5a46)); hole.rotation.x = -Math.PI / 2; hole.position.copy(P.position); hole.position.y = 0.04; tmp(hole);
    u.body.position.y = -1; await this.wait(0.5);
    await this.tween(0.5, k => (u.body.position.y = -1 + k * 1.6), ease.out);
    await this.tween(0.4, k => (u.body.position.y = 0.6 - k * 0.6), ease.back);
    this.burst(P, ['✨', '🌟'], 10, 2);
    await this.wait(0.8);
  },
  async 立(P, u) { await this.tween(0.6, k => u.body.scale.set(1 - k * 0.15, 1 + k * 0.7, 1 - k * 0.15), ease.back); u.body.position.y = 0.3; await this.wait(1.3); await this.tween(0.5, k => u.body.scale.set(0.85 + k * 0.15, 1.7 - k * 0.7, 0.85 + k * 0.15), ease.elastic); u.body.position.y = 0; },
  async 休(P, u) {
    await this.tween(0.6, k => { u.body.rotation.z = k * 1.2; u.body.position.y = -k * 0.12; });
    for (let i = 0; i < 3; i++) { const z = emojiSprite('💤', 0.45); const wp = new T.Vector3(); P.getWorldPosition(wp); z.position.copy(wp).add(new T.Vector3(0.3, 0.6, 0)); z.userData = { life: 1.4, v: new T.Vector3(0.3, 0.8, 0) }; this.fx.add(z); await this.wait(0.55); }
    await this.tween(0.5, k => { u.body.rotation.z = 1.2 * (1 - k); u.body.position.y = -0.12 * (1 - k); }, ease.back);
  },
  async 見(P, u) {
    const tel = emojiSprite('🔭', 0.7); tel.position.set(0.45, 0.25, 0.3); P.add(tel);
    await this.tween(2.2, k => (u.body.rotation.y = Math.sin(k * Math.PI * 2) * 1.1), ease.inout);
    P.remove(tel);
  },
  async 早(P, u) {
    const c = P.position.clone(), rr = 1.6;
    await this.tween(2.0, k => { const a = k * Math.PI * 4; P.position.set(c.x + Math.sin(a) * rr, R0, c.z - rr + Math.cos(a) * rr); u.body.rotation.y = a + Math.PI / 2; u.body.rotation.z = -0.3; if (Math.random() < 0.3) { const d = emojiSprite('💨', 0.35); const wp = new T.Vector3(); P.getWorldPosition(wp); d.position.copy(wp); d.userData = { life: 0.5, v: new T.Vector3(0, 0.3, 0) }; this.fx.add(d); } }, ease.inout);
    P.position.copy(c); u.body.rotation.z = 0;
  },
  async 正(P, u) { const o = emojiSprite('⭕', 0.9); o.position.set(0, 1.0, 0); P.add(o); for (let i = 0; i < 2; i++) await this.tween(0.45, k => (u.body.rotation.x = Math.sin(k * Math.PI) * 0.35)); await this.wait(0.8); P.remove(o); },
  async 気(P, u) { for (let i = 0; i < 3; i++) { this.pu.hopT = 0.5; this.burst(P, ['✨', '⭐'], 5, 2); await this.wait(0.55); } },
  async 口(P, u) { u.mouth.visible = false; u.open.visible = true; for (let i = 0; i < 5; i++) { this.note(P); u.open.scale.set(0.06, 0.04 + (i % 2) * 0.04, 0.03); await this.wait(0.4); } u.mouth.visible = true; u.open.visible = false; },
  async 目(P, u) { await this.tween(0.4, k => u.eyes.forEach(e => e.scale.set(0.065 * (1 + k * 0.8), 0.09 * (1 + k * 0.8), 0.05)), ease.back); this.burst(P, ['✨', '💫'], 8, 1.5); await this.wait(1.3); await this.tween(0.4, k => u.eyes.forEach(e => e.scale.set(0.065 * (1.8 - k * 0.8), 0.09 * (1.8 - k * 0.8), 0.05))); },
  async 耳(P, u) {
    const e0 = u.ears.map(e => e.scale.clone());
    u.ears.forEach(e => (e.visible = true));
    await this.tween(0.5, k => u.ears.forEach((e, i) => e.scale.set(e0[i].x, e0[i].y * (1 + k * 2.2), e0[i].z)), ease.back);
    await this.tween(1.4, k => u.ears.forEach((e, i) => (e.rotation.x = Math.sin(k * Math.PI * 6) * 0.3)));
    await this.tween(0.4, k => u.ears.forEach((e, i) => e.scale.set(e0[i].x, e0[i].y * (3.2 - k * 2.2), e0[i].z)));
    applyOutfit(P, this.outfit || window.KanjiRewards.DEFAULT_OUTFIT);
  },
  async 手(P, u) { u.hands.forEach(h => (h.visible = true)); await this.tween(1.8, k => { u.hands[1].position.y = -0.08 + Math.abs(Math.sin(k * Math.PI * 4)) * 0.35; u.hands[0].position.y = -0.08 + Math.abs(Math.sin(k * Math.PI * 4 + 1)) * 0.2; }); u.hands.forEach(h => { h.visible = false; h.position.y = -0.08; }); },
  async 足(P, u) {
    const f0 = u.feet.map(f => f.scale.clone());
    await this.tween(0.4, k => u.feet.forEach((f, i) => f.scale.set(f0[i].x * (1 + k), f0[i].y * (1 + k * 0.5), f0[i].z * (1 + k))), ease.back);
    const x0 = P.position.x;
    await this.tween(1.6, k => { P.position.x = x0 + Math.sin(k * Math.PI * 2) * 0.8; u.feet[0].position.y = -R0 * 0.92 + Math.max(0, Math.sin(k * 30)) * 0.12; u.feet[1].position.y = -R0 * 0.92 + Math.max(0, -Math.sin(k * 30)) * 0.12; }, ease.lin);
    u.feet.forEach((f, i) => { f.scale.copy(f0[i]); f.position.y = -R0 * 0.92; });
  },
  async 力(P, u, tmp) {
    const rock = part(new T.Group(), G.mid, 0xc9c2d6, [0, 0, 0], [0.6, 0.45, 0.5]);
    const holder = new T.Group(); holder.add(rock); holder.position.copy(P.position); holder.position.y = 0.4; holder.position.z += 0.5; tmp(holder);
    u.hands.forEach(h => (h.visible = true));
    await this.tween(0.8, k => { holder.position.y = 0.4 + k * 1.0; holder.position.z = P.position.z + 0.5 - k * 0.5; u.body.scale.set(1 + k * 0.1, 1 - k * 0.1, 1); });
    for (let i = 0; i < 2; i++) await this.tween(0.4, k => (holder.position.y = 1.4 + Math.sin(k * Math.PI) * 0.25));
    this.burst(P, ['💪', '✨'], 6, 2);
    await this.tween(0.5, k => (holder.position.y = 1.4 - k * 1.0));
    u.hands.forEach(h => (h.visible = false)); u.body.scale.set(1, 1, 1);
  },
};
// いろの じゅもん：その いろに かわる（きせかえにも はいる）
for (const [k, id] of [['赤', 'red'], ['青', 'blue'], ['白', 'snow'], ['金', 'gold']]) {
  Island.prototype.spellFx[k] = async function (P, u) {
    const it = OUTFITS.find(o => o.id === id);
    const c0 = u.skin.color.clone(), c1 = new T.Color(it.color);
    await this.tween(1.0, k2 => { u.skin.color.copy(c0).lerp(c1, k2); u.body.rotation.y = k2 * Math.PI * 2; }, ease.inout);
    this.burst(P, ['✨', '💖', '⭐'], 14, 3);
    await this.wait(1.2);
  };
}
