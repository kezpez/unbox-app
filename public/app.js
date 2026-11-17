// UNBOX front end: room → style → results (swipe / catalog / saved + try in room) → cart → UCP checkout.
const $app = document.getElementById('app');

const PALETTE = { rust: '#C2573A', cream: '#EFE6D6', sage: '#8A9A7B', brass: '#AD862B', charcoal: '#4A4844', walnut: '#6A4630', blue: '#4F6D8A' };
const VIBES = ['warm minimal', 'mid-century', 'scandinavian', 'japandi', 'bohemian', 'industrial', 'traditional'];
// [id, label, catalog query, singular, default spot width, depth (in), icon path]  (matches design screen 4)
const ITEMS = [
  ['sofa', 'Sofas', 'sofa', 'sofa', 84, 38, 'M10 28v-8a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v8 M6 28h36v8H6z M10 36v4 M38 36v4'],
  ['table', 'Dining tables', 'dining table', 'table', 72, 40, 'M6 18h36v4H6z M10 22v18 M38 22v18 M18 22v6 M30 22v6'],
  ['chair', 'Chairs', 'accent chair', 'chair', 32, 34, 'M16 6v22h18 M16 28v14 M34 28v14 M16 20h14'],
  ['bed', 'Beds', 'bed frame', 'bed', 64, 84, 'M6 38V12 M6 28h36v10 M6 20h12a4 4 0 0 1 4 4v4 M42 28v-4'],
  ['dresser', 'Dressers', 'dresser', 'dresser', 60, 20, 'M10 8h28v32H10z M10 19h28 M10 30h28 M22 13h4 M22 24h4 M22 35h4'],
  ['shelf', 'Shelving', 'bookshelf', 'shelf', 36, 14, 'M10 6v36 M38 6v36 M10 16h28 M10 28h28 M10 40h28'],
  ['rug', 'Rugs', 'area rug', 'rug', 108, 72, 'M10 14h28v20H10z M10 18H6 M10 24H6 M10 30H6 M38 18h4 M38 24h4 M38 30h4'],
  ['lamp', 'Lighting', 'floor lamp', 'lamp', 18, 18, 'M18 8h12l6 12H12z M24 20v18 M16 40h16']
];
const itemDef = () => ITEMS.find((i) => i[0] === S.item);
const itemQuery = () => itemDef()?.[2] || 'sofa';
const itemName = () => itemDef()?.[3] || 'sofa';

// Room detail options (match design screens 5 + 6)
const WALLS = [['warm', 'Warm white', '#F2EEE6'], ['bright', 'Bright white', '#FAFAF7'], ['greige', 'Greige', '#D9D1C3'], ['sage', 'Sage', '#C9D1BF'], ['clay', 'Clay', '#D8B8A3']];
const FLOORS = [['light', 'Light oak', '#D2B48C'], ['natural', 'Natural oak', '#B08A5E'], ['walnut', 'Dark walnut', '#5A3E2B'], ['tile', 'Grey tile', '#B9B6B0'], ['concrete', 'Concrete', '#9A968E']];
const SHAPES = [['square', 'Square', 'M6 6h24v24H6z'], ['l', 'L-shape', 'M6 6h14v10h10v14H6z'], ['notch', 'Notch', 'M6 6h8v6h8V6h8v24H6z'], ['angled', 'Angled', 'M6 6h16l8 8v16H6z']];
const ROOM_VIBES = [
  { id: 'warm', name: 'Warm minimal', search: 'warm minimal', tags: ['Warm neutrals', 'Natural wood', 'Soft light'], palette: ['#F2EEE6', '#D8C49A', '#5A3E2B', '#AD462B', '#AD862B'] },
  { id: 'mid', name: 'Mid-century', search: 'mid-century', tags: ['Walnut', 'Mustard accents', 'Tapered legs'], palette: ['#EFE6D6', '#AD862B', '#6B4A33', '#3F5E5A', '#C2573A'] },
  { id: 'japandi', name: 'Japandi', search: 'japandi', tags: ['Light oak', 'Muted greens', 'Low profiles'], palette: ['#EEEAE2', '#C9B48F', '#8A9A7B', '#4A4A44', '#D9CFC0'] },
  { id: 'eclectic', name: 'Colorful eclectic', search: 'bohemian', tags: ['Bold color', 'Mixed patterns', 'Vintage finds'], palette: ['#F4E1D2', '#AD462B', '#3E6C8A', '#E2B33C', '#6E7F5B'] }
];
const wallDef = () => WALLS.find((w) => w[0] === S.wall);
const floorDef = () => FLOORS.find((f) => f[0] === S.floor);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('unbox:' + k)) ?? d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('unbox:' + k, JSON.stringify(v)); } catch (_) {} }
};

const S = {
  screen: 'start', status: null,
  item: null, itemQuery: '', spot: { width: 84, depth: 38 }, room: { width: 144, depth: 120 },
  camMode: 'photo', captured: false, flash: false, photo: null, buildTab: 'shape',
  shape: 'square', ceilFt: 8, doors: 1, windows: 1, wall: 'warm', floor: 'walnut', roomVibe: 'warm', open: null,
  vibe: 'warm minimal', palette: ['rust', 'cream'], imageUrl: '', budgetMax: '', heightIn: '',
  loading: false, error: null, results: [], source: null, warning: null, query: '',
  view: 'swipe', idx: 0, leaving: null,
  liked: store.get('liked', []),          // array of product objects
  cart: store.get('cart', []),            // [{ product, quantity }]
  placedId: null, pos: null, rot: false, planOpen: false,
  email: '', checkout: null, checkingOut: false
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const set = (patch) => { Object.assign(S, patch); store.set('liked', S.liked); store.set('cart', S.cart); render(); };
const isLiked = (id) => S.liked.some((p) => p.id === id);
const inCart = (id) => S.cart.some((l) => l.product.id === id);
const byId = (id) => S.results.find((p) => p.id === id) || S.liked.find((p) => p.id === id) || S.cart.find((l) => l.product.id === id)?.product;
const money = (minor) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(minor / 100);

const ICON = {
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  bag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.5 12h-11z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  heart: (on) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 21l-8.8-8.6a5.5 5.5 0 0 1 7.8-7.8l1 1 1-1a5.5 5.5 0 0 1 7.8 7.8z"/></svg>`,
  x: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>',
  cube: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/><path d="M12 12L4 7.5"/></svg>',
  swipe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M3 7v10"/><path d="M21 7v10"/></svg>',
  grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  turn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>'
};

const progress = (n, of) => `<div class="progress" aria-label="Step ${n} of ${of}">${Array.from({ length: of }, (_, i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('')}</div>`;
const cartBtn = () => `<button class="round" data-go="cart" aria-label="Cart, ${S.cart.length} items">${ICON.bag}${S.cart.length ? `<span class="badge">${S.cart.length}</span>` : ''}</button>`;

// ---------------- screens ----------------
function viewStart() {
  return `<section class="screen start">
    <div class="spacer"></div>
    <p class="word">Unbox</p>
    <div class="outline"><span>FIT</span><span>STYLE</span><span>CONFIDENCE</span></div>
    <p class="sub" style="color:#fff">Find the best furniture to UNBOX that fits your space and your style, from independent Shopify stores</p>
    <button class="btn" data-go="pick">Get started</button>
    <span class="mono" style="color:#fff;text-align:center">Uses Shopify Catalog</span>
  </section>`;
}

// ---------------- 4 · Select an item ----------------
function viewPick() {
  return `<section class="screen">
    <div class="top"><button class="round plain" data-go="start" aria-label="Back">${ICON.back}</button>${progress(1, 4)}</div>
    <h1 class="h1b">Select an item</h1>
    <div class="search">
      <label for="itemSearch" class="sr">Search furniture</label>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8C8984" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="itemSearch" type="search" placeholder="Search sofas, desks, shelves…" data-filter value="${esc(S.itemQuery)}">
    </div>
    <div class="items">
      ${ITEMS.map(([id, label, , , , , d]) => `<button class="item" data-item="${id}" data-label="${esc(label.toLowerCase())} ${id}" aria-pressed="${S.item === id}">
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>
        <span>${label}</span>
        ${S.item === id ? '<span class="check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></span>' : ''}
      </button>`).join('')}
      <p class="sub noresults" hidden>No matches. Try “sofa” or “lamp”.</p>
    </div>
    ${S.item ? '<button class="btn" data-go="scan">Next: your room</button>' : '<button class="btn off" disabled>Pick one to continue</button>'}
  </section>`;
}

// ---------------- 5 · Your room (camera with example photo, or build) ----------------
const CAM_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const modeToggle = (dark) => `<div class="modes ${dark ? 'onphoto' : ''}" role="group" aria-label="How to add your room">
  <button data-cam="photo" aria-pressed="${S.camMode === 'photo'}">${CAM_ICON} Photo</button>
  <button data-cam="build" aria-pressed="${S.camMode === 'build'}">${ICON.cube} Build room</button></div>`;

function chip(x, y, label, swatch, round = true) {
  const w = 34 + label.length * 6.6;
  return `<g transform="translate(${x} ${y})"><rect width="${w}" height="30" rx="15" fill="#fff"/>
    <rect x="12" y="9" width="12" height="12" rx="${round ? 6 : 3}" fill="${swatch}" stroke="rgba(0,0,0,.15)"/>
    <text x="30" y="19.5" font-family="Inter Tight, system-ui, sans-serif" font-size="13" font-weight="500" fill="#111">${esc(label)}</text></g>`;
}

function viewScan() {
  if (S.camMode === 'build') return viewBuild();
  const img = S.photo || '/img/example-room.svg';
  const n = itemName();
  return `<section class="cam">
    <svg class="feed" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${S.photo ? 'Your room photo' : 'Example living room'}">
      <image href="${esc(img)}" x="0" y="0" width="390" height="844" preserveAspectRatio="xMidYMid slice"/>
      <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14120E" stop-opacity=".55"/><stop offset="1" stop-color="#14120E" stop-opacity="0"/></linearGradient>
      <linearGradient id="bg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#14120E" stop-opacity=".6"/><stop offset="1" stop-color="#14120E" stop-opacity="0"/></linearGradient></defs>
      <rect width="390" height="220" fill="url(#tg)"/><rect y="544" width="390" height="300" fill="url(#bg)"/>
      ${S.captured ? `
        <rect x="84" y="424" width="148" height="132" rx="12" fill="rgba(173,70,43,.4)" stroke="#fff" stroke-width="3" stroke-dasharray="9 6"/>
        <g transform="translate(100 476)"><rect width="${92 + String(S.spot.width).length * 7}" height="28" rx="12" fill="#111"/>
          <text x="10" y="18.5" font-family="Inter Tight, system-ui, sans-serif" font-size="13" font-weight="500" fill="#fff">${esc(cap(n))} spot · ${S.spot.width}″</text></g>
        ${chip(78, 186, 'Walls · ' + wallDef()[1], wallDef()[2])}
        ${chip(250, 420, S.windows + (S.windows === 1 ? ' window' : ' windows'), '#CFDCE2', false)}
        ${chip(170, 590, 'Floor · ' + floorDef()[1], floorDef()[2])}` : `
        <g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round">
          <path d="M44 270v-28a10 10 0 0 1 10-10h28"/><path d="M346 270v-28a10 10 0 0 0-10-10h-28"/>
          <path d="M44 590v28a10 10 0 0 0 10 10h28"/><path d="M346 590v28a10 10 0 0 1-10 10h-28"/></g>`}
    </svg>
    ${S.flash ? '<div class="flash"></div>' : ''}
    <div class="camtop">
      <button class="ic" data-go="pick" aria-label="Back"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L5 14h6l-1 8 8-12h-6z"/><path d="M3 3l18 18"/></svg></span>
      <span class="camtitle">${S.captured ? 'Check your room' : 'Your room'}</span>
      <span></span><span class="ic"></span>
    </div>
    ${S.captured ? `
      <div class="camsheet">
        <span class="grab" aria-hidden="true"></span>
        <div><div class="title" style="font-size:20px">Looks right?</div>
        <p class="sub">We found your walls, floor and light. Add one measurement.</p></div>
        <div class="measure">
          <label for="spotWidth">Width of the spot<br><span>Measure wall to wall</span></label>
          <input id="spotWidth" type="number" inputmode="numeric" data-num="spot.width" value="${S.spot.width}"><span class="u">in</span>
        </div>
        <div class="two"><button class="btn ghost" data-act="retake">Retake</button>
          <button class="btn" data-go="confirm">Confirm room →</button></div>
      </div>` : `
      <div class="camcenter">${modeToggle(true)}<span class="steptag">Step 2 of 4 · Room</span></div>
      <div class="hint">${S.photo ? 'Using your photo' : 'Example room'} · point at the spot where your ${esc(n)} will go</div>
      <div class="shutterbar">
        <label class="lib" aria-label="Choose from photo library"><input type="file" accept="image/*" data-photo hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17l5-5 4 4 3-3 6 6"/></svg></label>
        <button class="shutter" data-act="capture" aria-label="Take photo"><span>${ICON.cube.replace(/18/g, '32')}</span></button>
        ${S.photo ? '<button class="lib" data-act="example" aria-label="Use example room">↺</button>' : '<span></span>'}
      </div>`}
  </section>`;
}

function viewBuild() {
  const ft = { w: Math.round(S.room.width / 12), l: Math.round(S.room.depth / 12) };
  const tabs = [['shape', 'Shape'], ['size', 'Size'], ['open', 'Openings'], ['color', 'Colors']];
  const step = (label, key, val, unit) => `<div class="stepper"><span>${label}</span>
    <button data-step="${key}:-1" aria-label="Decrease ${label}">−</button><b>${val}${unit}</b><button data-step="${key}:1" aria-label="Increase ${label}">+</button></div>`;
  let body = '';
  if (S.buildTab === 'shape') body = `<div class="shapes">${SHAPES.map(([id, label, d]) => `<button data-shape="${id}" aria-pressed="${S.shape === id}">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><path d="${d}" fill="#fff" stroke="${S.shape === id ? '#AD462B' : '#111'}" stroke-width="2.5" stroke-linejoin="round"/></svg><span>${label}</span></button>`).join('')}</div>`;
  if (S.buildTab === 'size') body = step('Width', 'roomW', ft.w, '′') + step('Length', 'roomL', ft.l, '′') + step('Ceiling height', 'ceil', S.ceilFt, '′');
  if (S.buildTab === 'open') body = step('Doors', 'doors', S.doors, '') + step('Windows', 'windows', S.windows, '');
  if (S.buildTab === 'color') body = swatchRow('Walls', 'wall', WALLS, true) + swatchRow('Floor', 'floor', FLOORS, false);
  return `<section class="screen">
    <div class="top"><button class="round plain" data-go="pick" aria-label="Back">${ICON.back}</button>${progress(2, 4)}</div>
    <div><h1 class="h1b">Your room</h1><p class="sub">Show us the space so every pick fits.</p></div>
    ${modeToggle(false)}
    <div class="buildprev">${isoRoom(230)}
      <div class="specs"><span class="mono">Specs</span><span>W ${ft.w}′</span><span>L ${ft.l}′</span><span>H ${S.ceilFt}′</span></div>
      <span class="cap">Dashed area = where your ${esc(itemName())} goes</span></div>
    <div class="btabs" role="tablist">${tabs.map(([id, l]) => `<button role="tab" data-btab="${id}" aria-selected="${S.buildTab === id}">${l}</button>`).join('')}</div>
    <div class="bbody">${body}</div>
    <div class="spacer"></div>
    <button class="btn" data-go="confirm">Confirm room →</button>
  </section>`;
}

const swatchRow = (label, key, defs, round) => {
  const cur = defs.find((d) => d[0] === S[key]);
  return `<div class="field"><span style="font-size:13px;font-weight:500">${label} · <span style="color:var(--grey)">${cur[1]}</span></span>
    <div class="swatches">${defs.map(([id, name, hex]) => `<button data-sw="${key}:${id}" aria-label="${name}" aria-pressed="${S[key] === id}" style="background:${hex};border-radius:${round ? 22 : 12}px"></button>`).join('')}</div></div>`;
};

// Isometric cut-away room used on screens 5 (build) and 6 (confirm). Updates with wall/floor/door/window choices.
function isoRoom(width = 340) {
  const wall = wallDef()[2], floor = floorDef()[2];
  const op = (on) => (on ? 1 : 0);
  return `<svg width="${width}" viewBox="0 0 340 240" role="img" aria-label="3D view of your room with the ${esc(itemName())} spot marked" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="12,153 170,232 170,240 12,161" fill="#D9D5CE"/><polygon points="170,232 328,153 328,161 170,240" fill="#C9C4BB"/>
    <polygon points="12,153 170,74 170,4 12,83" fill="${wall}"/><polygon points="12,153 170,74 170,4 12,83" fill="#fff" opacity=".18"/>
    <polygon points="170,74 328,153 328,83 170,4" fill="${wall}"/><polygon points="170,74 328,153 328,83 170,4" fill="#000" opacity=".07"/>
    <polygon points="12,153 170,74 328,153 170,232" fill="${floor}"/>
    <path d="M31.8,143.1L189.8,222.1 M51.5,133.3L209.5,212.3 M71.3,123.4L229.3,202.4 M91,113.5L249,192.5 M110.8,103.6L268.8,182.6 M130.5,93.8L288.5,172.8 M150.3,83.9L308.3,162.9" stroke="#000" stroke-opacity=".13" stroke-width="1.2" fill="none"/>
    <path d="M170,74L170,4" stroke="#000" stroke-opacity=".12" stroke-width="2"/>
    <g opacity="${op(S.doors >= 1)}"><polygon points="24.6,146.7 49.9,134 49.9,78 24.6,90.7" fill="#fff" stroke="#CFC8BC" stroke-width="1.5"/><polygon points="28,142.5 46.5,133.3 46.5,82.5 28,91.7" fill="#F4F1EC"/><circle cx="43.5" cy="110" r="1.8" fill="#8C8984"/></g>
    <g opacity="${op(S.doors >= 2)}"><polygon points="59.4,129.3 84.7,116.7 84.7,60.7 59.4,73.3" fill="#fff" stroke="#CFC8BC" stroke-width="1.5"/><polygon points="62.8,125.1 81.3,116 81.3,65.2 62.8,74.3" fill="#F4F1EC"/></g>
    <polygon points="103.6,71.2 138.4,53.8 138.4,29.8 103.6,47.2" fill="#F5F4F1" stroke="#AD862B" stroke-width="3"/><polygon points="110,62 122,56 122,44 110,50" fill="#AD462B"/>
    <g opacity="${op(S.windows >= 1)}"><polygon points="201.6,31.8 230,46 230,82 201.6,67.8" fill="#fff"/><polygon points="204.6,36 227,47.2 227,77.8 204.6,66.6" fill="#BFD3DC"/><path d="M215.8,41.6L215.8,72.2 M204.6,51.3L227,62.5" stroke="#fff" stroke-width="2"/></g>
    <g opacity="${op(S.windows >= 2)}"><polygon points="261.6,61.8 290.1,76 290.1,112 261.6,97.8" fill="#fff"/><polygon points="264.6,66 287.1,77.2 287.1,107.8 264.6,96.6" fill="#BFD3DC"/><path d="M275.8,71.6L275.8,102.2 M264.6,81.3L287.1,92.5" stroke="#fff" stroke-width="2"/></g>
    <polygon points="214,128 248,145 214,162 180,145" fill="#fff" opacity="${S.windows === 0 ? 0 : S.windows === 1 ? 0.18 : 0.3}"/>
    <polygon points="97.3,116.7 160.5,85.1 195.3,102.4 132.1,134" fill="#AD462B" fill-opacity=".35" stroke="#AD462B" stroke-width="2.5" stroke-dasharray="7 5"/>
    <polygon points="12,83 170,4 170,0 6,82" fill="#fff"/><polygon points="170,4 328,83 334,82 170,0" fill="#F4F2EE"/>
    <polygon points="6,82 12,83 12,153 6,156" fill="#fff"/><polygon points="328,83 334,82 334,156 328,153" fill="#E9E6E0"/>
  </svg>`;
}

// ---------------- 6 · Confirm your room ----------------
function viewConfirm() {
  const v = ROOM_VIBES.find((x) => x.id === S.roomVibe);
  const dark = S.floor === 'walnut' || S.floor === 'concrete';
  const insight = dark
    ? 'Dark floors soak up light. We’ll favor lighter fabrics and raised legs so the room feels brighter.'
    : 'Light floors give you room to go bolder. We’ll show richer fabric colors that still match your vibe.';
  const ft = { w: Math.round(S.room.width / 12), l: Math.round(S.room.depth / 12) };
  const plural = (n, one, many) => (n === 0 ? 'None' : n + ' ' + (n === 1 ? one : many));
  const editRow = (key, label, cur, round) => `
    <div class="drow"><span class="sw" style="background:${cur[2]};border-radius:10px"></span>
      <span class="dl"><span>${label}</span><b>${cur[1]}</b></span>
      <button class="mini" data-open="${key}" aria-expanded="${S.open === key}">${S.open === key ? 'Done' : 'Edit'}</button></div>
    ${S.open === key ? `<div class="swatches" style="padding:10px 0 12px">${(key === 'wall' ? WALLS : FLOORS).map(([id, name, hex]) =>
      `<button data-sw="${key}:${id}" aria-label="${name}" aria-pressed="${S[key] === id}" style="background:${hex};border-radius:${round ? 22 : 12}px"></button>`).join('')}</div>` : ''}`;
  const countRow = (key, label, icon, one, many) => `<div class="drow">
      <span class="sw ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon}"/></svg></span>
      <span class="dl"><span>${label}</span><b>${plural(S[key], one, many)}</b></span>
      <button class="pm" data-step="${key}:-1" aria-label="Remove one ${one}">−</button><button class="pm" data-step="${key}:1" aria-label="Add one ${one}">+</button></div>`;
  return `<section class="screen" style="gap:14px">
    <div class="top"><button class="round plain" data-go="scan" aria-label="Back">${ICON.back}</button>${progress(2, 4)}</div>
    <div><h1 class="h1b">Confirm your room</h1><p class="sub">Here's what we picked up. Tap anything to fix it.</p></div>
    <div class="preview3d">${isoRoom(340)}
      <span class="tagdark" style="left:104px;top:160px">${esc(cap(itemName()))} spot · ${S.spot.width}″</span>
      <span class="tagw">${ft.w}′ × ${ft.l}′ · ${S.ceilFt}′ ceiling</span>
      <span class="tagl">Live 3D preview</span></div>
    <section class="vibe">
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="mono">Your room's vibe</span><span class="detected">Detected</span></div>
      <span style="font-size:22px;font-weight:500">${v.name}</span>
      <div class="pal" role="img" aria-label="Color palette for ${v.name}">${v.palette.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
      <div class="chips">${v.tags.map((t) => `<span class="tagc">${t}</span>`).join('')}</div>
      <span style="font-size:13px;font-weight:500">Not quite? Pick the closest:</span>
      <div class="chips">${ROOM_VIBES.map((x) => `<button class="chip" data-rvibe="${x.id}" aria-pressed="${S.roomVibe === x.id}">${x.name}</button>`).join('')}</div>
    </section>
    <div class="insight"><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5V16h8v-2.5A6 6 0 0 0 12 3z"/></svg></span><p>${insight}</p></div>
    <section class="details"><span class="mono" style="padding-bottom:6px">Room details</span>
      ${editRow('wall', 'Walls', wallDef(), true)}
      ${editRow('floor', 'Floor', floorDef(), false)}
      ${countRow('windows', 'Windows', 'M4 4h16v16H4z M12 4v16 M4 12h16', 'window', 'windows')}
      ${countRow('doors', 'Doors', 'M6 3h12v18H6z M14 12h.01', 'door', 'doors')}
      <div class="drow"><span class="sw ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#AD462B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h18"/><path d="M6 9l-3 3 3 3"/><path d="M18 9l3 3-3 3"/></svg></span>
        <label class="dl" for="spotW"><span>${esc(cap(itemName()))} spot width</span><b>Wall to wall</b></label>
        <input id="spotW" class="numin" type="number" inputmode="numeric" data-num="spot.width" value="${S.spot.width}"><span class="u">in</span></div>
      <div class="drow"><span class="sw ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#AD462B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M9 6l3-3 3 3"/><path d="M9 18l3 3 3-3"/></svg></span>
        <label class="dl" for="spotD"><span>Spot depth</span><b>Out from the wall</b></label>
        <input id="spotD" class="numin" type="number" inputmode="numeric" data-num="spot.depth" value="${S.spot.depth}"><span class="u">in</span></div>
      <div class="drow">${'<span class="sw ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/></svg></span>'}
        <span class="dl"><span>Room size</span><b>${ft.w}′ × ${ft.l}′</b></span>
        <button class="pm" data-step="roomW:-1" aria-label="Narrower">−</button><button class="pm" data-step="roomW:1" aria-label="Wider">+</button></div>
    </section>
    <button class="btn" data-act="toStyle">Next: your style</button>
  </section>`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function viewStyle() {
  return `<section class="screen">
    <div class="top"><button class="round" data-go="confirm" aria-label="Back">${ICON.back}</button>${progress(3, 4)}</div>
    <h1>Your <em>style.</em></h1>
    <div class="field"><span class="mono">Vibe</span>
      <div class="chips">${VIBES.map((v) => `<button class="chip" data-vibe="${v}" aria-pressed="${S.vibe === v}">${v}</button>`).join('')}</div>
    </div>
    <div class="field"><span class="mono">Palette · pick up to 3</span>
      <div class="chips">${Object.entries(PALETTE).map(([k, hex]) => `<button class="chip" data-pal="${k}" aria-pressed="${S.palette.includes(k)}"><span class="dot" style="background:${hex}"></span>${k}</button>`).join('')}</div>
    </div>
    <div class="field"><label for="img">Inspiration image URL <span style="color:var(--grey);font-weight:400">· optional, uses Catalog image search</span></label>
      <input id="img" type="url" placeholder="https://…" data-text="imageUrl" value="${esc(S.imageUrl)}"></div>
    <div class="row">
      <div class="field"><label for="bmax">Max budget</label><div class="unit"><input id="bmax" type="number" min="0" placeholder="Any" data-text="budgetMax" value="${esc(S.budgetMax)}"><span>$</span></div></div>
      <div class="field"><label for="hgt">Your height</label><div class="unit"><input id="hgt" type="number" min="48" max="84" placeholder="Optional" data-text="heightIn" value="${esc(S.heightIn)}"><span>in</span></div></div>
    </div>
    <div class="spacer"></div>
    <button class="btn" data-act="search">Find my matches</button>
  </section>`;
}

function viewResults() {
  const placed = S.placedId ? byId(S.placedId) : null;
  const planH = S.planOpen ? 560 : 290;
  const tabs = [['swipe', ICON.swipe, 'Swipe view'], ['grid', ICON.grid, 'Catalog view'], ['saved', ICON.heart(S.view === 'saved'), 'Saved']];
  const title = S.view === 'saved' ? `Saved <span class="sub">· ${S.liked.length}</span>` : `Suggested <span class="sub">· ${S.results.length}</span>`;
  return `<section class="screen results">
    <div class="top"><button class="round" data-go="style" aria-label="Back">${ICON.back}</button>
      <div style="flex:1;display:flex;flex-direction:column"><span style="font-size:20px;font-weight:500">Your ${esc(itemName())} matches</span>
      <span class="sub" style="font-size:12px">${esc(S.vibe)} · ${S.spot.width}″ spot</span></div>${cartBtn()}</div>
    <div class="plan" style="height:${planH}px">${planSvg(placed)}
      <div class="tag" id="planTag">${planTag(placed)}</div>
      ${placed ? `<div class="tools">
        <button class="tool" data-act="unplace" aria-label="Remove from room">${ICON.x.replace(/22/g, '14')}</button>
        <button class="tool" data-act="turn" aria-label="Turn">${ICON.turn}</button>
        <button class="tool" data-act="resetpos">Back to suggested</button><span class="grow"></span>
        <button class="tool" data-cart="${esc(placed.id)}" style="background:var(--ink);color:#fff">${inCart(placed.id) ? 'In cart ✓' : 'Add · ' + esc(placed.priceText)}</button>
      </div>` : ''}
    </div>
    <div class="sheet">
      <button class="handle" id="handle" aria-label="${S.planOpen ? 'Show results' : 'Slide down to see your room'}" aria-expanded="${!S.planOpen}"><span></span></button>
      <div style="display:flex;align-items:center;gap:10px">
        <h2 style="flex:1">${title}</h2>
        <div class="tabs" role="group" aria-label="View">${tabs.map(([v, ic, l]) =>
          `<button data-view="${v}" aria-pressed="${S.view === v}" aria-label="${l}">${ic}${v === 'saved' && S.liked.length ? `<span class="badge rust">${S.liked.length}</span>` : ''}</button>`).join('')}</div>
      </div>
      ${S.planOpen ? '' : sheetBody()}
    </div>
  </section>`;
}

function sheetBody() {
  if (S.loading) return `<div class="spinner" role="status" aria-label="Searching the Shopify Catalog"></div><p class="sub" style="text-align:center">Searching the Shopify Catalog for “${esc(S.query)}”…</p>`;
  if (S.error) return `<p class="notice">Search failed: ${esc(S.error)}</p>`;
  const note = S.source === 'mock' ? `<p class="notice">Showing sample data (mock mode${S.warning ? ': live Catalog unavailable' : ''}). Add Shopify credentials in .env for live results.</p>` : '';
  if (S.view === 'saved') return note + savedList();
  if (S.view === 'grid') return note + `<div class="grid">${S.results.map(tile).join('') || '<p class="sub">No matches.</p>'}</div>`;
  return note + swipeCard();
}

function swipeCard() {
  const p = S.results[S.idx];
  if (!p) return `<div class="empty"><h2>That's every match</h2><p class="sub">You saved ${S.liked.length}.</p>
    <div style="display:flex;gap:8px"><button class="btn sm ghost" data-act="restart">Start over</button><button class="btn sm" data-view="saved">See saved</button></div></div>`;
  const tf = S.leaving === 'left' ? 'translateX(-460px) rotate(-14deg)' : S.leaving === 'right' ? 'translateX(460px) rotate(14deg)' : 'none';
  return `<article class="card" style="transform:${tf};opacity:${S.leaving ? 0 : 1}">
      <div class="img">${img(p)}<span class="match">${p.match}% match</span>
        <button class="heart" data-like="${esc(p.id)}" aria-pressed="${isLiked(p.id)}" aria-label="Save ${esc(p.title)}">${ICON.heart(isLiked(p.id))}</button></div>
      <div class="body">
        <span class="mono">${esc(p.seller?.name || '')}</span>
        <span class="title">${esc(p.title)}</span>
        <span class="price">${esc(p.priceText)}${p.listPriceText ? `<s>${esc(p.listPriceText)}</s>` : ''}</span>
        <span class="fit ${fitCls(p)}">${esc(p.fitText)}</span>
        ${p.seatText ? `<span class="fit na">${esc(p.seatText)}</span>` : ''}
        ${p.reasons.length ? `<div class="reasons">${p.reasons.map((r) => `<span>${esc(r)}</span>`).join('')}</div>` : ''}
      </div>
    </article>
    <div class="actions">
      <button class="circle" data-act="nope" aria-label="Not for me">${ICON.x}</button>
      <button class="btn sm" data-try="${esc(p.id)}" style="height:52px;border-radius:26px;display:flex;gap:8px;align-items:center">${ICON.cube} Try in my room</button>
      <button class="circle dark" data-act="yes" aria-label="Save to likes">${ICON.heart(true)}</button>
    </div>`;
}

const tile = (p) => `<div class="tile">
  <div class="img">${img(p)}<span class="match">${p.match}%</span>
    <button class="heart" data-like="${esc(p.id)}" aria-pressed="${isLiked(p.id)}" aria-label="Save ${esc(p.title)}">${ICON.heart(isLiked(p.id))}</button></div>
  <span class="t">${esc(p.title)}</span>
  <span class="price" style="font-size:15px">${esc(p.priceText)}</span>
  <span class="fit ${fitCls(p)}" style="font-size:11px">${esc(p.fitText)}</span>
  <div class="row2"><button class="mini" data-try="${esc(p.id)}">Try</button><button class="mini dark" data-cart="${esc(p.id)}">${inCart(p.id) ? 'In cart ✓' : 'Add'}</button></div>
</div>`;

function savedList() {
  if (!S.liked.length) return `<div class="empty"><h2>Nothing saved yet</h2><p class="sub">Tap the heart on any piece to keep it here.</p><button class="btn sm" data-view="swipe">Browse matches</button></div>`;
  const total = S.liked.reduce((a, p) => a + p.price, 0);
  return `<div style="display:flex;justify-content:space-between" class="mono"><span>For your ${S.spot.width}″ spot</span><span>All ${S.liked.length} · ${money(total)}</span></div>
  ${S.liked.map((p) => `<div class="saved">
    <div class="img">${img(p)}<span class="match" style="left:6px;top:6px;font-size:10px">${p.match}%</span></div>
    <div class="info">
      <div style="display:flex;align-items:center;gap:6px"><span class="mono ellipsis" style="flex:1">${esc(p.seller?.name || '')}</span>
        <button class="heart" style="position:static;width:28px;height:28px;color:var(--rust)" data-like="${esc(p.id)}" aria-pressed="true" aria-label="Remove ${esc(p.title)} from saved">${ICON.heart(true)}</button></div>
      <span class="title ellipsis" style="font-size:14px">${esc(p.title)}</span>
      <span class="fit ${fitCls(p)}" style="font-size:11px">${esc(p.fitText)}</span>
      <div style="display:flex;align-items:center;gap:6px;margin-top:auto"><span class="price" style="flex:1;font-size:15px">${esc(p.priceText)}</span>
        <button class="mini" data-try="${esc(p.id)}">Try</button><button class="mini dark" data-cart="${esc(p.id)}">${inCart(p.id) ? 'In cart ✓' : 'Add to cart'}</button></div>
    </div></div>`).join('')}`;
}

const img = (p) => p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">` : '';
const fitCls = (p) => (p.fits === true ? 'ok' : p.fits === false ? 'bad' : 'na');

// ---------------- room plan (top-down, inches) ----------------
const footprint = (p) => {
  const w = p?.dims?.width || S.spot.width, d = p?.dims?.depth || S.spot.depth;
  return S.rot ? { w: d, d: w } : { w, d };
};
const spotRect = () => ({ x: (S.room.width - S.spot.width) / 2, y: 0, w: S.spot.width, h: S.spot.depth });
const defaultPos = (p) => { const f = footprint(p), s = spotRect(); return { x: s.x + (s.w - f.w) / 2, y: 0 }; };
const DOOR = { x: 6, w: 32 }; // door on the front wall, bottom-left, 32″ swing

function planSvg(placed) {
  const R = S.room, s = spotRect(), m = 10;
  const f = placed ? footprint(placed) : null;
  const pos = placed ? (S.pos || defaultPos(placed)) : null;
  return `<svg id="plan" viewBox="${-m} ${-m} ${R.width + 2 * m} ${R.depth + 2 * m + 14}" role="img" aria-label="Top-down plan of your ${R.width} by ${R.depth} inch room">
    <rect x="0" y="0" width="${R.width}" height="${R.depth}" fill="${floorDef()[2]}" opacity=".95"/>
    ${Array.from({ length: Math.floor(R.width / 8) }, (_, i) => `<line x1="${i * 8}" y1="0" x2="${i * 8}" y2="${R.depth}" stroke="#000" stroke-opacity=".12" stroke-width=".4"/>`).join('')}
    <rect x="0" y="0" width="${R.width}" height="${R.depth}" fill="none" stroke="${wallDef()[2]}" stroke-width="4"/>
    <line x1="${R.width}" y1="${R.depth * 0.3}" x2="${R.width}" y2="${R.depth * 0.3 + 40}" stroke="#BFD3DC" stroke-width="5"/>
    <path d="M${DOOR.x} ${R.depth} A ${DOOR.w} ${DOOR.w} 0 0 1 ${DOOR.x + DOOR.w} ${R.depth - DOOR.w}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".8" stroke-dasharray="2 2"/>
    <line x1="${DOOR.x}" y1="${R.depth}" x2="${DOOR.x + DOOR.w}" y2="${R.depth}" stroke="#ECEAE6" stroke-width="5"/>
    <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="#AD462B" fill-opacity=".3" stroke="#fff" stroke-width="1" stroke-dasharray="4 3"/>
    <text x="${s.x + s.w / 2}" y="${s.h / 2 + 2}" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="5" fill="#fff" letter-spacing=".5">SUGGESTED ${S.spot.width}″</text>
    ${placed ? `<g id="piece" style="cursor:grab;touch-action:none">
      <rect id="pieceRect" x="${pos.x}" y="${pos.y}" width="${f.w}" height="${f.d}" rx="4" fill="${pieceColor(placed)}" stroke="#111" stroke-width=".8"/>
      <text id="pieceText" x="${pos.x + f.w / 2}" y="${pos.y + f.d / 2 + 2}" ${S.rot ? `transform="rotate(90 ${pos.x + f.w / 2} ${pos.y + f.d / 2})"` : ''} text-anchor="middle" font-family="Inter Tight, system-ui, sans-serif" font-size="5.5" fill="#111">${esc(placed.title.slice(0, 22))}</text></g>` : ''}
    <text x="${R.width / 2}" y="${R.depth + 11}" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="5" fill="#8C8984">${R.width}″ × ${R.depth}″ · DOOR ↙ · WINDOW →</text>
  </svg>`;
}
const pieceColor = () => '#EFE6D6';

function planTag(placed) {
  if (!placed) return `<span class="pill">Tap “Try in my room” on any piece</span>`;
  const f = footprint(placed), pos = S.pos || defaultPos(placed), s = spotRect();
  const inSpot = pos.x >= s.x - 0.5 && pos.x + f.w <= s.x + s.w + 0.5 && pos.y + f.d <= s.h + 0.5;
  const blocksDoor = pos.y + f.d > S.room.depth - DOOR.w && pos.x < DOOR.x + DOOR.w;
  const msg = blocksDoor ? ['bad', 'Blocks the door swing'] : inSpot ? ['ok', 'In the suggested spot'] : ['', 'Your layout · drag to adjust'];
  return `<span class="pill">Trying: ${esc(placed.title)}</span><span class="pill ${msg[0]}">${msg[1]}</span>
    ${placed.dims.width ? '' : '<span class="pill">Size not listed: using your spot size</span>'}`;
}

// Drag the piece in SVG (inch) coordinates; update the DOM directly while dragging, commit on release.
function wirePlanDrag() {
  const svg = document.getElementById('plan'), g = document.getElementById('piece');
  if (!svg || !g) return;
  const placed = byId(S.placedId), f = footprint(placed);
  let start = null;
  const pt = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  g.addEventListener('pointerdown', (e) => {
    const p = pt(e), pos = S.pos || defaultPos(placed);
    start = { px: p.x, py: p.y, x: pos.x, y: pos.y };
    g.setPointerCapture(e.pointerId); g.style.cursor = 'grabbing';
  });
  g.addEventListener('pointermove', (e) => {
    if (!start) return;
    const p = pt(e);
    const x = Math.max(0, Math.min(S.room.width - f.w, start.x + p.x - start.px));
    const y = Math.max(0, Math.min(S.room.depth - f.d, start.y + p.y - start.py));
    S.pos = { x, y };
    document.getElementById('pieceRect').setAttribute('x', x);
    document.getElementById('pieceRect').setAttribute('y', y);
    document.getElementById('pieceText').setAttribute('x', x + f.w / 2);
    document.getElementById('pieceText').setAttribute('y', y + f.d / 2 + 2);
    if (S.rot) document.getElementById('pieceText').setAttribute('transform', `rotate(90 ${x + f.w / 2} ${y + f.d / 2})`);
    document.getElementById('planTag').innerHTML = planTag(placed);
  });
  const end = () => { start = null; g.style.cursor = 'grab'; };
  g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
}

// Sheet handle: tap toggles, drag down/up collapses/expands.
function wireHandle() {
  const h = document.getElementById('handle');
  if (!h) return;
  let y0 = null, moved = false;
  h.addEventListener('pointerdown', (e) => { y0 = e.clientY; moved = false; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', (e) => { if (y0 !== null && Math.abs(e.clientY - y0) > 6) moved = true; });
  h.addEventListener('pointerup', (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0; y0 = null;
    if (!moved) set({ planOpen: !S.planOpen });
    else if (dy > 40) set({ planOpen: true });
    else if (dy < -40) set({ planOpen: false });
  });
}

// ---------------- cart + UCP checkout ----------------
function viewCart() {
  const groups = {};
  S.cart.forEach((l) => { const k = l.product.seller?.name || 'Store'; (groups[k] = groups[k] || []).push(l); });
  const total = S.cart.reduce((a, l) => a + l.product.price * l.quantity, 0);
  const avg = S.cart.length ? Math.round(S.cart.reduce((a, l) => a + l.product.match, 0) / S.cart.length) : 0;
  const co = S.checkout;
  return `<section class="screen">
    <div class="top"><button class="round" data-go="results" aria-label="Back">${ICON.back}</button>${progress(4, 4)}</div>
    <h1>Looks great <em>in your room.</em></h1>
    ${S.cart.length ? `<div class="ring"><span style="font-size:34px;font-weight:300">${avg}%</span><span class="sub">average match for your space and style. Every piece was checked against your ${S.spot.width}″ spot.</span></div>` : ''}
    ${Object.entries(groups).map(([seller, lines]) => `<div class="store"><span class="mono">${esc(seller)}</span>
      ${lines.map((l) => `<div class="line">${l.product.image ? `<img src="${esc(l.product.image)}" alt="">` : '<span style="width:52px;height:52px;border-radius:12px;background:var(--card)"></span>'}
        <div style="flex:1;min-width:0"><div class="ellipsis" style="font-weight:500;font-size:14px">${esc(l.product.title)}</div>
        <div class="fit ${fitCls(l.product)}" style="font-size:11px">${esc(l.product.fitText)}</div></div>
        <span class="price" style="font-size:14px">${esc(l.product.priceText)}</span>
        <button class="mini" data-rm="${esc(l.product.id)}" aria-label="Remove ${esc(l.product.title)}">✕</button></div>`).join('')}
      ${co ? storeStatus(co.stores.find((s) => s.seller === seller)) : ''}
    </div>`).join('') || '<div class="empty"><h2>Your cart is empty</h2><button class="btn sm" data-go="results">Back to matches</button></div>'}
    ${S.cart.length ? `
      <div style="display:flex;justify-content:space-between;font-weight:500"><span>Estimated total</span><span>${money(total)}</span></div>
      <div class="field"><label for="email">Email for your order</label><input id="email" type="email" data-text="email" value="${esc(S.email)}" placeholder="you@example.com"></div>
      <p class="sub" style="font-size:12px">One checkout across ${Object.keys(groups).length} store${Object.keys(groups).length > 1 ? 's' : ''} via the Universal Commerce Protocol. Each store confirms payment and delivery.</p>
      <div class="spacer"></div>
      <button class="btn" data-act="checkout" ${S.checkingOut ? 'disabled' : ''}>${S.checkingOut ? 'Creating checkouts…' : co ? 'Refresh checkout' : 'Check out with UCP'}</button>` : ''}
  </section>`;
}

function storeStatus(s) {
  if (!s) return '';
  if (s.error && !s.continueUrl) return `<div class="status warn">${esc(s.error)}</div>`;
  if (s.mode === 'permalink') return `<div class="status warn">This store's UCP cart wasn't available, so we built a cart link instead. <a href="${esc(s.continueUrl)}" target="_blank" rel="noopener">Open cart on ${esc(s.seller)}</a></div>`;
  const c = s.checkout;
  if (!c) return `<div class="status">Cart ready · <a href="${esc(s.continueUrl)}" target="_blank" rel="noopener">open</a></div>`;
  const label = { ready_for_complete: 'Ready to pay', requires_escalation: 'Finish payment on the store', incomplete: 'More info needed', completed: 'Order placed ✓' }[c.status] || c.status;
  return `<div class="status ${c.status === 'completed' ? 'ok' : 'warn'}"><b>${esc(label)}</b>${c.source === 'mock' ? ' (mock)' : ''}
    ${(c.messages || []).map((m) => `<div>${esc(m.content || m.code || '')}</div>`).join('')}
    ${c.continueUrl ? `<div style="margin-top:6px"><a href="${esc(c.continueUrl)}" target="_blank" rel="noopener">Continue to ${esc(s.seller)} checkout →</a></div>` : ''}</div>`;
}

async function checkout() {
  set({ checkingOut: true });
  try {
    const lines = S.cart.map((l) => ({ variantId: l.product.variantId, checkoutUrl: l.product.checkoutUrl, url: l.product.url, seller: l.product.seller, quantity: l.quantity }));
    const { stores } = await api('/api/cart', { lines });
    for (const s of stores) {
      if (s.mode !== 'ucp') continue;
      try { s.checkout = await api('/api/checkout', { origin: s.origin, cartId: s.cartId, email: S.email }); }
      catch (err) { s.error = err.message; }
    }
    set({ checkout: { stores }, checkingOut: false });
  } catch (err) {
    set({ checkingOut: false, checkout: { stores: [] } });
    alert('Checkout failed: ' + err.message);
  }
}

// ---------------- data ----------------
async function api(url, body) {
  const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function search() {
  set({ screen: 'results', loading: true, error: null, idx: 0, query: `${S.vibe} ${itemQuery()}` });
  try {
    const r = await api('/api/search', {
      item: itemQuery(), spot: S.spot, style: { vibe: S.vibe, palette: S.palette },
      budget: S.budgetMax ? { max: Number(S.budgetMax) } : {}, heightIn: S.heightIn ? Number(S.heightIn) : undefined,
      imageUrl: S.imageUrl || undefined
    });
    set({ loading: false, results: r.results, source: r.source, warning: r.warning, query: r.query });
  } catch (err) { set({ loading: false, error: err.message }); }
}

function toggleLike(id) {
  const p = byId(id);
  if (!p) return;
  set({ liked: isLiked(id) ? S.liked.filter((x) => x.id !== id) : [p, ...S.liked] });
}
function addToCart(id) {
  if (inCart(id)) return;
  const p = byId(id);
  if (p) set({ cart: [...S.cart, { product: p, quantity: 1 }], checkout: null });
}
function swipe(dir) {
  const p = S.results[S.idx];
  if (!p || S.leaving) return;
  if (dir === 'right' && !isLiked(p.id)) S.liked = [p, ...S.liked];
  set({ leaving: dir });
  setTimeout(() => set({ leaving: null, idx: S.idx + 1 }), 230);
}

// ---------------- events ----------------
$app.addEventListener('click', (e) => {
  const t = e.target.closest('button,[data-go]');
  if (!t) return;
  const d = t.dataset;
  if (d.go) return set({ screen: d.go });
  if (d.item) {
    if (S.item === d.item) return set({ item: null });
    const it = ITEMS.find((i) => i[0] === d.item);
    return set({ item: d.item, spot: { width: it[4], depth: it[5] }, captured: false, placedId: null, results: [] });
  }
  if (d.cam) return set({ camMode: d.cam });
  if (d.btab) return set({ buildTab: d.btab });
  if (d.shape) return set({ shape: d.shape });
  if (d.sw) { const [k, v] = d.sw.split(':'); return set({ [k]: v }); }
  if (d.open) return set({ open: S.open === d.open ? null : d.open });
  if (d.rvibe) { const v = ROOM_VIBES.find((x) => x.id === d.rvibe); return set({ roomVibe: v.id, vibe: v.search }); }
  if (d.step) {
    const [k, dir] = d.step.split(':'); const n = Number(dir);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (k === 'roomW') return set({ room: { ...S.room, width: clamp(S.room.width + n * 12, 72, 360) } });
    if (k === 'roomL') return set({ room: { ...S.room, depth: clamp(S.room.depth + n * 12, 72, 360) } });
    if (k === 'ceil') return set({ ceilFt: clamp(S.ceilFt + n, 7, 14) });
    if (k === 'doors' || k === 'windows') return set({ [k]: clamp(S[k] + n, 0, 2) });
  }
  if (d.vibe) return set({ vibe: d.vibe });
  if (d.pal) {
    const has = S.palette.includes(d.pal);
    return set({ palette: has ? S.palette.filter((x) => x !== d.pal) : [...S.palette, d.pal].slice(-3) });
  }
  if (d.view) return set({ view: d.view, planOpen: false });
  if (d.like) return toggleLike(d.like);
  if (d.cart) return addToCart(d.cart);
  if (d.rm) return set({ cart: S.cart.filter((l) => l.product.id !== d.rm), checkout: null });
  if (d.try) return set({ placedId: d.try, pos: null, rot: false });
  switch (d.act) {
    case 'search': return search();
    case 'nope': return swipe('left');
    case 'yes': return swipe('right');
    case 'restart': return set({ idx: 0 });
    case 'unplace': return set({ placedId: null, pos: null, rot: false });
    case 'resetpos': return set({ pos: null, rot: false });
    case 'turn': {
      S.rot = !S.rot;
      const f = footprint(byId(S.placedId)), pos = S.pos || defaultPos(byId(S.placedId));
      return set({ pos: { x: Math.min(pos.x, S.room.width - f.w), y: Math.min(pos.y, S.room.depth - f.d) } });
    }
    case 'checkout': return checkout();
    case 'capture': set({ flash: true }); return setTimeout(() => set({ flash: false, captured: true }), 160);
    case 'retake': return set({ captured: false });
    case 'example': return set({ photo: null, captured: false });
    case 'toStyle': return set({ screen: 'style', vibe: ROOM_VIBES.find((x) => x.id === S.roomVibe).search });
  }
});
$app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.hasAttribute('data-photo') && t.files?.[0]) {   // use the buyer's own room photo instead of the example
    if (S.photo) URL.revokeObjectURL(S.photo);
    return set({ photo: URL.createObjectURL(t.files[0]), captured: false });
  }
  if (t.dataset.num) {
    const [obj, key] = t.dataset.num.split('.');
    S[obj] = { ...S[obj], [key]: Math.max(1, Number(t.value) || 1) };
    if (S.screen === 'confirm' || S.screen === 'scan') render();
  }
});
$app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.text) S[t.dataset.text] = t.value;
  if (t.hasAttribute('data-filter')) {               // filter item tiles without re-rendering (keeps focus)
    S.itemQuery = t.value; const q = t.value.trim().toLowerCase(); let shown = 0;
    document.querySelectorAll('.item').forEach((b) => { const hit = !q || b.dataset.label.includes(q); b.hidden = !hit; shown += hit; });
    document.querySelector('.noresults').hidden = shown > 0;
  }
});

function render() {
  const views = { start: viewStart, pick: viewPick, scan: viewScan, confirm: viewConfirm, style: viewStyle, results: viewResults, cart: viewCart };
  $app.innerHTML = views[S.screen]();
  if (S.screen === 'results') { wirePlanDrag(); wireHandle(); }
}

render();
api('/api/status').then((s) => { S.status = s; if (S.screen === 'start') render(); }).catch(() => {});
