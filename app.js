'use strict';
/* Case Log — 醫美病例學習紀錄
   本機優先 (local-first)：所有資料與照片只存在這支手機的瀏覽器 (IndexedDB)。 */

// ---------- utilities ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const fmtDate = iso => iso ? iso.replace(/-/g, '/') : '';
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  cmp: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  dice: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v12M6 10l6 6 6-6M4 20h16"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 20V8M6 14l6-6 6 6M4 4h16"/></svg>',
  table: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
};

// ---------- presets ----------
const BASE = {
  category: ['肉毒', '玻尿酸', '膠原增生', '水光/皮膚', '雷射/光療', '電波/音波', '埋線', '換膚', '身體雕塑', '手術', '其他'],
  concern: ['皺紋', '凹陷/容量流失', '鬆弛', '輪廓', '斑點/色素', '肝斑', '痘疤', '痘痘', '毛孔', '泛紅/酒糟', '膚質', '多汗'],
  area: ['額頭', '眉間', '魚尾紋', '太陽穴', '淚溝', '眼下', '蘋果肌', '法令紋', '木偶紋', '唇', '鼻', '下巴', '下顎線', '咬肌', '頸部', '全臉', '身體'],
  complication: ['瘀青', '腫脹', '不對稱', '結節/硬塊', '眼瞼下垂', '血管栓塞', '感染', '反黑 PIH', '燙傷/水泡', '過敏', 'Tyndall', '移位'],
  tag: ['教科書等級', '罕見', '失敗經驗', '併發症處理', '新技術', '聯合療程', '值得發表', '病人溝通'],
};
const PHOTO_LABELS = ['術前', '術中', '術後', '其他'];
const INJECTABLE = ['肉毒', '玻尿酸', '膠原增生', '水光/皮膚', '埋線'];

// ---------- injection map (注射點位圖) ----------
// 每個標記：{ id, type:'pt'|'line', view:'front'|'profR'|'profL'|'p:<photoId>', x, y, (x2, y2), dose, unit, depth, tool, product, note }
// 座標系寬度固定 300；正面圖 x < 150 為病人右側（畫面左側）
const DEPTHS = [['皮內', '#0284c7'], ['皮下', '#16a34a'], ['肌肉', '#db2777'], ['骨膜上', '#7c3aed']];
const TOOLS = ['針', '鈍針'];
const UNITS = ['U', 'cc'];
const DOSE_PRESETS = { U: [1, 2, 2.5, 4, 5, 10], cc: [0.05, 0.1, 0.2, 0.3, 0.5, 1] };
const VIEWS = [['front', '正面'], ['profR', '右側面'], ['profL', '左側面']];
const depthColor = d => (DEPTHS.find(x => x[0] === d) || [])[1] || '#e0a800';
const fmtN = n => String(+(+n).toFixed(3));
const itemView = it => it.view || 'front';
const isPhotoView = v => String(v).startsWith('p:');
const ptLabel = p => p.dose ? fmtN(p.dose) + (p.unit || '') : '';
const splitProducts = s => String(s || '').split(/[、,，;；\/+＋\n]/).map(x => x.trim()).filter(Boolean);
function injSide(it) {
  const v = itemView(it), x = it.type === 'line' ? (it.x + it.x2) / 2 : it.x;
  if (v === 'profR') return x >= 222 ? '中' : '右';
  if (v === 'profL') return x <= 78 ? '中' : '左';
  return x < 145 ? '右' : x > 155 ? '左' : '中';
}
function injTotals(items, filter = () => true) {
  const t = {};
  for (const p of items) if (filter(p) && +p.dose) t[p.unit] = (t[p.unit] || 0) + +p.dose;
  return Object.entries(t).map(([u, v]) => fmtN(v) + ' ' + u).join(' + ');
}
function injSummary(items) {
  if (!items?.length) return '';
  const np = items.filter(i => i.type !== 'line').length, nl = items.length - np;
  const all = injTotals(items), r = injTotals(items, p => injSide(p) === '右'), l = injTotals(items, p => injSide(p) === '左'), m = injTotals(items, p => injSide(p) === '中');
  return `${[np && np + ' 點', nl && nl + ' 條線'].filter(Boolean).join('、')}${all ? '，總量 ' + all : ''}${r || l ? `（右 ${r || 0}／左 ${l || 0}${m ? '／中線 ' + m : ''}）` : ''}`;
}
function productTotals(items) {
  if (!items.some(i => i.product)) return [];
  const m = new Map();
  for (const it of items) { const k = it.product || '未指定產品'; if (!m.has(k)) m.set(k, []); m.get(k).push(it); }
  return [...m].map(([k, arr]) => [k, injTotals(arr)]).filter(([, t]) => t);
}
const productText = items => productTotals(items).map(([k, t]) => `${k} ${t}`).join('；');
const liveItems = (items, photos) => (items || []).filter(i => !isPhotoView(itemView(i)) || (photos || []).some(p => 'p:' + p.id === itemView(i)));
function usedViews(items, photos) {
  const vs = new Set(items.map(itemView));
  return [...VIEWS.map(v => v[0]), ...(photos || []).map(p => 'p:' + p.id)].filter(v => vs.has(v));
}
function viewName(view, photos) {
  const v = VIEWS.find(x => x[0] === view);
  if (v) return v[1];
  const ph = (photos || []).find(p => 'p:' + p.id === view);
  return ph ? `照片・${ph.label}${ph.date ? ' ' + fmtDate(ph.date).slice(5) : ''}` : '照片';
}
const viewH = (view, photos) => {
  if (!isPhotoView(view)) return 400;
  const ph = (photos || []).find(p => 'p:' + p.id === view);
  return Math.round(300 * (ph?.ar || 4 / 3));
};

const FACE = `<g class="face-lines" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <path class="soft" stroke-dasharray="2 4" d="M150 44V338"/>
  <path d="M150 40C95 40 70 80 68 140C66 180 70 215 78 245C88 285 110 320 130 335C140 342 160 342 170 335C190 320 212 285 222 245C230 215 234 180 232 140C230 80 205 40 150 40Z"/>
  <path class="soft" stroke-dasharray="4 4" d="M78 118C92 74 208 74 222 118"/>
  <path d="M69 150C55 145 52 170 56 185C60 200 66 205 74 204M231 150C245 145 248 170 244 185C240 200 234 205 226 204"/>
  <path d="M94 141C107 130 125 130 139 137M161 137C175 130 193 130 206 141"/>
  <path d="M100 160C110 151 128 151 137 161C128 166 110 166 100 160ZM163 161C172 151 190 151 200 160C190 166 172 166 163 161Z"/>
  <circle cx="118.5" cy="158.5" r="4.5"/><circle cx="181.5" cy="158.5" r="4.5"/>
  <path class="soft" d="M104 171C115 179 128 177 136 171M164 171C172 177 185 179 196 171"/>
  <path class="soft" d="M144 168C143 188 140 204 136 214M156 168C157 188 160 204 164 214"/>
  <path d="M132 218C135 229 143 229 150 225C157 229 165 229 168 218"/>
  <path class="soft" d="M129 222C118 238 115 255 120 270M171 222C182 238 185 255 180 270"/>
  <path d="M121 262C134 253 143 255 150 259C157 255 166 253 179 262C164 280 136 280 121 262Z"/><path d="M121 262C140 267 160 267 179 262"/>
  <path class="soft" d="M124 274C121 286 123 296 128 303M176 274C179 286 177 296 172 303"/>
  <path class="soft" d="M138 312C145 318 155 318 162 312"/>
  <path d="M113 329L108 396M187 329L192 396"/>
</g>`;
// 右側面：病人臉朝畫面右方
const PROFILE = `<g class="face-lines" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <path d="M150 40C200 40 225 70 228 115C230 135 226 145 224 150C222 156 222 160 226 168L252 220C255 228 250 232 240 232C236 233 234 236 236 240C240 247 242 252 240 258C236 262 236 263 238 266C240 272 238 278 232 282C226 288 226 292 230 300C236 310 236 322 228 330C220 338 205 342 185 342C170 342 160 350 155 365L150 396"/>
  <path d="M150 40C95 40 60 80 58 140C56 190 70 230 95 255C110 270 115 300 112 330L108 396"/>
  <path class="soft" stroke-dasharray="4 4" d="M92 92C125 66 190 64 220 96"/>
  <path d="M128 158C112 150 108 175 112 195C116 212 128 220 135 210C140 200 138 170 128 158Z"/>
  <path class="soft" d="M127 170C120 172 120 190 126 198"/>
  <path class="soft" d="M128 222C124 250 118 280 122 296C140 320 175 336 210 338"/>
  <path d="M190 145C200 140 212 140 222 146"/>
  <path d="M200 165C206 159 212 159 217 166C212 170 206 170 200 165Z"/>
  <path class="soft" d="M203 175C208 180 214 180 219 176"/>
  <path d="M233 221C229 213 238 211 245 219"/>
  <path class="soft" d="M228 228C219 240 217 255 222 268"/>
  <path class="soft" d="M165 188C182 200 200 204 213 198"/>
  <path class="soft" d="M224 264L236 265"/>
</g>`;
function viewBg(view, h, src) {
  if (view === 'front') return FACE + `<text x="16" y="24" class="side-lbl">R</text><text x="284" y="24" class="side-lbl" text-anchor="end">L</text>`;
  if (view === 'profR') return PROFILE + `<text x="16" y="24" class="side-lbl">右側面</text>`;
  if (view === 'profL') return `<g transform="translate(300 0) scale(-1 1)">${PROFILE}</g><text x="284" y="24" class="side-lbl" text-anchor="end">左側面</text>`;
  return `<image ${src ? `href="${src}"` : `data-pid="${view.slice(2)}" data-kind="full"`} x="0" y="0" width="300" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
}
function itemSVG(it) {
  const c = depthColor(it.depth);
  const lab = (x, y) => it.dose ? `<text class="dose" x="${x}" y="${y}">${esc(ptLabel(it))}</text>` : '';
  if (it.type === 'line') {
    const mx = (it.x + it.x2) / 2, my = (it.y + it.y2) / 2;
    return `<g class="it" data-id="${it.id}"><line class="hitl" x1="${it.x}" y1="${it.y}" x2="${it.x2}" y2="${it.y2}"/>
      <line x1="${it.x}" y1="${it.y}" x2="${it.x2}" y2="${it.y2}" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="${it.x}" cy="${it.y}" r="4.2" fill="#fff" stroke="${c}" stroke-width="2.4"/>${lab(mx + 6, my - 5)}</g>`;
  }
  return `<g class="it" data-id="${it.id}" transform="translate(${it.x} ${it.y})"><circle class="hit" r="12" fill="transparent"/>
    <circle r="5.5" fill="${c}" stroke="#fff" stroke-width="1.6"/>${lab(8, 3.5)}</g>`;
}
function viewSVG(view, items, photos, { src = '', cls = '' } = {}) {
  const h = viewH(view, photos);
  return `<svg class="face ${cls} ${isPhotoView(view) ? 'on-photo' : ''}" viewBox="0 0 300 ${h}" role="img" aria-label="注射點位圖：${esc(viewName(view, photos))}">
    ${viewBg(view, h, src)}<g class="pts">${items.filter(i => itemView(i) === view).map(itemSVG).join('')}</g></svg>`;
}
function injLegend(items) {
  const used = DEPTHS.filter(([d]) => items.some(p => p.depth === d));
  if (!used.length) return '';
  if (items.some(p => !p.depth)) used.push(['未標層次', depthColor('')]);
  return `<div class="legend">${used.map(([d, c]) => `<span><i style="background:${c}"></i>${d}</span>`).join('')}
    ${items.some(i => i.type === 'line') ? '<span><i class="ring"></i>線：白點＝進針點</span>' : ''}</div>`;
}
function loadInjPrefs() {
  const def = { unit: 'U', dose: 2, depth: '', tool: '', mode: 'pt' };
  try { return Object.assign(def, JSON.parse(localStorage.getItem('injPrefs') || '{}')); } catch { return def; }
}
function productChoices(first) {
  return [...new Set([...first, ...S.cases.flatMap(c => [...splitProducts(c.product), ...(c.inj || []).map(i => i.product)])].filter(Boolean))].slice(0, 12);
}
function imgSize(src) {
  return new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalHeight / im.naturalWidth); im.onerror = () => res(4 / 3); im.src = src; });
}

// 全螢幕點位編輯器
// ctx = { photos: 病例照片 meta 陣列（會補上 ar 長寬比）, src: async id => 照片網址, products: 產品選項 }
function openInjEditor(initial, ctx, onDone) {
  let items = structuredClone(initial || []);
  const photos = ctx.photos || [];
  const pref = loadInjPrefs();
  let product = ctx.products[0] || '';
  const products = [...ctx.products];
  let view = usedViews(items, photos)[0] || 'front';
  const ed = document.createElement('div');
  ed.className = 'inj-ed';
  document.body.appendChild(ed);
  document.body.style.overflow = 'hidden';
  const close = () => { ed.remove(); if (!$('.overlay')) document.body.style.overflow = ''; };
  const savePref = () => { try { localStorage.setItem('injPrefs', JSON.stringify(pref)); } catch {} };
  ed.innerHTML = `<div class="ed-top"><button class="btn sm" data-e="cancel">取消</button><b>注射點位</b><button class="btn sm primary" data-e="done">完成</button></div>
    <div class="seg ed-views" id="edViews"></div>
    <div class="ed-canvas" id="edCanvas"></div>
    <div class="ed-panel">
      <div class="ed-sum" id="edSum"></div>
      <div class="ed-row"><div class="seg ed-mode"><button data-mode="pt">● 點</button><button data-mode="line">╱ 線</button></div>
        <div class="seg ed-unit">${UNITS.map(u => `<button data-unit="${u}">${u}</button>`).join('')}</div></div>
      <div class="ed-row"><span class="ed-lbl">劑量</span><div class="hscroll" id="edDoses"></div></div>
      <div class="ed-row"><span class="ed-lbl">產品</span><div class="hscroll" id="edProd"></div></div>
      <div class="ed-row"><span class="ed-lbl">層次</span><div class="hscroll" id="edDepth">${DEPTHS.map(([d, c]) => `<button class="chip" data-depth="${d}"><i class="dot" style="background:${c}"></i>${d}</button>`).join('')}</div></div>
      <div class="ed-row"><span class="ed-lbl">工具</span><div class="chips" id="edTool">${TOOLS.map(t => `<button class="chip" data-tool="${t}">${t}</button>`).join('')}</div>
        <span style="flex:1"></span><button class="btn sm" data-e="undo">復原</button><button class="btn sm" data-e="clear">清除</button></div>
      <div class="note ed-hint" id="edHint"></div>
    </div>`;
  const canvas = $('#edCanvas', ed);
  const drawPanel = () => {
    $$('[data-unit]', ed).forEach(b => b.classList.toggle('on', b.dataset.unit === pref.unit));
    $$('[data-mode]', ed).forEach(b => b.classList.toggle('on', b.dataset.mode === pref.mode));
    const pre = DOSE_PRESETS[pref.unit], isPre = pre.includes(+pref.dose);
    $('#edDoses', ed).innerHTML = pre.map(v => `<button class="chip" data-dose="${v}" aria-pressed="${+pref.dose === v}">${v}</button>`).join('')
      + `<button class="chip add" data-dose="custom" aria-pressed="${!isPre}">${isPre ? '其他' : fmtN(pref.dose)}</button>`;
    $('#edProd', ed).innerHTML = products.map(p => `<button class="chip" data-prod="${esc(p)}" aria-pressed="${p === product}">${esc(p)}</button>`).join('')
      + `<button class="chip add" data-prod-add="1">＋ 產品</button>`;
    $$('[data-depth]', ed).forEach(b => b.setAttribute('aria-pressed', b.dataset.depth === pref.depth));
    $$('[data-tool]', ed).forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === pref.tool));
    $('#edHint', ed).textContent = pref.mode === 'line'
      ? '線模式：從進針點拖曳到終點；從已有的白色進針點拖曳可畫扇形。點一下可修改，切回「點」模式可移動。'
      : '先選劑量與產品，再點圖新增。按住可拖曳；點一下可修改或刪除。';
  };
  const drawViews = () => {
    const n = v => items.filter(i => itemView(i) === v).length;
    const nPhoto = items.filter(i => isPhotoView(itemView(i))).length;
    $('#edViews', ed).innerHTML = VIEWS.map(([v, l]) => `<button data-view="${v}" class="${view === v ? 'on' : ''}">${l.replace('面', '')}${n(v) ? `<span class="n">${n(v)}</span>` : ''}</button>`).join('')
      + `<button data-view="photo" class="${isPhotoView(view) ? 'on' : ''}">照片${nPhoto ? `<span class="n">${nPhoto}</span>` : ''}</button>`;
  };
  async function drawFace() {
    let src = '';
    if (isPhotoView(view)) {
      const ph = photos.find(p => 'p:' + p.id === view);
      src = await ctx.src(ph.id);
      if (!ph.ar) ph.ar = await imgSize(src);
    }
    canvas.innerHTML = viewSVG(view, items, photos, { src, cls: 'editing' });
    $('#edSum', ed).textContent = items.length ? '全部：' + injSummary(items) : '尚未加入點位';
    drawViews();
  }
  drawPanel(); drawFace();

  const toSvg = (svg, e) => {
    const vb = svg.viewBox.baseVal, m = svg.getScreenCTM().inverse(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: Math.round(Math.max(0, Math.min(vb.width, p.x)) * 10) / 10, y: Math.round(Math.max(0, Math.min(vb.height, p.y)) * 10) / 10 };
  };
  const newItem = extra => ({ id: uid(), type: 'pt', view, dose: pref.dose, unit: pref.unit, depth: pref.depth, tool: pref.tool, product, note: '', ...extra });
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    const svg = $('svg', canvas); if (!svg) return;
    const g = e.target.closest('.it');
    drag = { id: g?.dataset.id, g, svg, sx: e.clientX, sy: e.clientY, start: toSvg(svg, e), moved: false, tmp: null };
    // 線模式從既有進針點拖曳：以同一進針點畫新線（扇形注射）
    if (drag.id && pref.mode === 'line') { const it = items.find(i => i.id === drag.id); drag.from = { x: it.x, y: it.y }; }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.moved = true;
    const q = toSvg(drag.svg, e), dx = q.x - drag.start.x, dy = q.y - drag.start.y;
    if (drag.id && pref.mode !== 'line') {
      const it = items.find(i => i.id === drag.id);
      drag.g.setAttribute('transform', it.type === 'line' ? `translate(${dx} ${dy})` : `translate(${it.x + dx} ${it.y + dy})`);
    } else if (pref.mode === 'line') {
      if (!drag.tmp) {
        drag.tmp = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        drag.tmp.setAttribute('class', 'tmp');
        drag.tmp.setAttribute('stroke', depthColor(pref.depth));
        const f = drag.from || drag.start;
        drag.tmp.setAttribute('x1', f.x); drag.tmp.setAttribute('y1', f.y);
        $('.pts', drag.svg).appendChild(drag.tmp);
      }
      drag.tmp.setAttribute('x2', q.x); drag.tmp.setAttribute('y2', q.y);
    }
  });
  canvas.addEventListener('pointerup', e => {
    const d = drag; drag = null;
    if (!d) return;
    const q = toSvg(d.svg, e);
    if (d.id && !d.moved) { editItem(d.id); return; }
    if (d.id && pref.mode !== 'line') {
      const it = items.find(i => i.id === d.id), dx = q.x - d.start.x, dy = q.y - d.start.y;
      const r = v => Math.round(v * 10) / 10;
      it.x = r(it.x + dx); it.y = r(it.y + dy);
      if (it.type === 'line') { it.x2 = r(it.x2 + dx); it.y2 = r(it.y2 + dy); }
      drawFace(); return;
    }
    if (pref.mode === 'line') {
      const f = d.from || d.start;
      if (Math.hypot(q.x - f.x, q.y - f.y) < 8) { d.tmp?.remove(); toast('線模式：請從進針點拖曳畫線'); return; }
      items.push(newItem({ type: 'line', x: f.x, y: f.y, x2: q.x, y2: q.y }));
    } else {
      if (d.moved) return;
      items.push(newItem({ x: q.x, y: q.y }));
    }
    drawFace();
    navigator.vibrate?.(8);
  });
  canvas.addEventListener('pointercancel', () => { drag?.tmp?.remove(); drag = null; });

  function editItem(id) {
    const p = items.find(p => p.id === id);
    openSheet(`<h2>修改${p.type === 'line' ? '線' : '點位'}</h2><div class="form">
      <div class="grid2"><div class="field"><label>劑量</label><input id="pDose" type="number" inputmode="decimal" step="any" value="${esc(p.dose ?? '')}"></div>
      <div class="field"><label>單位</label><div class="seg" id="pUnit">${UNITS.map(u => `<button type="button" data-v="${u}" class="${p.unit === u ? 'on' : ''}">${u}</button>`).join('')}</div></div></div>
      <div class="field"><label>產品</label><input id="pProd" list="dl-inj-prod" value="${esc(p.product || '')}" placeholder="例：Botox、Juvederm Voluma">
        <datalist id="dl-inj-prod">${products.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="field"><label>層次</label><div class="chips" id="pDepth">${DEPTHS.map(([d, c]) => `<button type="button" class="chip" data-v="${d}" aria-pressed="${p.depth === d}"><i class="dot" style="background:${c}"></i>${d}</button>`).join('')}</div></div>
      <div class="field"><label>工具</label><div class="chips" id="pTool">${TOOLS.map(t => `<button type="button" class="chip" data-v="${t}" aria-pressed="${p.tool === t}">${t}</button>`).join('')}</div></div>
      <div class="field"><label>備註</label><input id="pNote" value="${esc(p.note)}" placeholder="例：bolus、retrograde、回抽"></div>
      <div class="btnrow"><button class="btn danger" id="pDel">刪除</button><button class="btn primary" id="pSave">儲存</button></div></div>`, (sh, closeSh) => {
      let unit = p.unit, depth = p.depth, tool = p.tool;
      sh.addEventListener('click', e => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        const grp = b.parentElement.id;
        if (grp === 'pUnit') { unit = b.dataset.v; $$('#pUnit button', sh).forEach(x => x.classList.toggle('on', x === b)); }
        if (grp === 'pDepth' || grp === 'pTool') {
          const on = b.getAttribute('aria-pressed') !== 'true';
          $$('button', b.parentElement).forEach(x => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', on);
          if (grp === 'pDepth') depth = on ? b.dataset.v : ''; else tool = on ? b.dataset.v : '';
        }
      });
      $('#pDel', sh).onclick = () => { items = items.filter(x => x.id !== id); closeSh(); drawFace(); };
      $('#pSave', sh).onclick = () => {
        const v = $('#pDose', sh).value, prod = $('#pProd', sh).value.trim();
        Object.assign(p, { dose: v === '' ? '' : +v, unit, depth, tool, product: prod, note: $('#pNote', sh).value.trim() });
        if (prod && !products.includes(prod)) { products.push(prod); drawPanel(); }
        closeSh(); drawFace();
      };
    });
  }
  async function choosePhoto() {
    if (!photos.length) { toast('請先在病例中加入照片'); return; }
    const pick = async ph => { view = 'p:' + ph.id; await drawFace(); };
    if (photos.length === 1) return pick(photos[0]);
    const urls = await Promise.all(photos.map(p => ctx.src(p.id)));
    openSheet(`<h2>選擇要標記的照片</h2><div class="pgrid">${photos.map((p, i) => `<button class="ph" data-i="${i}"><img src="${urls[i]}" alt="">
      <span class="lab">${esc(p.label)}${items.some(it => itemView(it) === 'p:' + p.id) ? ' ●' : ''}</span></button>`).join('')}</div>`, (sh, closeSh) => {
      sh.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { closeSh(); pick(photos[+b.dataset.i]); } });
    });
  }
  ed.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t || t.closest('#edCanvas')) return;
    const D = t.dataset;
    if (D.view) { if (D.view === 'photo') choosePhoto(); else { view = D.view; drawFace(); } return; }
    if (D.mode) pref.mode = D.mode;
    else if (D.unit) { pref.unit = D.unit; pref.dose = DOSE_PRESETS[D.unit][1]; }
    else if (D.dose === 'custom') { const v = parseFloat(prompt(`輸入劑量（${pref.unit}）`, pref.dose)); if (!isNaN(v) && v > 0) pref.dose = v; }
    else if (D.dose) pref.dose = +D.dose;
    else if (D.prodAdd) { const v = (prompt('產品名稱（例：Botox、Restylane Lyft）') || '').trim(); if (v) { if (!products.includes(v)) products.push(v); product = v; } }
    else if (D.prod !== undefined) product = product === D.prod ? '' : D.prod;
    else if (D.depth) pref.depth = pref.depth === D.depth ? '' : D.depth;
    else if (D.tool) pref.tool = pref.tool === D.tool ? '' : D.tool;
    else if (D.e === 'undo') { items.pop(); drawFace(); return; }
    else if (D.e === 'clear') { const here = items.filter(i => itemView(i) === view).length; if (here && confirm('清除這張圖上的所有標記？')) { items = items.filter(i => itemView(i) !== view); drawFace(); } return; }
    else if (D.e === 'cancel') { if (JSON.stringify(items) === JSON.stringify(initial || []) || confirm('放棄這次的修改？')) close(); return; }
    else if (D.e === 'done') { close(); onDone(items); return; }
    else return;
    savePref(); drawPanel();
  });
}
function injBlock(c, editable) {
  const photos = c.photos || [];
  const items = liveItems(c.inj, photos);
  if (!items.length && (!editable || !INJECTABLE.includes(c.category))) return '';
  const views = usedViews(items, photos), prods = productTotals(items), notes = items.filter(p => p.note);
  return `<div class="block"><h3>注射點位 ${editable ? `<button class="btn sm" data-act="injEditCase" data-id="${c.id}">${items.length ? '編輯' : '＋ 畫點位'}</button>` : ''}</h3>
    ${items.length ? `<div class="views ${views.length > 1 ? 'multi' : ''}">${views.map(v => `<figure>${viewSVG(v, items, photos)}<figcaption>${esc(viewName(v, photos))}</figcaption></figure>`).join('')}</div>
      <div class="injsum">${esc(injSummary(items))}</div>
      ${prods.length ? `<div class="prodsum">${prods.map(([k, t]) => `<span><b>${esc(k)}</b>${esc(t)}</span>`).join('')}</div>` : ''}
      ${injLegend(items)}
      ${notes.length ? `<ul class="injnotes">${notes.map(p => `<li><b>${p.type === 'line' ? '線 ' : ''}${esc(ptLabel(p))}</b> ${injSide(p)}${p.depth ? '・' + p.depth : ''}${p.tool ? '・' + p.tool : ''}${p.product ? '・' + esc(p.product) : ''}：${esc(p.note)}</li>`).join('')}</ul>` : ''}`
      : '<div class="note">在臉部圖或病人照片上標出施打點位與劑量，日後回顧更清楚。</div>'}</div>`;
}

const SEX = ['女', '男', '其他'];
const FITZ = ['I', 'II', 'III', 'IV', 'V', 'VI'];

// ---------- IndexedDB ----------
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('caselog', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('cases', { keyPath: 'id' });
      d.createObjectStore('photos', { keyPath: 'id' }).createIndex('caseId', 'caseId');
      d.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(stores, mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(stores, mode);
    let out;
    const r = fn(t);
    if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out);
    t.onerror = t.onabort = () => rej(t.error);
  }));
}
const idb = {
  get: (st, k) => tx(st, 'readonly', t => t.objectStore(st).get(k)),
  all: st => tx(st, 'readonly', t => t.objectStore(st).getAll()),
  put: (st, v) => tx(st, 'readwrite', t => t.objectStore(st).put(v)),
  del: (st, k) => tx(st, 'readwrite', t => t.objectStore(st).delete(k)),
};
const meta = {
  get: async (k, def) => (await idb.get('meta', k))?.value ?? def,
  set: (k, value) => idb.put('meta', { key: k, value }),
};

// ---------- state ----------
const S = {
  cases: [],
  custom: { category: [], concern: [], area: [], complication: [], tag: [] },
  filter: { q: '', seg: 'all', cat: '' },
  pearlQ: '', pearlCat: '',
  lastBackup: null,
  urls: new Map(), // photoId|kind -> objectURL
};
const presets = f => [...new Set([...(BASE[f] || []), ...(S.custom[f] || [])])];
const byId = id => S.cases.find(c => c.id === id);
const isDue = c => c.status !== 'done' && c.nextFU && c.nextFU <= today();
const isSoon = c => c.status !== 'done' && c.nextFU && c.nextFU > today() && c.nextFU <= addDays(today(), 7);

// ---------- photos ----------
function loadImg(blob) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(blob), im = new Image();
    im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('無法讀取圖片')); };
    im.src = u;
  });
}
function resize(im, max, q) {
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', q));
}
// 重新編碼：壓縮檔案、同時移除 EXIF（含 GPS 位置）
async function processPhoto(file) {
  const im = await loadImg(file);
  const [blob, thumb] = await Promise.all([resize(im, 1800, 0.85), resize(im, 360, 0.75)]);
  return { blob, thumb, ar: im.naturalHeight / im.naturalWidth };
}
async function photoURL(id, kind = 'thumb') {
  const key = id + '|' + kind;
  if (S.urls.has(key)) return S.urls.get(key);
  const rec = await idb.get('photos', id);
  if (!rec) return '';
  const u = URL.createObjectURL(kind === 'full' ? rec.blob : rec.thumb);
  S.urls.set(key, u);
  return u;
}
async function hydrate(root = document) {
  for (const im of $$('img[data-pid], image[data-pid]', root)) {
    const svgImg = im.tagName.toLowerCase() === 'image';
    if (svgImg ? im.getAttribute('href') : im.src) continue;
    const u = await photoURL(im.dataset.pid, im.dataset.kind || 'thumb');
    if (u) svgImg ? im.setAttribute('href', u) : (im.src = u);
  }
}
function forgetPhoto(id) {
  for (const k of ['thumb', 'full']) { const key = id + '|' + k; if (S.urls.has(key)) { URL.revokeObjectURL(S.urls.get(key)); S.urls.delete(key); } }
}

// ---------- persistence ----------
async function loadAll() {
  S.cases = await idb.all('cases');
  S.custom = Object.assign(S.custom, await meta.get('custom', {}));
  S.lastBackup = await meta.get('lastBackup', null);
}
async function saveCase(c) {
  c.updatedAt = Date.now();
  await idb.put('cases', c);
  const i = S.cases.findIndex(x => x.id === c.id);
  if (i >= 0) S.cases[i] = c; else S.cases.push(c);
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
async function deleteCase(c) {
  for (const p of c.photos || []) { forgetPhoto(p.id); await idb.del('photos', p.id); }
  await idb.del('cases', c.id);
  S.cases = S.cases.filter(x => x.id !== c.id);
}
async function addCustom(field, val) {
  if (!val || presets(field).includes(val)) return;
  S.custom[field] = [...(S.custom[field] || []), val];
  await meta.set('custom', S.custom);
}

// ---------- UI helpers ----------
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
function header(title, { back = false, right = '', small = false } = {}) {
  return `<header class="top">${back ? `<button class="iconbtn" data-act="back" aria-label="返回">${ICON.back}</button>` : ''}
  <h1 class="${small ? 'sm' : ''}">${esc(title)}</h1>${right}</header>`;
}
function chipGroup(field, selected, { single = false, options = null, add = true } = {}) {
  const opts = options || presets(field);
  const sel = new Set([].concat(selected || []));
  const extra = [...sel].filter(v => v && !opts.includes(v));
  return `<div class="chips" data-field="${field}" data-single="${single ? 1 : ''}">${[...opts, ...extra].map(o =>
    `<button type="button" class="chip" data-act="chip" data-val="${esc(o)}" aria-pressed="${sel.has(o)}">${esc(o)}</button>`).join('')}
    ${add ? `<button type="button" class="chip add" data-act="chipAdd">＋ 自訂</button>` : ''}</div>`;
}
function starsInput(field, val) {
  return `<div class="stars" data-field="${field}">${[1, 2, 3, 4, 5].map(n =>
    `<button type="button" data-act="star" data-val="${n}" class="${n <= (val || 0) ? 'on' : ''}" aria-label="${n} 星">★</button>`).join('')}</div>`;
}
const starsText = n => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
function openSheet(html, onMount) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  function close() { ov.remove(); if (!$('.overlay')) document.body.style.overflow = ''; }
  onMount?.(ov.firstElementChild, close);
  return close;
}
function pickPhotos() {
  return new Promise(res => {
    const inp = $('#photoInput');
    inp.value = '';
    inp.onchange = () => res([...inp.files]);
    inp.click();
  });
}
async function filesToPhotos(files, label, date) {
  const out = [];
  if (files.length) toast(`處理 ${files.length} 張照片中…`);
  for (const f of files) {
    try {
      const { blob, thumb, ar } = await processPhoto(f);
      out.push({ id: uid(), label, date, blob, thumb, ar, url: URL.createObjectURL(thumb) });
    } catch (e) { toast('有照片無法讀取（HEIC 請改用「最相容」格式）'); }
  }
  return out;
}
function caseThumb(c) {
  const p = (c.photos || []).find(p => p.label === '術前') || (c.photos || [])[0];
  return p ? `<div class="thumb"><img data-pid="${p.id}" alt=""></div>` : `<div class="thumb">${ICON.img}</div>`;
}

// ---------- router ----------
const routes = { '': viewHome, pearls: viewPearls, stats: viewStats, settings: viewSettings, new: viewForm, edit: viewForm, case: viewCase, compare: viewCompare };
let leaveGuard = null;
let lastHash = location.hash;
function render() {
  if (leaveGuard && !leaveGuard()) { history.replaceState(null, '', lastHash || '#/'); return; }
  leaveGuard = null;
  lastHash = location.hash;
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const view = routes[name] || viewHome;
  document.body.classList.toggle('hide-tabs', ['new', 'edit', 'compare'].includes(name));
  $$('#tabbar a[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === (name || 'home')));
  const scrollKey = 'scroll:' + location.hash;
  $('#view').onclick = null;
  $$('.overlay,.viewer,.inj-ed').forEach(o => o.remove()); document.body.style.overflow = '';
  view(arg ? decodeURIComponent(arg) : undefined);
  hydrate($('#view'));
  window.scrollTo(0, +sessionStorage.getItem(scrollKey) || 0);
}
window.addEventListener('scroll', () => { try { sessionStorage.setItem('scroll:' + location.hash, scrollY); } catch {} }, { passive: true });
window.addEventListener('hashchange', render);
const go = h => { location.hash = h; };
function back(fallback = '#/') { if (history.length > 1) history.back(); else go(fallback); }

// ---------- views: home ----------
function filteredCases() {
  const { q, seg, cat } = S.filter;
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return S.cases.filter(c => {
    if (cat && c.category !== cat) return false;
    if (seg === 'due' && !(isDue(c) || isSoon(c))) return false;
    if (seg === 'star' && !c.starred) return false;
    if (seg === 'cx' && !(c.complications || []).length) return false;
    if (!terms.length) return true;
    const hay = [c.title, c.code, c.category, c.product, c.dose, c.technique, c.pearl, c.differently, c.cxNote, c.notes, c.refs,
      ...(c.tags || []), ...(c.areas || []), ...(c.concerns || []), ...(c.complications || []), ...(c.followups || []).map(f => f.note)]
      .join(' ').toLowerCase();
    return terms.every(t => hay.includes(t));
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
}
function caseCard(c) {
  const meta = [fmtDate(c.date), c.code, [c.age && c.age + '歲', c.sex].filter(Boolean).join(''), (c.areas || []).join('、')].filter(Boolean).join(' · ');
  const badges = [
    c.category && `<span class="tag cat">${esc(c.category)}</span>`,
    isDue(c) && `<span class="tag warn">該回診 ${fmtDate(c.nextFU).slice(5)}</span>`,
    isSoon(c) && `<span class="tag">回診 ${fmtDate(c.nextFU).slice(5)}</span>`,
    (c.complications || []).length && `<span class="tag warn">併發症</span>`,
    c.pearl && `<span class="tag" style="color:var(--pearl);background:var(--pearl-soft)">💡</span>`,
    c.status === 'done' && `<span class="tag ok">已結案</span>`,
    ...(c.tags || []).slice(0, 2).map(t => `<span class="tag">#${esc(t)}</span>`),
  ].filter(Boolean).join('');
  return `<a class="card case" href="#/case/${c.id}">${caseThumb(c)}<div class="body">
    <div class="t">${c.starred ? '<span class="star-ic">★</span> ' : ''}${esc(c.title)}</div>
    <div class="m">${esc(meta)}</div><div class="row">${badges}</div></div></a>`;
}
function viewHome() {
  const f = S.filter;
  const due = S.cases.filter(c => isDue(c) || isSoon(c)).length;
  const dueNow = S.cases.filter(isDue).length;
  const list = filteredCases();
  const cats = presets('category').filter(cat => S.cases.some(c => c.category === cat));
  const needBackup = S.cases.length >= 3 && (!S.lastBackup || Date.now() - S.lastBackup > 14 * 864e5);
  $('#view').innerHTML = `${header('Case Log')}
  <div class="search">${ICON.search}<input type="search" id="q" placeholder="搜尋標題、產品、部位、心得、#標籤…" value="${esc(f.q)}" enterkeyhint="search"></div>
  <div class="seg" role="tablist">
    ${[['all', '全部'], ['due', '追蹤' + (due ? `<span class="n">${due}</span>` : '')], ['star', '★ 收藏'], ['cx', '併發症']]
      .map(([k, l]) => `<button data-act="seg" data-val="${k}" class="${f.seg === k ? 'on' : ''}">${l}</button>`).join('')}
  </div>
  ${cats.length > 1 ? `<div class="hscroll">${['', ...cats].map(cat =>
    `<button class="chip" data-act="cat" data-val="${esc(cat)}" aria-pressed="${f.cat === cat}">${cat ? esc(cat) : '所有類別'}</button>`).join('')}</div>` : ''}
  ${dueNow && f.seg !== 'due' ? `<button class="banner warn" data-act="seg" data-val="due" style="width:100%">${ICON.cal}<span><b>${dueNow}</b> 個病例已到回診追蹤日，記得拍術後照</span></button>` : ''}
  ${needBackup ? `<a class="banner info" href="#/settings">${ICON.shield}<span>資料只存在這支手機，建議<b>定期備份</b>（${S.lastBackup ? '上次 ' + new Date(S.lastBackup).toLocaleDateString() : '尚未備份'}）</span></a>` : ''}
  <div class="list" id="list">${list.map(caseCard).join('') || emptyHome()}</div>`;
  const q = $('#q');
  q.addEventListener('input', () => {
    f.q = q.value;
    $('#list').innerHTML = filteredCases().map(caseCard).join('') || emptyHome();
    hydrate($('#list'));
  });
}
function emptyHome() {
  if (!S.cases.length) return `<div class="empty"><div class="big">🗂️</div><div>還沒有病例</div>
    <div class="note">遇到值得學習的 case，按下方 ＋ 花 30 秒記下來。<br>只有「標題」是必填，其他都可以之後補。</div>
    <a class="btn primary" href="#/new">${ICON.plus}新增第一個病例</a></div>`;
  return `<div class="empty"><div class="big">🔍</div>找不到符合的病例</div>`;
}

// ---------- views: case detail ----------
function viewCase(id) {
  const c = byId(id);
  if (!c) { $('#view').innerHTML = header('找不到病例', { back: true }) + `<div class="empty">這個病例可能已被刪除</div>`; return; }
  const photos = c.photos || [];
  const kv = [
    ['病人', [c.code, c.age && c.age + ' 歲', c.sex, c.fitz && 'Fitzpatrick ' + c.fitz].filter(Boolean).join(' · ')],
    ['主訴', (c.concerns || []).join('、')],
    ['部位', (c.areas || []).join('、')],
    ['產品', c.product], ['劑量', c.dose], ['技術/參數', c.technique],
    ['效果', starsText(c.outcome)],
  ].filter(([, v]) => v);
  const fus = [...(c.followups || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const d0 = c.date;
  $('#view').innerHTML = `${header('', {
    back: true, right: `<button class="iconbtn ${c.starred ? 'on' : ''}" data-act="toggleStar" data-id="${c.id}" aria-label="收藏">${ICON.star}</button>
    <a class="iconbtn" href="#/edit/${c.id}" aria-label="編輯">${ICON.edit}</a>` })}
  <div class="dhead"><div class="row chips">${c.category ? `<span class="tag cat">${esc(c.category)}</span>` : ''}
    ${c.status === 'done' ? '<span class="tag ok">已結案</span>' : '<span class="tag">追蹤中</span>'}
    ${isDue(c) ? `<span class="tag warn">該回診了</span>` : ''}</div>
    <h2>${esc(c.title)}</h2><div class="m">${fmtDate(c.date)}${c.nextFU && c.status !== 'done' ? ` · 下次回診 ${fmtDate(c.nextFU)}` : ''}</div></div>
  ${photos.length ? `<div class="gallery">${photos.map((p, i) => `<button class="ph" data-act="view" data-id="${c.id}" data-i="${i}">
    <img data-pid="${p.id}" alt=""><span class="lab">${esc(p.label)}${p.date ? ' · ' + fmtDate(p.date).slice(5) : ''}</span></button>`).join('')}</div><div style="height:12px"></div>` : ''}
  <div class="actions">
    <button class="btn" data-act="addFU" data-id="${c.id}">${ICON.cal}新增回診</button>
    <button class="btn" data-act="go" data-href="#/compare/${c.id}" ${photos.length < 2 ? 'disabled style="opacity:.45"' : ''}>${ICON.cmp}前後比較</button>
    <button class="btn" data-act="copySummary" data-id="${c.id}">${ICON.copy}複製摘要</button>
  </div>
  ${c.pearl ? `<div class="block pearl"><h3>💡 學習重點 PEARL</h3><p>${esc(c.pearl)}</p></div>` : ''}
  ${c.differently ? `<div class="block"><h3>下次我會怎麼做</h3><p class="text">${esc(c.differently)}</p></div>` : ''}
  ${kv.length ? `<div class="block"><h3>病例資料</h3><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>` : ''}
  ${injBlock(c, true)}
  ${(c.complications || []).length || c.cxNote ? `<div class="block" style="border-color:var(--warn)"><h3 style="color:var(--warn)">併發症與處理</h3>
    ${(c.complications || []).length ? `<div class="chips" style="margin-bottom:8px">${c.complications.map(x => `<span class="tag warn">${esc(x)}</span>`).join('')}</div>` : ''}
    ${c.cxNote ? `<p class="text">${esc(c.cxNote)}</p>` : ''}</div>` : ''}
  ${c.notes ? `<div class="block"><h3>筆記</h3><p class="text">${esc(c.notes)}</p></div>` : ''}
  <div class="block"><h3>回診追蹤 <button class="btn sm" data-act="addFU" data-id="${c.id}">＋ 新增</button></h3>
    ${fus.length ? `<div class="tl">${fus.map(f => {
      const ph = photos.filter(p => p.fuId === f.id);
      return `<div class="tli"><div class="d"><span>${fmtDate(f.date)}${d0 ? ` · 術後第 ${daysBetween(d0, f.date)} 天` : ''}</span>
        <button class="btn sm" style="min-height:28px;background:none;color:var(--muted)" data-act="delFU" data-id="${c.id}" data-fu="${f.id}">刪除</button></div>
        ${f.note ? `<p class="text">${esc(f.note)}</p>` : ''}
        ${ph.length ? `<div class="pgrid">${ph.map(p => `<button class="ph" data-act="view" data-id="${c.id}" data-i="${photos.indexOf(p)}"><img data-pid="${p.id}" alt=""></button>`).join('')}</div>` : ''}</div>`;
    }).join('')}</div>` : '<div class="note">還沒有回診紀錄。回診時按「新增回診」拍照記錄變化。</div>'}
  </div>
  ${c.refs ? `<div class="block"><h3>參考資料</h3><p class="text">${linkify(c.refs)}</p></div>` : ''}
  ${(c.tags || []).length ? `<div class="chips" style="margin-bottom:12px">${c.tags.map(t => `<button class="tag" data-act="searchTag" data-val="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
  <button class="btn danger block" data-act="delCase" data-id="${c.id}">${ICON.trash}刪除病例</button>`;
}
function linkify(s) {
  return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
function summaryText(c) {
  return [
    `【${c.category || '病例'}】${c.title}`,
    `日期：${fmtDate(c.date)}`,
    (c.age || c.sex || c.fitz) && `病人：${[c.age && c.age + '歲', c.sex, c.fitz && 'Fitz ' + c.fitz].filter(Boolean).join('、')}`,
    (c.concerns || []).length && `主訴：${c.concerns.join('、')}`,
    (c.areas || []).length && `部位：${c.areas.join('、')}`,
    c.product && `產品：${c.product}`, c.dose && `劑量：${c.dose}`, c.technique && `技術/參數：${c.technique}`,
    (c.inj || []).length && `注射：${injSummary(c.inj)}${productText(c.inj) ? '\n產品用量：' + productText(c.inj) : ''}`,
    c.outcome && `效果：${starsText(c.outcome)}`,
    (c.complications || []).length && `併發症：${c.complications.join('、')}`, c.cxNote && `處理：${c.cxNote}`,
    c.pearl && `\n💡 Pearl：${c.pearl}`, c.differently && `下次會：${c.differently}`,
    ...(c.followups || []).sort((a, b) => a.date.localeCompare(b.date)).map(f => `• ${fmtDate(f.date)}${f.note ? '：' + f.note : ''}`),
  ].filter(Boolean).join('\n');
}

// photo viewer
async function openViewer(c, i) {
  const photos = c.photos || [];
  const ov = document.createElement('div');
  ov.className = 'viewer';
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  const close = () => { ov.remove(); document.body.style.overflow = ''; window.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); };
  window.addEventListener('keydown', key);
  async function show(n) {
    i = (n + photos.length) % photos.length;
    const p = photos[i];
    ov.innerHTML = `<div class="vtop"><button class="iconbtn" data-v="close" aria-label="關閉">${ICON.x}</button><span>${i + 1} / ${photos.length}</span><span style="width:44px"></span></div>
      <div class="vimg"><img src="${await photoURL(p.id, 'full')}" alt=""></div>
      <div class="vcap">${esc(p.label)} · ${fmtDate(p.date)}${c.date && p.date ? `（術後第 ${daysBetween(c.date, p.date)} 天）` : ''}</div>`;
  }
  ov.addEventListener('click', e => { if (e.target.closest('[data-v=close]')) close(); });
  let sx = null;
  ov.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener('touchend', e => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  });
  show(i);
}

// follow-up sheet
function openFollowUp(c) {
  let newPhotos = [];
  const close = openSheet(`<h2>新增回診紀錄</h2>
    <div class="form">
      <div class="field"><label>回診日期</label><input type="date" id="fuDate" value="${today()}"></div>
      <div class="field"><label>觀察 / 病人回饋</label><textarea id="fuNote" placeholder="例：右側法令紋仍略凹，補打 0.3 cc；病人滿意度高"></textarea></div>
      <div class="field"><label>照片</label><div class="pgrid" id="fuPhotos"></div></div>
      <div class="grid2">
        <div class="field"><label>下次回診</label><input type="date" id="fuNext" value=""></div>
        <div class="field"><label>&nbsp;</label><div class="chips">${[14, 30, 90].map(d => `<button type="button" class="chip" data-d="${d}">+${d >= 30 ? d / 30 + '月' : d + '天'}</button>`).join('')}</div></div>
      </div>
      <label class="switch field"><span>此病例已結案</span><input type="checkbox" id="fuDone" style="width:auto;-webkit-appearance:checkbox;appearance:auto;transform:scale(1.4)"></label>
      <button class="btn primary block" id="fuSave">儲存回診</button>
    </div>`, (sh, close) => {
    const drawPh = () => {
      $('#fuPhotos', sh).innerHTML = newPhotos.map((p, i) => `<div class="ph"><img src="${p.url}" alt=""><button type="button" class="x" data-rm="${i}">${ICON.x}</button></div>`).join('')
        + `<button type="button" class="ph addph" id="fuAdd">${ICON.cam}加照片</button>`;
    };
    drawPh();
    sh.addEventListener('click', async e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { newPhotos.splice(+rm.dataset.rm, 1); drawPh(); return; }
      const d = e.target.closest('[data-d]');
      if (d) { $('#fuNext', sh).value = addDays($('#fuDate', sh).value || today(), +d.dataset.d); return; }
      if (e.target.closest('#fuAdd')) {
        const fs = await pickPhotos();
        newPhotos.push(...await filesToPhotos(fs, '術後', $('#fuDate', sh).value || today()));
        drawPh();
      }
      if (e.target.closest('#fuSave')) {
        const date = $('#fuDate', sh).value || today();
        const fu = { id: uid(), date, note: $('#fuNote', sh).value.trim() };
        for (const p of newPhotos) {
          await idb.put('photos', { id: p.id, caseId: c.id, blob: p.blob, thumb: p.thumb });
          URL.revokeObjectURL(p.url);
        }
        c.photos = [...(c.photos || []), ...newPhotos.map(p => ({ id: p.id, label: '術後', date, ar: p.ar, fuId: fu.id }))];
        c.followups = [...(c.followups || []), fu];
        c.nextFU = $('#fuNext', sh).value || '';
        if ($('#fuDone', sh).checked) c.status = 'done';
        await saveCase(c);
        close(); toast('已儲存回診紀錄'); render();
      }
    });
  });
  return close;
}

// ---------- views: form ----------
let draft = null;
function viewForm(id) {
  const existing = id ? byId(id) : null;
  if (id && !existing) { go('#/'); return; }
  draft = existing ? structuredClone({ ...existing }) : {
    id: uid(), createdAt: Date.now(), date: today(), title: '', category: '', code: '', age: '', sex: '', fitz: '',
    concerns: [], areas: [], inj: [], product: '', dose: '', technique: '', outcome: 0, complications: [], cxNote: '',
    pearl: '', differently: '', notes: '', refs: '', tags: [], starred: false, status: 'open', nextFU: '', followups: [], photos: [],
  };
  draft._new = []; draft._removed = []; draft.inj = draft.inj || [];
  let dirty = false;
  leaveGuard = () => !dirty || confirm('尚未儲存，確定要離開嗎？');
  const products = [...new Set(S.cases.map(c => c.product).filter(Boolean))];
  const d = draft;
  $('#view').innerHTML = `${header(existing ? '編輯病例' : '新增病例', { back: true, small: true })}
  <form class="form" id="caseForm" autocomplete="off">
    <section>
      <div class="field"><label for="f-title">標題 *</label>
        <input id="f-title" name="title" value="${esc(d.title)}" placeholder="例：淚溝玻尿酸後 Tyndall effect" required enterkeyhint="next"></div>
      <div class="field"><label>類別</label>${chipGroup('category', d.category, { single: true })}</div>
      <div class="field"><label for="f-date">治療日期</label><input type="date" id="f-date" name="date" value="${esc(d.date)}"></div>
    </section>
    <section><h3>照片</h3>
      <div class="pgrid" id="photos"></div>
      <div class="hint note" style="margin-top:8px">點照片上的標籤可切換 術前／術中／術後。照片會壓縮並移除 GPS 等 EXIF 資訊，只存在這支手機。</div>
    </section>
    <section><h3>病人（請勿填真實姓名）</h3>
      <div class="grid2">
        <div class="field"><label for="f-code">代號</label><input id="f-code" name="code" value="${esc(d.code)}" placeholder="例：A0213"></div>
        <div class="field"><label for="f-age">年齡</label><input id="f-age" name="age" type="number" inputmode="numeric" min="0" max="120" value="${esc(d.age)}"></div>
      </div>
      <div class="field"><label>性別</label>${chipGroup('sex', d.sex, { single: true, options: SEX, add: false })}</div>
      <div class="field"><label>Fitzpatrick</label>${chipGroup('fitz', d.fitz, { single: true, options: FITZ, add: false })}</div>
      <div class="field"><label>主訴 / 問題</label>${chipGroup('concern', d.concerns)}</div>
      <div class="field"><label>部位</label>${chipGroup('area', d.areas)}</div>
    </section>
    <section><h3>治療</h3>
      <div class="field"><label for="f-product">產品 / 儀器</label><input id="f-product" name="product" list="dl-products" value="${esc(d.product)}" placeholder="例：Juvederm Volbella、Pico 755"></div>
      <datalist id="dl-products">${products.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <div class="field"><label for="f-dose">劑量</label><input id="f-dose" name="dose" value="${esc(d.dose)}" placeholder="例：每側 0.5 cc／20 U／1200 shots"></div>
      <div class="field"><label>注射點位圖</label><div id="injPreview"></div></div>
      <div class="field"><label for="f-tech">技術 / 參數</label><textarea id="f-tech" name="technique" placeholder="針 or cannula、層次、進針點、能量設定…">${esc(d.technique)}</textarea></div>
    </section>
    <section><h3>結果</h3>
      <div class="field"><label>效果</label>${starsInput('outcome', d.outcome)}</div>
      <div class="field"><label>併發症</label>${chipGroup('complication', d.complications)}</div>
      <div class="field"><label for="f-cx">併發症處理</label><textarea id="f-cx" name="cxNote" placeholder="處理方式、時間、結果">${esc(d.cxNote)}</textarea></div>
    </section>
    <section><h3>學習</h3>
      <div class="field pearl-field"><label for="f-pearl">💡 學習重點 Pearl</label><textarea id="f-pearl" name="pearl" placeholder="這個 case 教會我的一件事…">${esc(d.pearl)}</textarea></div>
      <div class="field"><label for="f-diff">下次我會怎麼做</label><textarea id="f-diff" name="differently">${esc(d.differently)}</textarea></div>
      <div class="field"><label for="f-notes">其他筆記</label><textarea id="f-notes" name="notes">${esc(d.notes)}</textarea></div>
      <div class="field"><label for="f-refs">參考資料（文獻、連結）</label><textarea id="f-refs" name="refs" style="min-height:60px">${esc(d.refs)}</textarea></div>
      <div class="field"><label>標籤</label>${chipGroup('tag', d.tags)}</div>
    </section>
    <section><h3>追蹤</h3>
      <div class="field"><label for="f-next">下次回診</label><input type="date" id="f-next" name="nextFU" value="${esc(d.nextFU)}">
        <div class="chips" style="margin-top:8px">${[[14, '2 週'], [30, '1 個月'], [90, '3 個月'], [180, '6 個月']].map(([n, l]) => `<button type="button" class="chip" data-act="fuIn" data-val="${n}">${l}後</button>`).join('')}</div></div>
      <div class="field"><label>狀態</label>${chipGroup('status', d.status === 'done' ? '已結案' : '追蹤中', { single: true, options: ['追蹤中', '已結案'], add: false })}</div>
      <label class="switch"><span>★ 加入收藏</span><input type="checkbox" name="starred" ${d.starred ? 'checked' : ''} style="width:auto;-webkit-appearance:checkbox;appearance:auto;transform:scale(1.4)"></label>
    </section>
  </form>
  <div class="savebar"><div class="inner btnrow"><button class="btn" data-act="back">取消</button><button class="btn primary" data-act="saveForm">儲存</button></div></div>`;
  drawFormPhotos();
  drawInjPreview();
  const form = $('#caseForm');
  form.addEventListener('input', () => { dirty = true; });
  form.addEventListener('click', e => { if (e.target.closest('[data-act]')) dirty = true; });
  form.addEventListener('submit', e => { e.preventDefault(); actions.saveForm(); });
  draft._markClean = () => { dirty = false; };
  if (!existing) setTimeout(() => $('#f-title')?.focus(), 50);
}
const FIELD_MAP = { category: 'category', sex: 'sex', fitz: 'fitz', concern: 'concerns', area: 'areas', complication: 'complications', tag: 'tags', status: 'status' };
const formPhotos = () => [...(draft.photos || []).filter(p => !draft._removed.includes(p.id)), ...draft._new];
function drawInjPreview() {
  const photos = formPhotos(), items = liveItems(draft.inj, photos), views = usedViews(items, photos), v = views[0];
  const n = v && draft._new.find(p => 'p:' + p.id === v);
  $('#injPreview').innerHTML = `<button type="button" class="injprev" data-act="injEdit">
    ${v ? viewSVG(v, items, photos, { src: n ? n.url : '' }) : `<span class="ph addph" style="aspect-ratio:auto;height:100%">${ICON.plus}<span>畫點位</span></span>`}
    <span class="injprev-t"><b>${items.length ? '編輯點位' : '在臉部圖上標記'}</b><span class="note">${items.length
      ? esc(injSummary(items)) + (views.length > 1 ? `・${views.length} 張圖` : '') : '正面、側面或病人照片；點或鈍針線；劑量、產品、層次'}</span></span></button>`;
  hydrate($('#injPreview'));
}
function drawFormPhotos() {
  const all = [...(draft.photos || []).filter(p => !draft._removed.includes(p.id)).map(p => ({ ...p, saved: true })), ...draft._new];
  $('#photos').innerHTML = all.map(p => `<div class="ph">
    <img ${p.saved ? `data-pid="${p.id}"` : `src="${p.url}"`} alt="">
    <button type="button" class="lab" data-act="phLabel" data-id="${p.id}">${esc(p.label)}</button>
    <button type="button" class="x" data-act="phRemove" data-id="${p.id}" aria-label="移除">${ICON.x}</button></div>`).join('')
    + `<button type="button" class="ph addph" data-act="phAdd">${ICON.cam}<span>拍照 / 相簿</span></button>`;
  hydrate($('#photos'));
}

// ---------- views: compare ----------
function viewCompare(id) {
  const c = byId(id);
  if (!c || (c.photos || []).length < 2) { go('#/case/' + id); return; }
  const ph = [...c.photos].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let A = (ph.find(p => p.label === '術前') || ph[0]).id;
  let B = ([...ph].reverse().find(p => p.label === '術後' && p.id !== A) || ph.filter(p => p.id !== A).pop()).id;
  let mode = 'slide', pos = 50;
  const lab = p => `${p.label} ${fmtDate(p.date).slice(5)}`;
  async function draw() {
    const pa = ph.find(p => p.id === A), pb = ph.find(p => p.id === B);
    const [ua, ub] = await Promise.all([photoURL(A, 'full'), photoURL(B, 'full')]);
    $('#view').innerHTML = `${header('前後比較', { back: true, small: true })}
    <div class="seg"><button class="${mode === 'slide' ? 'on' : ''}" data-m="slide">滑桿</button><button class="${mode === 'side' ? 'on' : ''}" data-m="side">並排</button></div>
    ${mode === 'slide' ? `<div class="cmp" id="cmp"><img class="b" src="${ub}" alt=""><img class="a" src="${ua}" alt="">
      <div class="line"></div><div class="knob">⇆</div><span class="la">${esc(lab(pa))}</span><span class="lb">${esc(lab(pb))}</span></div>`
      : `<div class="side"><figure><img src="${ua}" alt=""><figcaption>${esc(lab(pa))}</figcaption></figure><figure><img src="${ub}" alt=""><figcaption>${esc(lab(pb))}</figcaption></figure></div>`}
    ${c.date && pa.date && pb.date ? `<div class="note" style="text-align:center;margin-top:8px">相隔 ${Math.abs(daysBetween(pa.date, pb.date))} 天</div>` : ''}
    <div class="pickrow"><div class="lbl">左 / 前（A）</div><div class="picker">${ph.map(p => `<button class="ph ${p.id === A ? 'sel' : ''}" data-a="${p.id}"><img data-pid="${p.id}" alt=""><span class="lab">${esc(p.label)}</span></button>`).join('')}</div></div>
    <div class="pickrow"><div class="lbl">右 / 後（B）</div><div class="picker">${ph.map(p => `<button class="ph ${p.id === B ? 'sel' : ''}" data-b="${p.id}"><img data-pid="${p.id}" alt=""><span class="lab">${esc(p.label)}</span></button>`).join('')}</div></div>`;
    hydrate($('#view'));
    const cmp = $('#cmp');
    if (cmp) {
      const set = x => {
        const r = cmp.getBoundingClientRect();
        pos = Math.max(0, Math.min(100, (x - r.left) / r.width * 100));
        $('.a', cmp).style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
        $('.line', cmp).style.left = $('.knob', cmp).style.left = pos + '%';
      };
      let drag = false;
      cmp.addEventListener('pointerdown', e => { drag = true; cmp.setPointerCapture(e.pointerId); set(e.clientX); });
      cmp.addEventListener('pointermove', e => { if (drag) set(e.clientX); });
      cmp.addEventListener('pointerup', () => { drag = false; });
      const r = cmp.getBoundingClientRect(); set(r.left + r.width * pos / 100);
    }
  }
  $('#view').onclick = e => {
    const m = e.target.closest('[data-m]'), a = e.target.closest('[data-a]'), b = e.target.closest('[data-b]');
    if (m) { mode = m.dataset.m; draw(); } else if (a) { A = a.dataset.a; draw(); } else if (b) { B = b.dataset.b; draw(); }
  };
  draw();
}

// ---------- views: pearls ----------
function viewPearls() {
  const all = S.cases.filter(c => c.pearl || c.differently).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const cats = presets('category').filter(cat => all.some(c => c.category === cat));
  $('#view').innerHTML = `${header('學習重點', { right: all.length ? `<button class="iconbtn" data-act="random" aria-label="隨機複習">${ICON.dice}</button>` : '' })}
    <div class="search">${ICON.search}<input type="search" id="pq" placeholder="搜尋 pearl…" value="${esc(S.pearlQ)}"></div>
    ${cats.length > 1 ? `<div class="hscroll">${['', ...cats].map(cat => `<button class="chip" data-act="pcat" data-val="${esc(cat)}" aria-pressed="${S.pearlCat === cat}">${cat ? esc(cat) : '全部'}</button>`).join('')}</div>` : ''}
    ${all.length ? `<button class="banner info" data-act="random" style="width:100%">${ICON.dice}<span><b>隨機複習一個 case</b>：先看照片猜猜看，再看自己的 pearl</span></button>` : ''}
    <div class="list" id="plist"></div>`;
  const draw = () => {
    const q = S.pearlQ.trim().toLowerCase();
    const list = all.filter(c => (!S.pearlCat || c.category === S.pearlCat) && (!q || [c.pearl, c.differently, c.title, ...(c.tags || [])].join(' ').toLowerCase().includes(q)));
    $('#plist').innerHTML = list.map(c => `<a class="card pcard" href="#/case/${c.id}">
      ${c.pearl ? `<p class="q">${esc(c.pearl)}</p>` : ''}${c.differently ? `<p class="q" style="border-color:var(--accent)">下次：${esc(c.differently)}</p>` : ''}
      <div class="src">${c.category ? `<span class="tag cat">${esc(c.category)}</span>` : ''}<span>${esc(c.title)}</span><span>· ${fmtDate(c.date)}</span></div></a>`).join('')
      || `<div class="empty"><div class="big">💡</div>${all.length ? '沒有符合的結果' : '在病例裡填寫「學習重點 Pearl」，就會整理到這裡'}</div>`;
  };
  $('#pq').addEventListener('input', e => { S.pearlQ = e.target.value; draw(); });
  draw();
}
function randomReview() {
  const pool = S.cases.filter(c => c.pearl || c.differently);
  if (!pool.length) return;
  const c = pool[Math.floor(Math.random() * pool.length)];
  const ph = (c.photos || []).slice(0, 6);
  openSheet(`<h2>🎲 隨機複習</h2>
    <div class="dhead" style="margin-top:0"><span class="tag cat">${esc(c.category || '病例')}</span><h2>${esc(c.title)}</h2>
    <div class="m">${[c.age && c.age + '歲', c.sex, (c.areas || []).join('、'), (c.concerns || []).join('、')].filter(Boolean).join(' · ')}</div></div>
    ${ph.length ? `<div class="pgrid" style="margin-bottom:12px">${ph.map(p => `<div class="ph"><img data-pid="${p.id}" alt=""><span class="lab">${esc(p.label)}</span></div>`).join('')}</div>` : ''}
    <div class="note" style="margin-bottom:12px">想一想：你會怎麼評估與治療？有哪些陷阱？</div>
    <button class="btn primary block" id="reveal">顯示我的 Pearl</button>
    <div id="ans" hidden>
      ${c.pearl ? `<div class="block pearl"><h3>💡 PEARL</h3><p>${esc(c.pearl)}</p></div>` : ''}
      ${c.differently ? `<div class="block"><h3>下次我會怎麼做</h3><p class="text">${esc(c.differently)}</p></div>` : ''}
      ${injBlock(c, false)}
      <div class="btnrow"><a class="btn" href="#/case/${c.id}" id="open">看完整病例</a><button class="btn primary" id="again">下一個</button></div>
    </div>`, (sh, close) => {
    hydrate(sh);
    $('#reveal', sh).onclick = () => { $('#ans', sh).hidden = false; $('#reveal', sh).hidden = true; };
    $('#open', sh).onclick = () => close();
    $('#again', sh).onclick = () => { close(); randomReview(); };
  });
}

// ---------- views: stats ----------
function viewStats() {
  const cs = S.cases;
  const cx = cs.filter(c => (c.complications || []).length);
  const pearls = cs.filter(c => c.pearl).length;
  const count = (arr) => { const m = new Map(); arr.forEach(v => v && m.set(v, (m.get(v) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]); };
  const byCat = count(cs.map(c => c.category || '未分類'));
  const byArea = count(cs.flatMap(c => c.areas || [])).slice(0, 8);
  const byCx = count(cs.flatMap(c => c.complications || [])).slice(0, 8);
  const byProd = count(cs.map(c => c.product)).slice(0, 8);
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push([k, cs.filter(c => (c.date || '').startsWith(k)).length]);
  }
  const mMax = Math.max(1, ...months.map(m => m[1]));
  const bars = (rows, cls = '') => { const mx = Math.max(1, ...rows.map(r => r[1])); return `<div class="bars">${rows.map(([k, n]) =>
    `<div class="bar"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span><div class="track"><div class="fill ${cls}" style="width:${n / mx * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}</div>`; };
  const cxRate = cat => { const all = cs.filter(c => (c.category || '未分類') === cat); const n = all.filter(c => (c.complications || []).length).length; return all.length ? Math.round(n / all.length * 100) : 0; };
  $('#view').innerHTML = `${header('統計')}
  ${cs.length ? `<div class="kpis">
    <div class="card kpi"><div class="v">${cs.length}</div><div class="l">病例</div></div>
    <div class="card kpi"><div class="v">${pearls}</div><div class="l">Pearls</div></div>
    <div class="card kpi"><div class="v">${cs.length ? Math.round(cx.length / cs.length * 100) : 0}%</div><div class="l">有併發症</div></div></div>
  <div class="block"><h3>近 12 個月</h3><div class="months">${months.map(([k, n]) => `<div class="col"><span class="k">${n || ''}</span><div class="b" style="height:${n / mMax * 80}%"></div><span class="c">${+k.slice(5)}月</span></div>`).join('')}</div></div>
  <div class="block"><h3>類別</h3>${bars(byCat)}</div>
  ${byArea.length ? `<div class="block"><h3>部位 Top</h3>${bars(byArea)}</div>` : ''}
  ${byProd.length ? `<div class="block"><h3>產品 / 儀器 Top</h3>${bars(byProd)}</div>` : ''}
  ${byCx.length ? `<div class="block"><h3>併發症</h3>${bars(byCx, 'w')}
    <div class="note" style="margin-top:10px">各類別併發症比例：${byCat.map(([k]) => `${esc(k)} ${cxRate(k)}%`).join('、')}</div></div>` : ''}`
    : `<div class="empty"><div class="big">📊</div>累積幾個病例後，這裡會出現統計</div>`}`;
}

// ---------- views: settings / backup ----------
async function viewSettings() {
  const photoCount = S.cases.reduce((n, c) => n + (c.photos || []).length, 0);
  $('#view').innerHTML = `${header('設定與備份')}
  <div class="block"><h3>資料</h3><div class="note">${S.cases.length} 個病例 · ${photoCount} 張照片 · <span id="usage">計算中…</span><br>
    上次備份：${S.lastBackup ? new Date(S.lastBackup).toLocaleString() : '<b style="color:var(--warn)">尚未備份</b>'}</div></div>
  <div class="card menu" style="margin-bottom:12px">
    <button data-act="export">${ICON.down}<div class="grow">完整備份（含照片）<div class="sub">存到 iCloud 雲碟 / Google Drive / 傳給自己</div></div></button>
    <button data-act="import">${ICON.up}<div class="grow">從備份還原 / 合併<div class="sub">換手機或重灌時使用，不會刪除現有資料</div></div></button>
    <button data-act="csv">${ICON.table}<div class="grow">匯出 CSV（不含照片）<div class="sub">可用 Excel / Numbers 開啟</div></div></button>
  </div>
  <div class="block"><h3>${ICON.shield.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} 隱私</h3><div class="note">
    • 所有資料只存在<b>這支手機的這個瀏覽器</b>，沒有上傳到任何伺服器。<br>
    • 照片儲存前會重新壓縮，並移除 GPS 位置等 EXIF 資訊。<br>
    • 請用代號，不要記錄病人姓名、身分證或電話。<br>
    • 刪除 App、清除 Safari 網站資料會一起刪掉病例，<b>請定期備份</b>。<br>
    • iPhone：用 Safari 開啟 →「分享」→「加入主畫面」，像 App 一樣使用、可離線。
  </div></div>
  <div class="card menu" style="margin-bottom:12px">
    <button data-act="resetCustom"><div class="grow">清除自訂的選項<div class="sub">已加入的自訂部位、類別、標籤等</div></div></button>
    <button data-act="wipe" style="color:var(--warn)">${ICON.trash.replace('<svg', '<svg style="color:var(--warn)"')}<div class="grow">刪除全部資料</div></button>
  </div>
  <div class="note" style="text-align:center">Case Log v3</div>`;
  if (navigator.storage?.estimate) {
    const { usage } = await navigator.storage.estimate();
    const persisted = await navigator.storage.persisted?.();
    const el = $('#usage'); if (el) el.textContent = `使用 ${(usage / 1048576).toFixed(1)} MB${persisted ? ' · 已設為永久保存' : ''}`;
  } else { const el = $('#usage'); if (el) el.textContent = ''; }
}
const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return true;
}
async function exportAll() {
  toast('準備備份中…');
  const photos = [];
  for (const rec of await idb.all('photos')) photos.push({ id: rec.id, caseId: rec.caseId, blob: await blobToDataURL(rec.blob), thumb: await blobToDataURL(rec.thumb) });
  const data = { app: 'caselog', version: 1, exportedAt: new Date().toISOString(), custom: S.custom, cases: S.cases, photos };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const ok = await shareOrDownload(blob, `caselog-backup-${today()}.json`);
  if (ok) { S.lastBackup = Date.now(); await meta.set('lastBackup', S.lastBackup); toast('備份完成'); render(); }
}
async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('檔案格式錯誤'); return; }
  if (data?.app !== 'caselog' || !Array.isArray(data.cases)) { toast('這不是 Case Log 的備份檔'); return; }
  if (!confirm(`備份中有 ${data.cases.length} 個病例、${(data.photos || []).length} 張照片。\n要合併到目前資料嗎？（同一病例以較新的版本為準）`)) return;
  toast('還原中…');
  let added = 0;
  for (const p of data.photos || []) {
    if (await idb.get('photos', p.id)) continue;
    const [blob, thumb] = await Promise.all([fetch(p.blob).then(r => r.blob()), fetch(p.thumb).then(r => r.blob())]);
    await idb.put('photos', { id: p.id, caseId: p.caseId, blob, thumb });
  }
  for (const c of data.cases) {
    const cur = byId(c.id);
    if (!cur || (c.updatedAt || 0) > (cur.updatedAt || 0)) {
      await idb.put('cases', c);
      if (cur) S.cases[S.cases.indexOf(cur)] = c; else { S.cases.push(c); added++; }
    }
  }
  for (const f of Object.keys(S.custom)) for (const v of data.custom?.[f] || []) await addCustom(f, v);
  toast(`還原完成，新增 ${added} 個病例`); render();
}
function exportCSV() {
  const cols = [['date', '日期'], ['title', '標題'], ['category', '類別'], ['code', '代號'], ['age', '年齡'], ['sex', '性別'], ['fitz', 'Fitzpatrick'],
    ['concerns', '主訴'], ['areas', '部位'], ['product', '產品'], ['dose', '劑量'], ['technique', '技術參數'], ['outcome', '效果'],
    ['complications', '併發症'], ['cxNote', '併發症處理'], ['pearl', 'Pearl'], ['differently', '下次會怎麼做'], ['notes', '筆記'],
    ['refs', '參考資料'], ['tags', '標籤'], ['status', '狀態'], ['nextFU', '下次回診'], ['followups', '回診紀錄'], ['inj', '注射點位']];
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const val = (c, k) => k === 'inj' ? [injSummary(c.inj), productText(c.inj || [])].filter(Boolean).join('；') : k === 'followups' ? (c.followups || []).map(f => `${f.date} ${f.note}`).join(' | ')
    : k === 'status' ? (c.status === 'done' ? '已結案' : '追蹤中') : Array.isArray(c[k]) ? c[k].join('、') : c[k] || '';
  const csv = '﻿' + [cols.map(c => cell(c[1])).join(','), ...S.cases.map(c => cols.map(([k]) => cell(val(c, k))).join(','))].join('\r\n');
  shareOrDownload(new Blob([csv], { type: 'text/csv' }), `caselog-${today()}.csv`);
}

// ---------- actions (event delegation) ----------
const actions = {
  injEdit() {
    openInjEditor(draft.inj, {
      photos: formPhotos(),
      src: async id => { const n = draft._new.find(p => p.id === id); return n ? (n.full ||= URL.createObjectURL(n.blob)) : photoURL(id, 'full'); },
      products: productChoices(splitProducts($('#f-product')?.value)),
    }, items => { draft.inj = items; drawInjPreview(); });
  },
  injEditCase(el) {
    const c = byId(el.dataset.id);
    openInjEditor(c.inj, { photos: c.photos || [], src: id => photoURL(id, 'full'), products: productChoices(splitProducts(c.product)) },
      async items => { c.inj = items; await saveCase(c); toast('已儲存點位'); render(); });
  },
  back: () => back(),
  go: el => go(el.dataset.href),
  seg: el => { S.filter.seg = S.filter.seg === el.dataset.val && el.dataset.val !== 'all' ? 'all' : el.dataset.val; render(); },
  cat: el => { S.filter.cat = el.dataset.val; render(); },
  pcat: el => { S.pearlCat = el.dataset.val; render(); },
  searchTag: el => { S.filter = { q: el.dataset.val, seg: 'all', cat: '' }; go('#/'); },
  random: () => randomReview(),
  chip(el) {
    const g = el.closest('.chips'), f = g.dataset.field, key = FIELD_MAP[f];
    if (!draft || !key) return;
    if (g.dataset.single) {
      const on = el.getAttribute('aria-pressed') !== 'true';
      $$('.chip[data-val]', g).forEach(b => b.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', on);
      const v = on ? el.dataset.val : '';
      draft[key] = key === 'status' ? (v === '已結案' ? 'done' : 'open') : v;
    } else {
      const on = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', on);
      const set = new Set(draft[key] || []);
      on ? set.add(el.dataset.val) : set.delete(el.dataset.val);
      draft[key] = [...set];
    }
  },
  async chipAdd(el) {
    const g = el.closest('.chips'), f = g.dataset.field, key = FIELD_MAP[f];
    const v = (prompt('新增選項') || '').trim();
    if (!v) return;
    await addCustom(f, v);
    if (g.dataset.single) {
      $$('.chip[data-val]', g).forEach(b => b.setAttribute('aria-pressed', 'false'));
      draft[key] = v;
    } else if (!(draft[key] || []).includes(v)) draft[key] = [...(draft[key] || []), v];
    if (!$$('.chip[data-val]', g).some(b => b.dataset.val === v)) el.insertAdjacentHTML('beforebegin', `<button type="button" class="chip" data-act="chip" data-val="${esc(v)}" aria-pressed="true">${esc(v)}</button>`);
    else $$('.chip[data-val]', g).find(b => b.dataset.val === v).setAttribute('aria-pressed', 'true');
  },
  star(el) {
    const g = el.closest('.stars'); const n = +el.dataset.val;
    draft[g.dataset.field] = draft[g.dataset.field] === n ? 0 : n;
    $$('button', g).forEach(b => b.classList.toggle('on', +b.dataset.val <= draft[g.dataset.field]));
  },
  fuIn(el) { const base = $('#f-date').value || today(); $('#f-next').value = addDays(base > today() ? base : today(), +el.dataset.val); },
  async phAdd() {
    const files = await pickPhotos();
    const hasBefore = [...(draft.photos || []), ...draft._new].some(p => p.label === '術前');
    const label = hasBefore ? '術後' : '術前';
    draft._new.push(...await filesToPhotos(files, label, label === '術前' ? ($('#f-date').value || today()) : today()));
    drawFormPhotos();
  },
  phLabel(el) {
    const id = el.dataset.id;
    const p = draft._new.find(p => p.id === id) || draft.photos.find(p => p.id === id);
    p.label = PHOTO_LABELS[(PHOTO_LABELS.indexOf(p.label) + 1) % PHOTO_LABELS.length];
    el.textContent = p.label;
  },
  phRemove(el) {
    const id = el.dataset.id;
    const i = draft._new.findIndex(p => p.id === id);
    if (i >= 0) { URL.revokeObjectURL(draft._new[i].url); draft._new.splice(i, 1); } else draft._removed.push(id);
    drawFormPhotos(); drawInjPreview();
  },
  async saveForm() {
    const form = $('#caseForm'); if (!form) return;
    const fd = new FormData(form);
    const title = (fd.get('title') || '').trim();
    if (!title) { toast('請輸入標題'); $('#f-title').focus(); return; }
    const d = draft;
    for (const k of ['title', 'date', 'code', 'age', 'product', 'dose', 'technique', 'cxNote', 'pearl', 'differently', 'notes', 'refs', 'nextFU'])
      d[k] = (fd.get(k) || '').toString().trim();
    d.starred = fd.get('starred') === 'on';
    for (const p of d._new) {
      await idb.put('photos', { id: p.id, caseId: d.id, blob: p.blob, thumb: p.thumb });
      URL.revokeObjectURL(p.url); if (p.full) URL.revokeObjectURL(p.full);
    }
    for (const id of d._removed) { forgetPhoto(id); await idb.del('photos', id); }
    d.photos = [...(d.photos || []).filter(p => !d._removed.includes(p.id)), ...d._new.map(({ id, label, date, ar }) => ({ id, label, date, ar }))];
    d.inj = liveItems(d.inj, d.photos);
    const isNew = !byId(d.id);
    const { _new, _removed, _markClean, ...clean } = d;
    _markClean?.();
    await saveCase(clean);
    draft = null;
    toast(isNew ? '已新增病例' : '已儲存');
    if (isNew) history.replaceState(null, '', '#/case/' + clean.id), render();
    else back();
  },
  async toggleStar(el) { const c = byId(el.dataset.id); c.starred = !c.starred; await saveCase(c); el.classList.toggle('on', c.starred); toast(c.starred ? '已加入收藏' : '已取消收藏'); },
  view: el => openViewer(byId(el.dataset.id), +el.dataset.i),
  addFU: el => openFollowUp(byId(el.dataset.id)),
  async delFU(el) {
    if (!confirm('刪除這筆回診紀錄（含照片）？')) return;
    const c = byId(el.dataset.id), fu = el.dataset.fu;
    for (const p of (c.photos || []).filter(p => p.fuId === fu)) { forgetPhoto(p.id); await idb.del('photos', p.id); }
    c.photos = (c.photos || []).filter(p => p.fuId !== fu);
    c.followups = (c.followups || []).filter(f => f.id !== fu);
    await saveCase(c); render();
  },
  async copySummary(el) {
    const t = summaryText(byId(el.dataset.id));
    try { await navigator.clipboard.writeText(t); toast('已複製，可貼到 LINE 或筆記'); }
    catch { if (navigator.share) navigator.share({ text: t }).catch(() => {}); }
  },
  async delCase(el) {
    const c = byId(el.dataset.id);
    if (!confirm(`確定刪除「${c.title}」？照片也會一起刪除，無法復原。`)) return;
    await deleteCase(c); toast('已刪除'); history.replaceState(null, '', '#/'); render();
  },
  export: () => exportAll(),
  csv: () => exportCSV(),
  import: () => { const i = $('#importInput'); i.value = ''; i.onchange = () => i.files[0] && importFile(i.files[0]); i.click(); },
  async resetCustom() { if (!confirm('清除所有自訂選項？（已記錄在病例裡的內容不受影響）')) return; S.custom = { category: [], concern: [], area: [], complication: [], tag: [] }; await meta.set('custom', S.custom); toast('已清除'); },
  async wipe() {
    if (!confirm('確定刪除「全部」病例與照片？')) return;
    if (prompt('請輸入「刪除」確認') !== '刪除') return;
    for (const c of [...S.cases]) await deleteCase(c);
    toast('已全部刪除'); render();
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el, e)).catch(err => { console.error(err); toast('發生錯誤：' + err.message); });
});

// ---------- boot ----------
(async () => {
  try { await loadAll(); }
  catch (e) { $('#view').innerHTML = `<div class="empty">無法開啟資料庫：${esc(e.message)}<br>（私密瀏覽模式可能無法儲存）</div>`; return; }
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
