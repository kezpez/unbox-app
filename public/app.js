// UNBOX front end: room → style → results (swipe / catalog / saved + try in room) → cart → UCP checkout.
const $app = document.getElementById('app');

const PALETTE = { rust: '#C2573A', cream: '#EFE6D6', sage: '#8A9A7B', brass: '#AD862B', charcoal: '#4A4844', walnut: '#6A4630', blue: '#4F6D8A' };
const VIBES = ['warm minimal', 'mid-century', 'scandinavian', 'japandi', 'bohemian', 'industrial', 'traditional'];
const ITEMS = [['sofa', 'Sofa', 84, 38], ['accent chair', 'Accent chair', 32, 34], ['coffee table', 'Coffee table', 48, 30], ['rug', 'Rug', 108, 72]];

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('unbox:' + k)) ?? d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('unbox:' + k, JSON.stringify(v)); } catch (_) {} }
};

const S = {
  screen: 'start', status: null,
  item: 'sofa', spot: { width: 84, depth: 38 }, room: { width: 144, depth: 120 },
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
    <span class="mono" style="color:#fff">New York · est. 2026</span>
    <p class="word">Unbox®</p>
    <div class="outline"><span>FIT</span><span>STYLE</span><span>CONFIDENCE</span></div>
    <p class="sub" style="color:#fff">Furniture that fits your space and your style, from independent Shopify stores.</p>
    <button class="btn" data-go="room">Get started</button>
    ${S.status ? `<span class="mono" style="color:#fff;text-align:center">Catalog: ${esc(S.status.mode)} · ${esc(S.status.auth)}</span>` : ''}
  </section>`;
}

function viewRoom() {
  return `<section class="screen">
    <div class="top"><button class="round" data-go="start" aria-label="Back">${ICON.back}</button>${progress(1, 3)}</div>
    <h1>What are you <em>looking for?</em></h1>
    <div class="chips" role="group" aria-label="Item">
      ${ITEMS.map(([id, label]) => `<button class="chip" data-item="${id}" aria-pressed="${S.item === id}">${label}</button>`).join('')}
    </div>
    <div class="box">
      <span class="mono">The spot it goes in</span>
      <div class="row">
        ${numField('spot.width', 'Width', S.spot.width)}
        ${numField('spot.depth', 'Depth', S.spot.depth)}
      </div>
      <span class="mono">Your room</span>
      <div class="row">
        ${numField('room.width', 'Room width', S.room.width)}
        ${numField('room.depth', 'Room depth', S.room.depth)}
      </div>
      <p class="sub" style="font-size:12px">Measure wall to wall. In the full app the camera scan fills these in.</p>
    </div>
    <div class="spacer"></div>
    <button class="btn" data-go="style">Continue</button>
  </section>`;
}
const numField = (key, label, val) => `<div class="field"><label for="${key}">${label}</label><div class="unit"><input id="${key}" type="number" inputmode="decimal" min="1" data-num="${key}" value="${esc(val)}"><span>in</span></div></div>`;

function viewStyle() {
  return `<section class="screen">
    <div class="top"><button class="round" data-go="room" aria-label="Back">${ICON.back}</button>${progress(2, 3)}</div>
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
      <div style="flex:1;display:flex;flex-direction:column"><span style="font-size:20px;font-weight:500">Your ${esc(S.item)} matches</span>
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
    <rect x="0" y="0" width="${R.width}" height="${R.depth}" fill="#5A3E2B" opacity=".9"/>
    ${Array.from({ length: Math.floor(R.width / 8) }, (_, i) => `<line x1="${i * 8}" y1="0" x2="${i * 8}" y2="${R.depth}" stroke="#000" stroke-opacity=".12" stroke-width=".4"/>`).join('')}
    <rect x="0" y="0" width="${R.width}" height="${R.depth}" fill="none" stroke="#F2EEE6" stroke-width="4"/>
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
    <div class="top"><button class="round" data-go="results" aria-label="Back">${ICON.back}</button>${progress(3, 3)}</div>
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
  set({ screen: 'results', loading: true, error: null, idx: 0, query: `${S.vibe} ${S.item}` });
  try {
    const r = await api('/api/search', {
      item: S.item, spot: S.spot, style: { vibe: S.vibe, palette: S.palette },
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
  if (d.item) { const it = ITEMS.find((i) => i[0] === d.item); return set({ item: d.item, spot: { width: it[2], depth: it[3] } }); }
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
  }
});
$app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.num) {
    const [obj, key] = t.dataset.num.split('.');
    S[obj] = { ...S[obj], [key]: Math.max(1, Number(t.value) || 1) };
  }
});
$app.addEventListener('input', (e) => { if (e.target.dataset.text) S[e.target.dataset.text] = e.target.value; });

function render() {
  const views = { start: viewStart, room: viewRoom, style: viewStyle, results: viewResults, cart: viewCart };
  $app.innerHTML = views[S.screen]();
  if (S.screen === 'results') { wirePlanDrag(); wireHandle(); }
}

render();
api('/api/status').then((s) => { S.status = s; if (S.screen === 'start') render(); }).catch(() => {});
